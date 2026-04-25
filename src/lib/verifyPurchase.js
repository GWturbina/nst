/**
 * verifyPurchase.js — Серверная проверка транзакций ClubLots в блокчейне
 *
 * Содержит две функции:
 *   • verifyClubLotsPurchase — проверка покупки долей пользователем
 *   • verifyClubLotsCreation — проверка создания лота админом (для link_contract)
 *
 * ИЗМЕНЕНИЯ (25 апр 2026):
 *   • Добавлена функция verifyClubLotsCreation. Раньше action='link_contract'
 *     в /api/lots принимал любой contractLotId без проверки. Теперь сервер
 *     серверно проверяет что лот реально существует в контракте, а если
 *     передан txHash создания — что параметры лота (gemCost/sharePrice/
 *     totalShares) совпадают с записанными в БД.
 *   • Добавлен общий помощник withTimeout для всех RPC-вызовов (8 сек).
 *
 * FIX #2 (17 апр 2026):
 *   Раньше сервер принимал tx_hash на слово — достаточно было прислать
 *   любую строку из 64 hex-символов, и запись проходила. Теперь сервер
 *   реально обращается к opBNB RPC и проверяет что:
 *     1. Такая транзакция существует и подтверждена (status = 1)
 *     2. Она была направлена в контракт ClubLots (адрес совпадает)
 *     3. В её логах есть событие SharePurchased
 *     4. buyer в событии совпадает с запрашивающим кошельком
 *     5. lotId в событии совпадает с contract_lot_id нашего лота
 *     6. count в событии совпадает с заявленным количеством долей
 *
 *   Если что-то не сошлось — возвращаем { ok: false, error: '...' }
 *   с человекочитаемой причиной.
 */
import ADDRESSES from '@/contracts/addresses'

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'

// Таймаут одного RPC-вызова (защита от подвисшего opBNB)
const RPC_TIMEOUT_MS = 8000

// Допустимая погрешность сравнения wei-значений (1e-6 USDT — покрывает float-округления)
const WEI_TOLERANCE = 10n ** 12n

// Фрагменты ABI — только нужные нам события и функции
const SHARE_PURCHASED_EVENT = [
  'event SharePurchased(uint256 indexed lotId, address indexed buyer, uint16 count, uint256 usdtAmount, bool fromBalance)'
]
const LOT_CREATED_EVENT = [
  'event LotCreated(uint256 indexed lotId, uint256 gemCost, uint256 sharePrice, uint256 totalShares, uint8 minLevel)'
]
const CLUBLOTS_VIEW_FRAGMENT = [
  'function getLotCount() external view returns (uint256)',
]

/**
 * Promise.race с таймаутом. Защищает Vercel-функцию от подвисшего RPC.
 */
function withTimeout(promise, ms, label = 'RPC') {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Безопасное преобразование USDT (float) → wei (BigInt) с 18 decimals.
 * Учитывает специфику opBNB (USDT там 18 decimals, не 6).
 * Через ethers.parseUnits — точное преобразование без потерь точности float.
 */
async function usdtToWei(amount) {
  const { ethers } = await import('ethers')
  // toFixed(6) — обрезаем шестью знаками после запятой (центы и доли центов покрыты).
  // Это страхует от float-погрешности типа 50.10 = 50.099999...
  const fixed = parseFloat(amount).toFixed(6)
  return ethers.parseUnits(fixed, 18)
}

/**
 * Сравнить два wei-значения с допуском WEI_TOLERANCE.
 */
function weiEqualWithTolerance(a, b) {
  const diff = a > b ? a - b : b - a
  return diff <= WEI_TOLERANCE
}

/**
 * Проверить транзакцию покупки долей в контракте ClubLots.
 *
 * @param {object} args
 * @param {string} args.txHash           — хэш транзакции (0x + 64 hex)
 * @param {string} args.buyerWallet      — кошелёк, который якобы купил (lowercase)
 * @param {number} args.contractLotId    — ID лота в контракте (из dc_lots.contract_lot_id)
 * @param {number} args.expectedCount    — сколько долей заявлено
 * @returns {Promise<{ok: boolean, error?: string, usdtAmount?: string, fromBalance?: boolean}>}
 */
export async function verifyClubLotsPurchase({ txHash, buyerWallet, contractLotId, expectedCount }) {
  // Базовая валидация входных данных
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { ok: false, error: 'Неверный формат txHash' }
  }
  if (!buyerWallet || !/^0x[a-fA-F0-9]{40}$/.test(buyerWallet)) {
    return { ok: false, error: 'Неверный формат кошелька' }
  }
  if (contractLotId === undefined || contractLotId === null || isNaN(parseInt(contractLotId))) {
    return { ok: false, error: 'Не указан contract_lot_id' }
  }
  if (!expectedCount || expectedCount < 1) {
    return { ok: false, error: 'Неверное количество долей' }
  }

  const clubLotsAddr = (ADDRESSES.ClubLots || '').toLowerCase()
  if (!clubLotsAddr || clubLotsAddr.startsWith('0x_')) {
    return { ok: false, error: 'Адрес контракта ClubLots не настроен на сервере' }
  }

  try {
    const { ethers } = await import('ethers')
    const provider = new ethers.JsonRpcProvider(RPC_URL)

    // Получаем квитанцию транзакции (с таймаутом)
    const receipt = await withTimeout(
      provider.getTransactionReceipt(txHash),
      RPC_TIMEOUT_MS,
      'getTransactionReceipt()'
    )

    if (!receipt) {
      return { ok: false, error: 'Транзакция ещё не подтверждена или не существует' }
    }
    if (receipt.status !== 1) {
      return { ok: false, error: 'Транзакция завершилась с ошибкой (reverted)' }
    }

    // Проверяем что транзакция была адресована нашему контракту ClubLots
    const txTo = (receipt.to || '').toLowerCase()
    if (txTo !== clubLotsAddr) {
      return { ok: false, error: 'Транзакция не относится к контракту ClubLots' }
    }

    // Ищем событие SharePurchased в логах
    const iface = new ethers.Interface(SHARE_PURCHASED_EVENT)
    const expectedBuyer = buyerWallet.toLowerCase()
    const expectedLotId = BigInt(parseInt(contractLotId))
    const expectedCountBig = BigInt(parseInt(expectedCount))

    let matchedEvent = null

    for (const log of (receipt.logs || [])) {
      // Пропускаем логи от чужих контрактов (USDT transfer и т.п.)
      if ((log.address || '').toLowerCase() !== clubLotsAddr) continue

      let parsed
      try {
        parsed = iface.parseLog({ topics: log.topics, data: log.data })
      } catch {
        continue // не наше событие — идём дальше
      }
      if (!parsed || parsed.name !== 'SharePurchased') continue

      // Сверяем поля события с заявленными
      const eventBuyer = String(parsed.args.buyer || '').toLowerCase()
      const eventLotId = BigInt(parsed.args.lotId)
      const eventCount = BigInt(parsed.args.count)

      if (eventBuyer !== expectedBuyer) continue
      if (eventLotId !== expectedLotId) continue
      if (eventCount !== expectedCountBig) continue

      matchedEvent = parsed
      break
    }

    if (!matchedEvent) {
      return {
        ok: false,
        error: 'В транзакции не найдено события SharePurchased с совпадающими buyer/lotId/count'
      }
    }

    return {
      ok: true,
      usdtAmount: matchedEvent.args.usdtAmount.toString(), // в wei (18 decimals на opBNB)
      fromBalance: Boolean(matchedEvent.args.fromBalance),
    }
  } catch (err) {
    console.error('verifyClubLotsPurchase error:', err?.message || err)
    return { ok: false, error: 'Не удалось проверить транзакцию (RPC недоступен или ошибка сети)' }
  }
}

/**
 * Проверить что лот реально существует в контракте ClubLots.
 *
 * Используется в /api/lots action='link_contract' перед привязкой
 * contract_lot_id к записи в БД.
 *
 * Два режима:
 *   • Без txHash: только базовая проверка через getLotCount() — лот должен
 *     существовать (contractLotId < lotCount).
 *   • С txHash: глубокая проверка — парсим receipt, ищем событие LotCreated
 *     с этим lotId, сверяем gemCost/sharePrice/totalShares с БД.
 *
 * @param {object} args
 * @param {number} args.contractLotId        — ID лота в контракте
 * @param {string|null} args.txHash          — хэш транзакции createLot (опционально)
 * @param {number|null} args.expectedGemCost — ожидаемая закупка камня (USDT, обычные единицы)
 * @param {number|null} args.expectedSharePrice — ожидаемая цена доли ($25/$50/$100)
 * @param {number|null} args.expectedTotalShares — ожидаемое количество долей
 * @returns {Promise<{ok: boolean, error?: string, verified?: string}>}
 */
export async function verifyClubLotsCreation({
  contractLotId,
  txHash = null,
  expectedGemCost = null,
  expectedSharePrice = null,
  expectedTotalShares = null,
}) {
  // Базовая валидация
  if (contractLotId === undefined || contractLotId === null || isNaN(parseInt(contractLotId))) {
    return { ok: false, error: 'Не указан contract_lot_id' }
  }
  const cLotId = parseInt(contractLotId)
  if (cLotId < 0) {
    return { ok: false, error: 'contract_lot_id не может быть отрицательным' }
  }

  const clubLotsAddr = (ADDRESSES.ClubLots || '').toLowerCase()
  if (!clubLotsAddr || clubLotsAddr.startsWith('0x_')) {
    return { ok: false, error: 'Адрес контракта ClubLots не настроен на сервере' }
  }

  try {
    const { ethers } = await import('ethers')
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const clubLots = new ethers.Contract(clubLotsAddr, CLUBLOTS_VIEW_FRAGMENT, provider)

    // ─── Шаг 1: проверка что лот существует через getLotCount() ───
    const lotCount = await withTimeout(clubLots.getLotCount(), RPC_TIMEOUT_MS, 'getLotCount()')
    const lotCountNum = Number(lotCount)
    if (cLotId >= lotCountNum) {
      return {
        ok: false,
        error: `Лот #${cLotId} не существует в контракте (всего создано: ${lotCountNum})`
      }
    }

    // ─── Шаг 2: если есть txHash — глубокая проверка ───
    if (txHash) {
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return { ok: false, error: 'Неверный формат contractTxHash' }
      }

      const receipt = await withTimeout(
        provider.getTransactionReceipt(txHash),
        RPC_TIMEOUT_MS,
        'getTransactionReceipt(create)'
      )

      if (!receipt) {
        return { ok: false, error: 'Транзакция создания лота не подтверждена или не существует' }
      }
      if (receipt.status !== 1) {
        return { ok: false, error: 'Транзакция создания лота reverted' }
      }
      const txTo = (receipt.to || '').toLowerCase()
      if (txTo !== clubLotsAddr) {
        return { ok: false, error: 'Транзакция создания не относится к контракту ClubLots' }
      }

      // Ищем событие LotCreated с нашим lotId
      const iface = new ethers.Interface(LOT_CREATED_EVENT)
      const expectedLotId = BigInt(cLotId)

      let matched = null
      for (const log of (receipt.logs || [])) {
        if ((log.address || '').toLowerCase() !== clubLotsAddr) continue
        let parsed
        try {
          parsed = iface.parseLog({ topics: log.topics, data: log.data })
        } catch {
          continue
        }
        if (!parsed || parsed.name !== 'LotCreated') continue
        if (BigInt(parsed.args.lotId) !== expectedLotId) continue
        matched = parsed
        break
      }

      if (!matched) {
        return {
          ok: false,
          error: `В транзакции нет события LotCreated с lotId=${cLotId}`
        }
      }

      // Сверка параметров с БД (если они переданы)
      if (expectedGemCost !== null && expectedGemCost !== undefined) {
        const expectedWei = await usdtToWei(expectedGemCost)
        if (!weiEqualWithTolerance(matched.args.gemCost, expectedWei)) {
          const onChain = (Number(matched.args.gemCost) / 1e18).toFixed(2)
          return {
            ok: false,
            error: `gemCost не совпадает: в БД $${expectedGemCost}, в контракте $${onChain}`
          }
        }
      }

      if (expectedSharePrice !== null && expectedSharePrice !== undefined) {
        const expectedWei = await usdtToWei(expectedSharePrice)
        if (!weiEqualWithTolerance(matched.args.sharePrice, expectedWei)) {
          const onChain = (Number(matched.args.sharePrice) / 1e18).toFixed(2)
          return {
            ok: false,
            error: `sharePrice не совпадает: в БД $${expectedSharePrice}, в контракте $${onChain}`
          }
        }
      }

      if (expectedTotalShares !== null && expectedTotalShares !== undefined) {
        const onChainShares = BigInt(parseInt(matched.args.totalShares.toString()))
        const expectedShares = BigInt(parseInt(expectedTotalShares))
        if (onChainShares !== expectedShares) {
          return {
            ok: false,
            error: `totalShares не совпадает: в БД ${expectedTotalShares}, в контракте ${onChainShares.toString()}`
          }
        }
      }

      return {
        ok: true,
        verified: 'tx-deep-check',
        gemCostWei: matched.args.gemCost.toString(),
        sharePriceWei: matched.args.sharePrice.toString(),
        totalShares: Number(matched.args.totalShares),
      }
    }

    // Без txHash — только проверка существования
    return { ok: true, verified: 'lot-exists-only' }
  } catch (err) {
    console.error('verifyClubLotsCreation error:', err?.message || err)
    return { ok: false, error: 'Не удалось проверить контракт (RPC недоступен или таймаут)' }
  }
}
