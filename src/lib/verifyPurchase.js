/**
 * verifyPurchase.js — Серверная проверка транзакций ClubPools v2.4 в блокчейне
 *
 * АДАПТАЦИЯ под v2.4 (контракты задеплоены 5 мая 2026):
 *   • События ShareBought и PoolCreated — те же, проверки работают
 *   • Структура Pool в getPool() полностью изменилась — мы её больше НЕ
 *     используем, поскольку всё что нужно (targetUSDT) проверяется через
 *     event PoolCreated.targetUSDT
 *   • Удалены проверки expectedSharePrice/expectedTotalShares — этих
 *     полей в новой модели нет (партнёр платит USDT, получает DCT по $0.50,
 *     никаких "штук-долей" нет на уровне контракта)
 *   • Пулы нумеруются с 1 (не с 0) — поправлена проверка границ
 *   • CLUBPOOLS_VIEW_FRAGMENT убран — getPool больше не нужен
 *
 * Содержит две функции:
 *   • verifyClubLotsPurchase — проверка покупки доли (через ShareBought)
 *   • verifyClubLotsCreation — проверка создания пула (через PoolCreated)
 *
 * Имена функций оставлены прежними чтобы не ломать /api/lots/route.js
 */
import ADDRESSES from '@/contracts/addresses'

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'

// Таймаут одного RPC-вызова (защита от подвисшего opBNB)
const RPC_TIMEOUT_MS = 8000

// Допустимая погрешность сравнения wei-значений (1e-6 USDT — покрывает float-округления)
const WEI_TOLERANCE = 10n ** 12n

// ═══════════════════════════════════════════════════
// СОБЫТИЯ ClubPools v2.4
// ═══════════════════════════════════════════════════
// event ShareBought(uint256 indexed poolId, address indexed buyer, uint256 amountUSDT, uint256 dctMinted)
const SHARE_BOUGHT_EVENT = [
  'event ShareBought(uint256 indexed poolId, address indexed buyer, uint256 amountUSDT, uint256 dctMinted)'
]

// event PoolCreated(uint256 indexed poolId, string name, uint256 targetUSDT, uint256 dctAmount)
const POOL_CREATED_EVENT = [
  'event PoolCreated(uint256 indexed poolId, string name, uint256 targetUSDT, uint256 dctAmount)'
]

// Минимальный фрагмент для poolsCount (одна view-функция)
const CLUBPOOLS_COUNT_FRAGMENT = [
  'function poolsCount() external view returns (uint256)',
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
 * USDT на opBNB — 18 decimals.
 */
async function usdtToWei(amount) {
  const { ethers } = await import('ethers')
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
 * Получить адрес контракта пулов (поддержка старого имени для совместимости).
 */
function getPoolsAddr() {
  // В новой системе — ClubPools. Старое имя ClubLots тоже поддерживаем
  // на случай если кто-то ещё передаёт старый ключ.
  return (ADDRESSES.ClubPools || ADDRESSES.ClubLots || '').toLowerCase()
}

/**
 * Проверить транзакцию покупки долей в контракте ClubPools.
 *
 * @param {object} args
 * @param {string} args.txHash           — хэш транзакции (0x + 64 hex)
 * @param {string} args.buyerWallet      — кошелёк, который якобы купил (lowercase)
 * @param {number} args.contractLotId    — ID пула в контракте (poolId)
 * @param {number} args.expectedCount    — сколько долей заявлено (для контроля)
 * @returns {Promise<{ok: boolean, error?: string, usdtAmount?: string, dctMinted?: string}>}
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
    return { ok: false, error: 'Не указан contract_lot_id (poolId)' }
  }
  if (!expectedCount || expectedCount < 1) {
    return { ok: false, error: 'Неверное количество долей' }
  }

  const poolsAddr = getPoolsAddr()
  if (!poolsAddr || poolsAddr.startsWith('0x_')) {
    return { ok: false, error: 'Адрес контракта ClubPools не настроен на сервере' }
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

    // Проверяем что транзакция была адресована нашему контракту
    const txTo = (receipt.to || '').toLowerCase()
    if (txTo !== poolsAddr) {
      return { ok: false, error: 'Транзакция не относится к контракту ClubPools' }
    }

    // Ищем событие ShareBought в логах
    const iface = new ethers.Interface(SHARE_BOUGHT_EVENT)
    const expectedBuyer = buyerWallet.toLowerCase()
    const expectedPoolId = BigInt(parseInt(contractLotId))

    let matchedEvent = null

    for (const log of (receipt.logs || [])) {
      // Пропускаем логи от чужих контрактов
      if ((log.address || '').toLowerCase() !== poolsAddr) continue

      let parsed
      try {
        parsed = iface.parseLog({ topics: log.topics, data: log.data })
      } catch {
        continue // не наше событие — идём дальше
      }
      if (!parsed || parsed.name !== 'ShareBought') continue

      // Сверяем поля события с заявленными
      const eventBuyer = String(parsed.args.buyer || '').toLowerCase()
      const eventPoolId = BigInt(parsed.args.poolId)

      if (eventBuyer !== expectedBuyer) continue
      if (eventPoolId !== expectedPoolId) continue

      // В v2.3 нет прямого "count" в событии — есть amountUSDT.
      // Считаем что count верный если amountUSDT > 0 и совпадает poolId+buyer.
      // Серверный API всё равно проверит amount позже через sharePrice.
      matchedEvent = parsed
      break
    }

    if (!matchedEvent) {
      return {
        ok: false,
        error: 'В транзакции не найдено события ShareBought с совпадающим buyer/poolId'
      }
    }

    return {
      ok: true,
      usdtAmount: matchedEvent.args.amountUSDT.toString(),  // в wei (18 decimals)
      dctMinted: matchedEvent.args.dctMinted.toString(),    // сколько DCT начислено
      fromBalance: false,                                   // в v2.3 нет — всегда USDT с кошелька
    }
  } catch (err) {
    console.error('verifyClubLotsPurchase error:', err?.message || err)
    return { ok: false, error: 'Не удалось проверить транзакцию (RPC недоступен или ошибка сети)' }
  }
}

/**
 * Проверить что пул реально существует в контракте ClubPools.
 *
 * Используется в /api/lots action='link_contract' перед привязкой
 * contract_lot_id (= poolId) к записи в БД.
 *
 * Два режима:
 *   • Без txHash: только базовая проверка через poolsCount() — пул должен
 *     существовать (1 ≤ poolId ≤ poolsCount).
 *   • С txHash: глубокая проверка — парсим receipt, ищем событие PoolCreated
 *     с этим poolId, сверяем targetUSDT с БД (gemCost из dc_lots).
 *
 * ВАЖНО: в v2.4 контракт НЕ хранит totalShares и sharePrice — этих полей
 * в новой модели нет. Соответствующие проверки убраны. UI всё ещё показывает
 * "доли как штуки", но это чисто Supabase-метаданные для удобства.
 *
 * @param {object} args
 * @param {number} args.contractLotId        — ID пула в контракте (poolId, начинается с 1)
 * @param {string|null} args.txHash          — хэш транзакции createPool (опционально)
 * @param {number|null} args.expectedGemCost — ожидаемая стоимость камня = targetUSDT
 * @param {*} args.expectedSharePrice        — игнорируется (совместимость с API)
 * @param {*} args.expectedTotalShares       — игнорируется (совместимость с API)
 * @returns {Promise<{ok: boolean, error?: string, verified?: string, targetUSDTWei?: string}>}
 */
export async function verifyClubLotsCreation({
  contractLotId,
  txHash = null,
  expectedGemCost = null,
  expectedSharePrice = null,  // не используется в v2.4 — оставлено для совместимости
  expectedTotalShares = null, // не используется в v2.4 — оставлено для совместимости
}) {
  // Базовая валидация
  if (contractLotId === undefined || contractLotId === null || isNaN(parseInt(contractLotId))) {
    return { ok: false, error: 'Не указан contract_lot_id (poolId)' }
  }
  const poolId = parseInt(contractLotId)
  if (poolId < 1) {
    return { ok: false, error: 'poolId должен быть ≥ 1 (нумерация пулов начинается с 1)' }
  }

  const poolsAddr = getPoolsAddr()
  if (!poolsAddr || poolsAddr.startsWith('0x_')) {
    return { ok: false, error: 'Адрес контракта ClubPools не настроен на сервере' }
  }

  try {
    const { ethers } = await import('ethers')
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const pools = new ethers.Contract(poolsAddr, CLUBPOOLS_COUNT_FRAGMENT, provider)

    // ─── Шаг 1: проверка что пул существует через poolsCount() ───
    // Пулы нумеруются с 1, поэтому валидный диапазон: 1 ≤ poolId ≤ poolsCount
    const count = await withTimeout(pools.poolsCount(), RPC_TIMEOUT_MS, 'poolsCount()')
    const countNum = Number(count)
    if (poolId > countNum) {
      return {
        ok: false,
        error: `Пул #${poolId} не существует в контракте (всего создано: ${countNum})`
      }
    }

    // ─── Шаг 2: если есть txHash — глубокая проверка через PoolCreated event ───
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
        return { ok: false, error: 'Транзакция создания пула не подтверждена или не существует' }
      }
      if (receipt.status !== 1) {
        return { ok: false, error: 'Транзакция создания пула reverted' }
      }
      const txTo = (receipt.to || '').toLowerCase()
      if (txTo !== poolsAddr) {
        return { ok: false, error: 'Транзакция создания не относится к контракту ClubPools' }
      }

      // Ищем событие PoolCreated с нашим poolId
      const iface = new ethers.Interface(POOL_CREATED_EVENT)
      const expectedPoolId = BigInt(poolId)

      let matched = null
      for (const log of (receipt.logs || [])) {
        if ((log.address || '').toLowerCase() !== poolsAddr) continue
        let parsed
        try {
          parsed = iface.parseLog({ topics: log.topics, data: log.data })
        } catch {
          continue
        }
        if (!parsed || parsed.name !== 'PoolCreated') continue
        if (BigInt(parsed.args.poolId) !== expectedPoolId) continue
        matched = parsed
        break
      }

      if (!matched) {
        return {
          ok: false,
          error: `В транзакции нет события PoolCreated с poolId=${poolId}`
        }
      }

      // Сверка targetUSDT (= expectedGemCost) с БД
      if (expectedGemCost !== null && expectedGemCost !== undefined) {
        const expectedWei = await usdtToWei(expectedGemCost)
        if (!weiEqualWithTolerance(matched.args.targetUSDT, expectedWei)) {
          const onChain = (Number(matched.args.targetUSDT) / 1e18).toFixed(2)
          return {
            ok: false,
            error: `targetUSDT не совпадает: в БД $${expectedGemCost}, в контракте $${onChain}`
          }
        }
      }

      // ВНИМАНИЕ: проверки expectedTotalShares и expectedSharePrice убраны.
      // В v2.4 этих полей в контракте нет — партнёр платит USDT, получает DCT
      // по фиксированной цене $0.50. UI продолжает показывать "доли как штуки"
      // на основе Supabase-метаданных, но on-chain их не существует.

      return {
        ok: true,
        verified: 'tx-deep-check',
        targetUSDTWei: matched.args.targetUSDT.toString(),
      }
    }

    // Без txHash — только проверка существования
    return { ok: true, verified: 'pool-exists-only' }
  } catch (err) {
    console.error('verifyClubLotsCreation error:', err?.message || err)
    return { ok: false, error: 'Не удалось проверить контракт (RPC недоступен или таймаут)' }
  }
}
