/**
 * verifyPurchase.js — Серверная проверка транзакции покупки долей в блокчейне
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

// Фрагмент ABI — только нужное нам событие
const SHARE_PURCHASED_EVENT = [
  'event SharePurchased(uint256 indexed lotId, address indexed buyer, uint16 count, uint256 usdtAmount, bool fromBalance)'
]

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

    // Получаем квитанцию транзакции
    const receipt = await provider.getTransactionReceipt(txHash)

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
