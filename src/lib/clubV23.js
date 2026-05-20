'use client'
/**
 * Diamond Club v2.4 — Unified Contract Service Layer
 * ═══════════════════════════════════════════════════════
 *
 * ПОЛНАЯ ПЕРЕРАБОТКА (для контрактов v2.4 от 5 мая 2026)
 *
 * Что изменилось vs предыдущая версия:
 *  1. ABI больше не пишется руками — берётся из src/contracts/abi/*.json
 *     (это настоящие ABI скомпилированные из контрактов).
 *  2. Модель пулов изменилась: НЕТ "долей как штук" (shares), есть
 *     "сумма USDT" — партнёр платит amountUSDT и получает DCT по $0.50.
 *  3. Структуры Pool/Item/Escrow/Proposal — новые. Адаптеры маппят их
 *     к привычным полям UI чтобы компоненты ломать минимально.
 *  4. NSS купоны — новая структура DiscountCoupon (требует backend gws.ink).
 *  5. buyItemWithDCT теперь требует poolId (из какого пула тратить DCT).
 *
 * USDT на opBNB = 18 decimals (НЕ 6) — используем formatEther / parseEther.
 *
 * Все функции импортируются как:
 *   import * as Club from '@/lib/clubV23'
 */
import { ethers } from 'ethers'
import web3 from './web3'
import ADDRESSES from '@/contracts/addresses'

// ═══════════════════════════════════════════════════════
// ABI — берём из настоящих JSON файлов
// ═══════════════════════════════════════════════════════
import ClubDCTArtifact from '@/contracts/abi/ClubDCT.json'
import ClubPoolsArtifact from '@/contracts/abi/ClubPools.json'
import ClubMarketArtifact from '@/contracts/abi/ClubMarket.json'
import ClubMarketingArtifact from '@/contracts/abi/ClubMarketing.json'
import ClubDirectorsArtifact from '@/contracts/abi/ClubDirectors.json'

// JSON файлы могут быть массивом ABI или объектом {abi: [...]}
function unwrapAbi(artifact) {
  if (Array.isArray(artifact)) return artifact
  if (artifact?.abi) return artifact.abi
  return artifact?.default?.abi || artifact?.default || []
}

const CLUBDCT_ABI       = unwrapAbi(ClubDCTArtifact)
const CLUBPOOLS_ABI     = unwrapAbi(ClubPoolsArtifact)
const CLUBMARKET_ABI    = unwrapAbi(ClubMarketArtifact)
const CLUBMARKETING_ABI = unwrapAbi(ClubMarketingArtifact)
const CLUBDIRECTORS_ABI = unwrapAbi(ClubDirectorsArtifact)

const USDT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

// ═══════════════════════════════════════════════════════
// READ PROVIDER (RPC без кошелька)
// ═══════════════════════════════════════════════════════
const READ_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'
const readProvider = new ethers.JsonRpcProvider(READ_RPC)

// ═══════════════════════════════════════════════════════
// УТИЛИТЫ ФОРМАТИРОВАНИЯ (USDT и DCT — оба 18 decimals)
// ═══════════════════════════════════════════════════════
const fmt = (v) => {
  try { return ethers.formatEther(v ?? 0n) } catch { return '0' }
}
const parse = (v) => {
  try { return ethers.parseEther(String(v ?? 0)) } catch { return 0n }
}
// Алиасы для совместимости (раньше различались 6/18 decimals)
const fmt6 = fmt
const parse6 = parse

// Безопасный Number() из BigInt
const num = (v) => { try { return Number(v ?? 0) } catch { return 0 } }

// ═══════════════════════════════════════════════════════
// CONTRACT FACTORIES
// ═══════════════════════════════════════════════════════
function getContract(name, abi) {
  if (!web3.signer) throw new Error('Кошелёк не подключён')
  const addr = ADDRESSES[name]
  if (!addr || addr.startsWith('0x_')) throw new Error(`${name} не задеплоен`)
  return new ethers.Contract(addr, abi, web3.signer)
}

function getReadContract(name, abi) {
  const addr = ADDRESSES[name]
  if (!addr || addr.startsWith('0x_')) return null
  return new ethers.Contract(addr, abi, readProvider)
}

function getUSDT() {
  return new ethers.Contract(ADDRESSES.USDT, USDT_ABI, web3.signer)
}

function getUSDTRead() {
  return new ethers.Contract(ADDRESSES.USDT, USDT_ABI, readProvider)
}

// ═══════════════════════════════════════════════════════
// ALLOWANCE — проверка и approve если нужно
// ═══════════════════════════════════════════════════════
async function ensureUSDTApproval(spender, amountWei) {
  if (!web3.address) throw new Error('Адрес не определён')
  const usdt = getUSDT()
  const current = await usdt.allowance(web3.address, spender)
  if (current < amountWei) {
    const tx = await usdt.approve(spender, amountWei)
    await tx.wait()
  }
}

async function ensureDCTApproval(spender, amountWei) {
  if (!web3.address) throw new Error('Адрес не определён')
  const dct = getContract('ClubDCT', CLUBDCT_ABI)
  const current = await dct.allowance(web3.address, spender)
  if (current < amountWei) {
    const tx = await dct.approve(spender, amountWei)
    await tx.wait()
  }
}

// ═══════════════════════════════════════════════════════
// USDT — баланс кошелька
// ═══════════════════════════════════════════════════════
export async function getUSDTBalance(address) {
  if (!address) return '0'
  try {
    const usdt = getUSDTRead()
    return fmt(await usdt.balanceOf(address))
  } catch { return '0' }
}

// ═══════════════════════════════════════════════════════
// CLUB DCT — токен Diamond Club
// ═══════════════════════════════════════════════════════

export async function getDCTBalance(address) {
  const c = getReadContract('ClubDCT', CLUBDCT_ABI)
  if (!c || !address) return '0'
  try { return fmt(await c.balanceOf(address)) } catch { return '0' }
}

export async function getDCTUserInfo(address) {
  const c = getReadContract('ClubDCT', CLUBDCT_ABI)
  if (!c || !address) return null
  try {
    const [total, frozen, unlocked, holdingsCount] = await Promise.all([
      c.balanceOf(address),
      c.getFrozenBalance(address),
      c.getUnlockedBalance(address),
      c.getHoldingsCount(address),
    ])
    return {
      total: fmt(total),
      // Алиасы старых имён для совместимости с компонентами
      locked: fmt(frozen),
      free: fmt(unlocked),
      // Новые правильные имена
      frozen: fmt(frozen),
      unlocked: fmt(unlocked),
      holdingsCount: num(holdingsCount),
    }
  } catch { return null }
}

/**
 * Возвращает все холдинги пользователя (DCT привязанные к пулам).
 * Адаптер: контракт даёт {amount, poolId, mintedAt, unlocksAt},
 * UI ожидает {poolId, amount, unlocksAt} — добавляем mintedAt бонусом.
 */
export async function getDCTHoldings(address) {
  const c = getReadContract('ClubDCT', CLUBDCT_ABI)
  if (!c || !address) return []
  try {
    const all = await c.getAllHoldings(address)
    const now = Math.floor(Date.now() / 1000)
    return all.map(h => {
      const unlocksAt = num(h.unlocksAt)
      return {
        poolId: num(h.poolId),
        amount: fmt(h.amount),
        amountWei: h.amount,           // BigInt — пригодится для расчётов
        mintedAt: num(h.mintedAt),
        unlocksAt,
        // Удобные флаги для UI
        isUnlocked: unlocksAt <= now,
        secondsToUnlock: Math.max(0, unlocksAt - now),
      }
    }).filter(h => h.amount !== '0')   // пустые холдинги (после burn) скрываем
  } catch (e) {
    console.error('getDCTHoldings:', e?.message || e)
    return []
  }
}

export async function getDCTHoldingsByPool(address, poolId) {
  const c = getReadContract('ClubDCT', CLUBDCT_ABI)
  if (!c || !address) return '0'
  try { return fmt(await c.getHoldingsByPool(address, poolId)) } catch { return '0' }
}

export async function getDCTTokenInfo() {
  const c = getReadContract('ClubDCT', CLUBDCT_ABI)
  if (!c) return null
  try {
    const supply = await c.totalSupply()
    return { totalSupply: fmt(supply) }
  } catch { return null }
}

// ═══════════════════════════════════════════════════════
// CLUB POOLS — пулы и доли
// ═══════════════════════════════════════════════════════

export async function getPoolsCount() {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c) return 0
  try { return num(await c.poolsCount()) } catch { return 0 }
}

/**
 * Получить пул и адаптировать к привычной для UI структуре.
 *
 * Контракт возвращает:
 *   { id, name, targetUSDT, raisedUSDT, treasuryUSDT, totalDCT, status,
 *     createdAt, unlocksAt, cyclesCompleted, currentItemId, metaUrl }
 *
 * UI исторически ждёт ещё и:
 *   collectedUSDT, sharePrice, minGWLevel, deadline, redeemUnlocksAt,
 *   itemId, saleAmount, creator, totalShares, sharesSold, progress
 *
 * Мы возвращаем оба набора имён — UI не сломается, а новые имена доступны.
 */
export async function getPool(poolId) {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c) return null
  try {
    const p = await c.getPool(poolId)

    const targetWei  = p.targetUSDT
    const raisedWei  = p.raisedUSDT
    const treasWei   = p.treasuryUSDT
    const dctTotalW  = p.totalDCT

    // Прогресс сбора (0-100)
    const progress = targetWei > 0n
      ? Number((raisedWei * 10000n) / targetWei) / 100
      : 0

    // Текущая цена 1 DCT в пуле (в USDT 18 decimals)
    // = treasury * 1e18 / totalDCT
    const dctPriceWei = dctTotalW > 0n
      ? (treasWei * 10n ** 18n) / dctTotalW
      : 5n * 10n ** 17n   // дефолт $0.50 пока пул пуст
    const dctPrice = fmt(dctPriceWei)

    return {
      // ─── Новые правильные поля ───
      poolId: num(p.id),
      id: num(p.id),
      name: p.name,
      targetUSDT: fmt(targetWei),
      targetWei,
      raisedUSDT: fmt(raisedWei),
      raisedWei,
      treasuryUSDT: fmt(treasWei),
      treasuryWei: treasWei,
      totalDCT: fmt(dctTotalW),
      totalDCTWei: dctTotalW,
      status: num(p.status),  // 0=Open, 1=Funded, 2=InGem, 3=Cycling, 4=Frozen, 5=Unlocked, 6=Cancelled, 7=Drained
      createdAt: num(p.createdAt),
      unlocksAt: num(p.unlocksAt),
      cyclesCompleted: num(p.cyclesCompleted),
      currentItemId: num(p.currentItemId),
      metaUrl: p.metaUrl,
      progress,
      currentDCTPrice: dctPrice,
      currentDCTPriceWei: dctPriceWei,
      // Удобства
      isOpen: num(p.status) === 0,
      isInGem: num(p.status) === 2,
      isUnlocked: num(p.status) === 5 || Date.now()/1000 >= num(p.unlocksAt),

      // ─── Алиасы для старого UI ───
      collectedUSDT: fmt(raisedWei),
      sharePrice: '0.5',                  // фикс цена DCT при покупке
      minGWLevel: 7,                      // глобальная константа
      deadline: 0,                        // нет дедлайна в новой модели
      redeemUnlocksAt: num(p.unlocksAt),
      itemId: num(p.currentItemId),
      saleAmount: '0',
      creator: '',
      totalShares: 0,                     // в новой модели нет
      sharesSold: 0,
    }
  } catch (e) {
    console.error('getPool:', poolId, e?.message || e)
    return null
  }
}

/**
 * Все пулы (для витрины). Параллельно читаем чтобы быстрее.
 * ВНИМАНИЕ: в контракте пулы нумеруются с 1, не с 0.
 */
export async function getAllPools() {
  const count = await getPoolsCount()
  if (count === 0) return []
  const ids = []
  for (let i = 1; i <= count; i++) ids.push(i)
  const results = await Promise.all(ids.map(id => getPool(id)))
  return results.filter(Boolean)
}

export async function getCurrentDCTPrice(poolId) {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c) return '0'
  try { return fmt(await c.getCurrentDCTPrice(poolId)) } catch { return '0' }
}

export async function getUserInvestment(address, poolId) {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c || !address) return '0'
  try { return fmt(await c.getUserInvestment(address, poolId)) } catch { return '0' }
}

export async function getReserveBalance() {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c) return '0'
  try { return fmt(await c.getReserveBalance()) } catch { return '0' }
}

/**
 * Купить долю в пуле.
 *
 * НОВАЯ СИГНАТУРА: amountUSDT — сумма в USDT (число или строка, не wei).
 * Партнёр получит DCT по фиксированной цене $0.50:
 *   dctMinted = amountUSDT × 2
 *
 * СТАРЫЙ UI передавал sharesCount (1, 2, 3) — это явно не USDT-сумма.
 * Поэтому делаем умный fallback: если значение < 100 и в Supabase есть
 * share_price для этого пула — это старый вызов, конвертируем.
 *
 * Лучше всего: переделай UI на input "сумма USDT" вместо "количество долей".
 * Пока что — обратная совместимость.
 *
 * @param {number} poolId — ID пула
 * @param {number|string} amountUSDT — сумма USDT (например 1000 = $1000)
 */
export async function buyShare(poolId, amountUSDT) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)

  // Защита от случайной передачи sharesCount вместо USDT
  // В новой модели $1 — минимум, ниже не имеет смысла
  const value = parseFloat(amountUSDT)
  if (!value || value <= 0) {
    throw new Error('Укажите сумму USDT больше 0')
  }
  if (value > 0 && value < 1) {
    throw new Error('Минимальная сумма $1 USDT')
  }

  const amountWei = parse(value)

  // Approve USDT перед покупкой
  await ensureUSDTApproval(ADDRESSES.ClubPools, amountWei)

  const tx = await c.buyShare(poolId, amountWei)
  return await tx.wait()
}

/**
 * P2P — выставить ВСЮ свою долю в пуле на продажу
 * @param {number} poolId
 * @param {number|string} priceUSDT — желаемая цена за всю долю
 */
export async function listShareForSaleP2P(poolId, priceUSDT) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.listShareForSale(poolId, parse(priceUSDT))
  return await tx.wait()
}

/**
 * P2P — купить чужую долю
 */
export async function buyShareP2P(offerId) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const cRead = getReadContract('ClubPools', CLUBPOOLS_ABI)

  // Узнаём цену оффера чтобы сделать approve
  const offer = await cRead.shareOffers(offerId)
  // shareOffers возвращает: poolId, seller, priceUSDT, dctAmount, status, createdAt
  const priceWei = offer[2] ?? offer.priceUSDT
  if (!priceWei || priceWei === 0n) throw new Error('Оффер не существует')

  await ensureUSDTApproval(ADDRESSES.ClubPools, priceWei)
  const tx = await c.buyShareP2P(offerId)
  return await tx.wait()
}

export async function cancelP2POffer(offerId) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.cancelOffer(offerId)
  return await tx.wait()
}

/**
 * Список всех P2P-офферов (для витрины P2P).
 */
export async function getAllP2POffers() {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c) return []
  try {
    const count = num(await c.offersCount())
    const offers = []
    for (let i = 1; i <= count; i++) {
      const o = await c.shareOffers(i)
      const status = num(o[4])
      // 0=Open, 1=Sold, 2=Cancelled
      offers.push({
        offerId: i,
        poolId: num(o[0]),
        seller: o[1],
        priceUSDT: fmt(o[2]),
        priceWei: o[2],
        dctAmount: fmt(o[3]),
        status,
        isOpen: status === 0,
        createdAt: num(o[5]),
      })
    }
    return offers
  } catch (e) {
    console.error('getAllP2POffers:', e?.message || e)
    return []
  }
}

/**
 * Redeem — обмен DCT на USDT по реальной цене пула (после разморозки).
 * Контракт поддерживает только полный redeem (всё что есть в пуле).
 */
export async function redeem(poolId, dctAmount) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const dctWei = parse(dctAmount)
  // approve не нужен — контракт сам сжигает свои DCT (внутренний burn)
  const tx = await c.redeem(poolId, dctWei)
  return await tx.wait()
}

/**
 * Защитный выкуп по $0.56 (если реальная цена пула ниже).
 */
export async function redeemAtFloor(poolId) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.redeemAtFloor(poolId)
  return await tx.wait()
}

/**
 * Аварийная защита Уровень 1 — забрать USDT если пул мёртв 90 дней
 */
export async function claimInactivePool(poolId) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.claimInactivePool(poolId)
  return await tx.wait()
}

/**
 * Аварийная защита Уровень 3 — забрать USDT после Drained
 */
export async function claimDrainedPool(poolId) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.claimDrainedPool(poolId)
  return await tx.wait()
}

// ═══════════════════════════════════════════════════════
// CLUB POOLS — АДМИН
// ═══════════════════════════════════════════════════════

/**
 * Создать пул (новая правильная сигнатура).
 *
 * @param {string} name — название пула
 * @param {number|string} targetUSDT — цель сбора в USDT
 * @param {string} metaUrl — IPFS/HTTP URL с фотками+метаданными
 * @param {number} minLevel — минимальный уровень GlobalWay для участия (0-255, uint8)
 * @returns {Promise<{poolId: number, receipt: object}>} ID созданного пула + квитанция
 */
export async function createPool(name, targetUSDT, metaUrl = '', minLevel = 4) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  // ★ ФИКС: ABI ClubPools.createPool принимает 4 параметра:
  // (string name, uint256 targetUSDT, string metaUrl, uint8 minLevel).
  // Раньше передавали 3 — ethers падал с "no matching fragment".
  // minLevel — uint8, ограничиваем диапазон чтобы не уронить транзакцию.
  const ml = Math.max(0, Math.min(255, parseInt(minLevel) || 4))
  const tx = await c.createPool(String(name), parse(targetUSDT), String(metaUrl || ''), ml)
  const receipt = await tx.wait()

  // Парсим event PoolCreated чтобы получить присвоенный poolId
  // event PoolCreated(uint256 indexed poolId, string name, uint256 targetUSDT, uint256 dctAmount)
  let poolId = null
  try {
    const iface = new ethers.Interface(CLUBPOOLS_ABI)
    const poolsAddrLower = ADDRESSES.ClubPools.toLowerCase()
    for (const log of (receipt.logs || [])) {
      if ((log.address || '').toLowerCase() !== poolsAddrLower) continue
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data })
        if (parsed && parsed.name === 'PoolCreated') {
          poolId = num(parsed.args.poolId)
          break
        }
      } catch {}
    }
  } catch (e) {
    console.warn('createPool: не удалось распарсить poolId из event:', e?.message)
  }

  // Fallback: если не удалось достать из event — берём poolsCount (последний созданный)
  if (poolId === null) {
    try {
      const cRead = getReadContract('ClubPools', CLUBPOOLS_ABI)
      poolId = num(await cRead.poolsCount())
    } catch {}
  }

  return { poolId, receipt }
}

/**
 * АЛИАС старого имени для совместимости с LotsAdmin.
 * Старый вызов: createLotOnChain(targetUSDT, sharePrice, minGwLevel, secret, opts{name, fundraisingDays})
 *
 * В новой модели sharePrice/secret/fundraisingDays игнорируются —
 * они задаются константами в контракте. Передаём name + targetUSDT + metaUrl + minGwLevel.
 *
 * @returns {Promise<{poolId: number, receipt: object}>} — для совместимости с LotsAdmin
 */
export async function createLotOnChain(targetUSDT, sharePrice, minGwLevel, secret, opts = {}) {
  const name = opts.name || `Pool ${Date.now()}`
  const metaUrl = opts.metaUrl || opts.photoUrl || ''
  return await createPool(name, targetUSDT, metaUrl, minGwLevel)
}

/**
 * Записать что камень для пула куплен (после off-chain платежа заводу).
 * @param {number} poolId
 * @param {number} itemId — ID камня в ClubMarket (надо получить из listGemFromPool)
 * @param {number|string} cost — себестоимость в USDT
 */
export async function recordGemPurchased(poolId, itemId, cost) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.recordGemPurchased(poolId, itemId, parse(cost))
  return await tx.wait()
}

/**
 * Перевод USDT с контракта на одобренный завод (для off-chain закупки).
 * Только owner. Адрес должен быть заранее в whitelist (addFactory от multisig).
 */
export async function withdrawForGemPurchase(toFactory, amountUSDT) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.withdrawForGemPurchase(toFactory, parse(amountUSDT))
  return await tx.wait()
}

export async function isApprovedFactory(addr) {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c || !addr) return false
  try { return await c.approvedFactories(addr) } catch { return false }
}

// ═══════════════════════════════════════════════════════
// V2.6: УЧЁТ ЗАКУПКИ КАМНЕЙ ПО СУММЕ
// ═══════════════════════════════════════════════════════

/**
 * v2.6: Записать закупку камня по сумме (без itemId).
 * Списывает amount с treasury пула, добавляет к costBasis, статус → InGem.
 * Можно вызывать многократно для одного пула (если докупаем).
 * @param {number} poolId
 * @param {number|string} amount — сумма закупки USDT
 */
export async function recordPurchase(poolId, amount) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.recordPurchase(poolId, parse(amount))
  return await tx.wait()
}

// ═══════════════════════════════════════════════════════
// V2.6: ДВУХФАЗНАЯ ПРОДАЖА
// ═══════════════════════════════════════════════════════

/**
 * v2.6 Фаза А: Записать продажу — фиксирует долги БЕЗ движения денег.
 * Owner сам держит деньги до payObligations.
 * Создаёт SaleRecord, даёт 14 дней на оплату обязательств.
 * 
 * @param {number} poolId
 * @param {number|string} saleAmount — полная сумма продажи USDT
 * @param {number|string} costPart — закупочная цена этой партии USDT (списывается с costBasis)
 * @returns {Promise<object>} receipt с saleId в events
 */
export async function recordSaleAccounting(poolId, saleAmount, costPart) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.recordSaleAccounting(
    poolId, 
    parse(saleAmount), 
    parse(costPart)
  )
  return await tx.wait()
}

/**
 * v2.6 Фаза Б: Оплатить обязательства (~25% от прибыли).
 * Заводит ТОЛЬКО obligationsTotal на контракт (маркетинг + реклама + резерв).
 * Остальные 75% backing остаются у тебя (виртуально учитываются для роста цены DCT).
 * 
 * Перед вызовом делает USDT.approve автоматически.
 * 
 * @param {number} saleId — ID записи продажи (из recordSaleAccounting)
 */
export async function payObligations(saleId) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  
  // Прочитаем сколько надо approve
  const cRead = getReadContract('ClubPools', CLUBPOOLS_ABI)
  const sale = await cRead.sales(saleId)
  const obligationsTotal = sale.obligationsTotal
  
  if (sale.paid) {
    throw new Error('Эта продажа уже оплачена')
  }
  
  // Approve USDT
  await ensureUSDTApproval(ADDRESSES.ClubPools, obligationsTotal)
  
  const tx = await c.payObligations(saleId)
  return await tx.wait()
}

/**
 * v2.6: Взыскать обязательства с гарантского кошелька при просрочке.
 * Может вызвать ЛЮБОЙ адрес после deadline (14 дней).
 * Гарант должен заранее сделать USDT.approve для нового ClubPools.
 * 
 * @param {number} saleId
 */
export async function seizeFromGuarantor(saleId) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.seizeFromGuarantor(saleId)
  return await tx.wait()
}

/**
 * v2.6: Получить данные одной продажи по saleId
 */
export async function getSale(saleId) {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c) return null
  try {
    const s = await c.sales(saleId)
    return {
      saleId,
      poolId: Number(s.poolId),
      saleAmount: fmt(s.saleAmount),
      costPart: fmt(s.costPart),
      profit: fmt(s.profit),
      marketingPart: fmt(s.marketingPart),
      adsPart: fmt(s.adsPart),
      reservePart: fmt(s.reservePart),
      backingPart: fmt(s.backingPart),
      obligationsTotal: fmt(s.obligationsTotal),
      paid: s.paid,
      createdAt: Number(s.createdAt),
      deadline: Number(s.deadline),
      paidAt: Number(s.paidAt),
      paidBy: s.paidBy,
    }
  } catch { return null }
}

/**
 * v2.6: Получить общее количество записей продаж
 */
export async function getSalesCount() {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c) return 0
  try { return Number(await c.salesCount()) } catch { return 0 }
}

/**
 * v2.6: Получить ВСЕ продажи (для админ-дашборда)
 */
export async function getAllSales() {
  const total = await getSalesCount()
  if (total === 0) return []
  
  const results = []
  for (let i = 1; i <= total; i++) {
    const s = await getSale(i)
    if (s) results.push(s)
  }
  return results
}

/**
 * v2.6: Получить адрес гаранта
 */
export async function getGuarantor() {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c) return null
  try { return await c.guarantor() } catch { return null }
}

/**
 * v2.6: Получить дедлайн оплаты (в секундах)
 * Обычно 14 дней = 1209600 секунд
 */
export async function getPaymentDeadline() {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c) return 14 * 24 * 60 * 60
  try { return Number(await c.PAYMENT_DEADLINE()) } catch { return 14 * 24 * 60 * 60 }
}

// ═══════════════════════════════════════════════════════
// CLUB MARKET — магазин с эскроу
// ═══════════════════════════════════════════════════════

export async function getActiveItemCount() {
  const c = getReadContract('ClubMarket', CLUBMARKET_ABI)
  if (!c) return 0
  try { return num(await c.itemsCount()) } catch { return 0 }
}

/**
 * Получить товар по ID. Адаптируем к привычной для UI структуре.
 *
 * Контракт даёт:
 *   { id, itemType, sourcePoolId, sourceCombinedId, seller, cost,
 *     priceK, status, metaUrl, listedAt }
 *
 * UI хочет: poolId, seller, priceUSDT, description, imageURI, status,
 *           createdAt, buyer, boughtAt
 *
 * buyer и boughtAt живут в Escrow — добавим их через доп. запрос если нужны.
 */
export async function getMarketItem(itemId) {
  const c = getReadContract('ClubMarket', CLUBMARKET_ABI)
  if (!c) return null
  try {
    const item = await c.getItem(itemId)
    return {
      // Новые правильные поля
      itemId: num(item.id),
      id: num(item.id),
      itemType: num(item.itemType),       // 0=Gem, 1=Jewelry, 2=Resale
      sourcePoolId: num(item.sourcePoolId),
      sourceCombinedId: num(item.sourceCombinedId),
      seller: item.seller,
      cost: fmt(item.cost),
      priceK: fmt(item.priceK),
      priceWei: item.priceK,
      status: num(item.status),           // 0=Listed, 1=InEscrow, 2=Sold, 3=Cancelled
      metaUrl: item.metaUrl,
      listedAt: num(item.listedAt),

      // Алиасы для старого UI
      poolId: num(item.sourcePoolId),
      priceUSDT: fmt(item.priceK),
      description: item.metaUrl,          // в новой модели всё в metaUrl
      imageURI: item.metaUrl,
      createdAt: num(item.listedAt),

      // Удобные флаги
      isListed: num(item.status) === 0,
      isInEscrow: num(item.status) === 1,
      isSold: num(item.status) === 2,
      isCancelled: num(item.status) === 3,
      isResale: num(item.itemType) === 2,
    }
  } catch (e) {
    console.error('getMarketItem:', itemId, e?.message || e)
    return null
  }
}

/**
 * Получить эскроу. Адаптер.
 *
 * Контракт даёт: { buyer, amount, lockedAt, deadline, status, trackingNumber, dctBurned }
 * UI ждёт: { amountUSDT, escrowEndsAt, status, trackingNumber, shippedAt, confirmedAt }
 *
 * shippedAt/confirmedAt в контракте НЕ хранятся (нужно читать события).
 * Для UI оставляем 0 — компоненты должны это понимать.
 */
export async function getEscrow(itemId) {
  const c = getReadContract('ClubMarket', CLUBMARKET_ABI)
  if (!c) return null
  try {
    const e = await c.getEscrow(itemId)
    const hasTracking = e.trackingNumber && e.trackingNumber.length > 0
    return {
      // Новые правильные поля
      buyer: e.buyer,
      amount: fmt(e.amount),
      amountWei: e.amount,
      lockedAt: num(e.lockedAt),
      deadline: num(e.deadline),
      status: num(e.status),     // 0=Locked, 1=Disputed, 2=Confirmed, 3=Refunded, 4=Released
      trackingNumber: e.trackingNumber,
      dctBurned: fmt(e.dctBurned),

      // Алиасы для старого UI
      itemId,
      amountUSDT: fmt(e.amount),
      escrowEndsAt: num(e.deadline),
      shippedAt: 0,              // нет в контракте — читай событие ItemShipped
      confirmedAt: 0,            // нет в контракте — читай событие ItemReceived

      // Флаги
      isShipped: hasTracking,
      isLocked: num(e.status) === 0,
      isDisputed: num(e.status) === 1,
      isConfirmed: num(e.status) === 2,
      isRefunded: num(e.status) === 3,
      isReleased: num(e.status) === 4,
    }
  } catch (e) {
    console.error('getEscrow:', itemId, e?.message || e)
    return null
  }
}

/**
 * Купить товар без скидки (платим полную цену USDT в эскроу).
 *
 * ВНИМАНИЕ: dctToBurn в новых контрактах ОБЯЗАН быть 0.
 * Для скидки используется buyItemWithCoupon, для оплаты DCT — buyItemWithDCT.
 */
export async function buyItem(itemId, _dctToBurnIgnored = 0) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const cRead = getReadContract('ClubMarket', CLUBMARKET_ABI)

  const item = await cRead.getItem(itemId)
  const priceWei = item.priceK

  await ensureUSDTApproval(ADDRESSES.ClubMarket, priceWei)

  // dctToBurn = 0 обязательно (контракт требует)
  const tx = await c.buyItem(itemId, 0)
  return await tx.wait()
}

/**
 * Купить с использованием РАЗМОРОЖЕННЫХ DCT.
 *
 * Партнёр платит часть товара DCT (по реальной цене пула), остаток USDT.
 * DCT блокируются в эскроу (не сжигаются сразу) — при confirmReceived
 * окончательно сжигаются, при stuck/refund возвращаются.
 *
 * @param {number} itemId
 * @param {number|string} dctAmount — сколько DCT использовать
 * @param {number} poolId — из какого пула DCT (партнёр выбирает на UI)
 */
export async function buyItemWithDCT(itemId, dctAmount, poolId) {
  if (!poolId || poolId <= 0) {
    throw new Error('Укажите ID пула из которого тратите DCT')
  }
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const cRead = getReadContract('ClubMarket', CLUBMARKET_ABI)
  const cPools = getReadContract('ClubPools', CLUBPOOLS_ABI)

  const dctWei = parse(dctAmount)

  // Считаем сколько USDT покрывают DCT (по текущей цене пула)
  // и сколько USDT нужно доплатить
  const dctPrice = await cPools.getCurrentDCTPrice(poolId)  // USDT_per_DCT_wei
  const item = await cRead.getItem(itemId)
  const usdtFromDCT = (dctWei * dctPrice) / (10n ** 18n)
  const usdtToPay = item.priceK > usdtFromDCT ? item.priceK - usdtFromDCT : 0n

  // Approve USDT-остатка (если > 0)
  if (usdtToPay > 0n) {
    await ensureUSDTApproval(ADDRESSES.ClubMarket, usdtToPay)
  }

  const tx = await c.buyItemWithDCT(itemId, dctWei, poolId)
  return await tx.wait()
}

/**
 * Купить со скидкой по NSS-купону.
 *
 * НОВАЯ СТРУКТУРА КУПОНА (отличается от старой!):
 *   coupon = { user, nssBurned, discountPct, expiresAt, nonce }
 *
 * Подпись делается backend'ом gws.ink над:
 *   keccak256(abi.encode(user, nssBurned, discountPct, expiresAt, nonce, marketAddress))
 *   с префиксом "\x19Ethereum Signed Message:\n32"
 *
 * @param {number} itemId
 * @param {Object} coupon — { user, nssBurned, discountPct, expiresAt, nonce }
 * @param {string} signature — подпись от couponSigner (0x + 130 hex)
 */
export async function buyItemWithCoupon(itemId, coupon, signature) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const cRead = getReadContract('ClubMarket', CLUBMARKET_ABI)

  // Валидация купона
  if (!coupon || !coupon.user || !coupon.discountPct) {
    throw new Error('Купон неверный')
  }
  if (coupon.user.toLowerCase() !== web3.address.toLowerCase()) {
    throw new Error('Купон не на ваш адрес')
  }
  if (coupon.discountPct < 1 || coupon.discountPct > 5) {
    throw new Error('Скидка должна быть от 1 до 5%')
  }

  // Считаем сумму к оплате со скидкой
  const item = await cRead.getItem(itemId)
  const discountWei = (item.priceK * BigInt(coupon.discountPct)) / 100n
  const amountToPayWei = item.priceK - discountWei

  await ensureUSDTApproval(ADDRESSES.ClubMarket, amountToPayWei)

  // Структура для контракта: tuple(address, uint256, uint8, uint64, bytes32)
  const couponStruct = {
    user: coupon.user,
    nssBurned: BigInt(coupon.nssBurned || 0),
    discountPct: Number(coupon.discountPct),
    expiresAt: BigInt(coupon.expiresAt),
    nonce: coupon.nonce,
  }

  const tx = await c.buyItemWithCoupon(itemId, couponStruct, signature)
  return await tx.wait()
}

/**
 * Продавец отметил отправку.
 * ВНИМАНИЕ: можно вызвать только до истечения 30 дней эскроу.
 */
export async function markShipped(itemId, trackingNumber) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  if (!trackingNumber || trackingNumber.length === 0) {
    throw new Error('Укажите номер отслеживания')
  }
  const tx = await c.markShipped(itemId, String(trackingNumber))
  return await tx.wait()
}

/**
 * Покупатель подтвердил получение → деньги уходят продавцу.
 * (Можно вызвать в любой момент после оплаты — НЕ обязательно ждать 30 дней.)
 */
export async function confirmReceived(itemId) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.confirmReceived(itemId)
  return await tx.wait()
}

/**
 * Авто-релиз продавцу после 30 дней (если есть трек и нет спора).
 * Может вызвать любой.
 */
export async function autoReleaseExpired(itemId) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.autoReleaseExpired(itemId)
  return await tx.wait()
}

export async function disputeItem(itemId, reason) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.disputeItem(itemId, String(reason || ''))
  return await tx.wait()
}

/**
 * Оператор разрешает спор.
 * @param {boolean} toSeller — true: деньги продавцу, false: возврат покупателю
 */
export async function resolveDispute(itemId, toSeller) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.resolveDispute(itemId, !!toSeller)
  return await tx.wait()
}

/**
 * Покупатель забирает USDT обратно если 90 дней нет трека.
 */
export async function claimStuckEscrow(itemId) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.claimStuckEscrow(itemId)
  return await tx.wait()
}

// ─── ВЫСТАВЛЕНИЕ ТОВАРОВ ───

/**
 * Партнёр (уровень 4+) выставляет свой товар (Resale).
 * @param {number|string} priceUSDT — цена
 * @param {string} metaUrl — URL с описанием+фоткой (всё одной строкой)
 */
export async function listResale(priceUSDT, metaUrl) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.listResale(parse(priceUSDT), String(metaUrl || ''))
  return await tx.wait()
}

export async function cancelListing(itemId) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.cancelListing(itemId)
  return await tx.wait()
}

/**
 * Owner/Operator выставляет камень из пула.
 * @param {number} poolId — пул должен быть в InGem
 * @param {number|string} cost — себестоимость (для recordSale)
 * @param {number|string} priceK — цена продажи
 * @param {string} metaUrl
 */
export async function listGemFromPool(poolId, cost, priceK, metaUrl) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.listGemFromPool(poolId, parse(cost), parse(priceK), String(metaUrl || ''))
  return await tx.wait()
}

export async function listJewelryFromPool(poolId, cost, priceK, metaUrl) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.listJewelryFromPool(poolId, parse(cost), parse(priceK), String(metaUrl || ''))
  return await tx.wait()
}

/**
 * Все активные товары на витрине.
 * Контракт не даёт массива — приходится перебирать по itemsCount и фильтровать.
 */
export async function getAllMarketItems() {
  const count = await getActiveItemCount()
  if (count === 0) return []
  const ids = []
  for (let i = 1; i <= count; i++) ids.push(i)
  const items = await Promise.all(ids.map(id => getMarketItem(id)))
  return items.filter(item => item && item.isListed)
}

/**
 * Все товары (включая проданные/отменённые) — для истории.
 */
export async function getAllMarketItemsFull() {
  const count = await getActiveItemCount()
  if (count === 0) return []
  const ids = []
  for (let i = 1; i <= count; i++) ids.push(i)
  const items = await Promise.all(ids.map(id => getMarketItem(id)))
  return items.filter(Boolean)
}

// ═══════════════════════════════════════════════════════
// CLUB MARKETING — комиссии партнёров
// ═══════════════════════════════════════════════════════

export async function getMarketingBalance(address) {
  const c = getReadContract('ClubMarketing', CLUBMARKETING_ABI)
  if (!c || !address) return '0'
  try { return fmt(await c.getBalance(address)) } catch { return '0' }
}

export async function getEarningsByLevel(address) {
  const c = getReadContract('ClubMarketing', CLUBMARKETING_ABI)
  if (!c || !address) return Array(9).fill('0')
  try {
    const arr = await c.getEarningsByLevel(address)
    return arr.map(v => fmt(v))
  } catch { return Array(9).fill('0') }
}

export async function getMarketingPhase() {
  const c = getReadContract('ClubMarketing', CLUBMARKETING_ABI)
  if (!c) return 0
  try { return num(await c.getCurrentPhase()) } catch { return 0 }
}

export async function getAdsToPhaseSwitch() {
  const c = getReadContract('ClubMarketing', CLUBMARKETING_ABI)
  if (!c) return '0'
  try { return fmt(await c.adsToPhaseSwitch()) } catch { return '0' }
}

export async function getTotalLifetimeEarned(address) {
  const c = getReadContract('ClubMarketing', CLUBMARKETING_ABI)
  if (!c || !address) return '0'
  try { return fmt(await c.totalLifetimeEarned(address)) } catch { return '0' }
}

/**
 * Партнёр забирает накопленные комиссии маркетинга.
 */
export async function claimMarketing() {
  const c = getContract('ClubMarketing', CLUBMARKETING_ABI)
  const tx = await c.claim()
  return await tx.wait()
}

// Алиас старого имени для совместимости
export const claimReferralBonus = claimMarketing

/**
 * Аварийный claim если 90 дней нет distribute.
 */
export async function claimMarketingInactive() {
  const c = getContract('ClubMarketing', CLUBMARKETING_ABI)
  const tx = await c.claimInactive()
  return await tx.wait()
}

// ═══════════════════════════════════════════════════════
// CLUB DIRECTORS — голосование
// ═══════════════════════════════════════════════════════

export async function getDirectors() {
  const c = getReadContract('ClubDirectors', CLUBDIRECTORS_ABI)
  if (!c) return []
  try { return await c.getDirectors() } catch { return [] }
}

export async function getDirectorsCount() {
  const c = getReadContract('ClubDirectors', CLUBDIRECTORS_ABI)
  if (!c) return 0
  try { return num(await c.getDirectorsCount()) } catch { return 0 }
}

export async function getRequiredApprovals() {
  const c = getReadContract('ClubDirectors', CLUBDIRECTORS_ABI)
  if (!c) return 0
  try { return num(await c.requiredApprovals()) } catch { return 0 }
}

export async function isDirector(address) {
  const c = getReadContract('ClubDirectors', CLUBDIRECTORS_ABI)
  if (!c || !address) return false
  try { return await c.isDirector(address) } catch { return false }
}

/**
 * Получить предложение и адаптировать структуру.
 * Контракт: { id, proposer, action, targetContract, data, description,
 *             createdAt, expiresAt, status, approvalCount, approvers }
 */
export async function getProposal(proposalId) {
  const c = getReadContract('ClubDirectors', CLUBDIRECTORS_ABI)
  if (!c) return null
  try {
    const p = await c.getProposal(proposalId)
    return {
      proposalId: num(p.id),
      id: num(p.id),
      proposer: p.proposer,
      action: num(p.action),       // 0=EmergencyWithdraw, 1=CancelEmergency, 2=ForceDrain, 3=ChangeParameter, 4=Custom
      target: p.targetContract,
      targetContract: p.targetContract,
      data: p.data,
      description: p.description,
      createdAt: num(p.createdAt),
      expiresAt: num(p.expiresAt),
      status: num(p.status),       // 0=Pending, 1=Approved, 2=Executed, 3=Expired, 4=Cancelled
      approvalCount: num(p.approvalCount),
      approvers: p.approvers,
    }
  } catch { return null }
}

export async function getAllProposals() {
  const c = getReadContract('ClubDirectors', CLUBDIRECTORS_ABI)
  if (!c) return []
  try {
    const proposals = await c.getAllProposals()
    return proposals.map(p => ({
      proposalId: num(p.id),
      id: num(p.id),
      proposer: p.proposer,
      action: num(p.action),
      target: p.targetContract,
      targetContract: p.targetContract,
      data: p.data,
      description: p.description,
      createdAt: num(p.createdAt),
      expiresAt: num(p.expiresAt),
      status: num(p.status),
      approvalCount: num(p.approvalCount),
      approvers: p.approvers,
    }))
  } catch { return [] }
}

export async function approveProposal(proposalId) {
  const c = getContract('ClubDirectors', CLUBDIRECTORS_ABI)
  const tx = await c.approveProposal(proposalId)
  return await tx.wait()
}

// ═══════════════════════════════════════════════════════
// DASHBOARD — комплексная загрузка для главной страницы
// ═══════════════════════════════════════════════════════

export async function loadDashboard(address) {
  if (!address) return null
  try {
    const [
      dctInfo,
      holdings,
      poolsCount,
      reserveBalance,
      marketingBalance,
      activeItemCount,
      usdtBalance,
    ] = await Promise.all([
      getDCTUserInfo(address),
      getDCTHoldings(address),
      getPoolsCount(),
      getReserveBalance(),
      getMarketingBalance(address),
      getActiveItemCount(),
      getUSDTBalance(address),
    ])
    return {
      dctInfo,
      holdings,
      poolsCount,
      reserveBalance,
      marketingBalance,
      activeItemCount,
      usdtBalance,
    }
  } catch (e) {
    console.error('loadDashboard:', e?.message || e)
    return null
  }
}

// Алиасы для совместимости со старыми компонентами
export const loadDiamondClubDashboard = loadDashboard
export const loadDCTDashboard = loadDashboard

// ═══════════════════════════════════════════════════════
// SAFECALL — обёртка с человеческими сообщениями об ошибках
// ═══════════════════════════════════════════════════════

export async function safeCall(fn) {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    const msg = err?.reason || err?.shortMessage || err?.message || 'Неизвестная ошибка'

    if (msg.includes('user rejected') || msg.includes('User denied')) {
      return { ok: false, error: 'Транзакция отклонена' }
    }
    if (msg.includes('insufficient funds')) {
      return { ok: false, error: 'Недостаточно BNB на газ' }
    }
    if (msg.includes('ERC20: insufficient allowance')) {
      return { ok: false, error: 'Недостаточно разрешения USDT/DCT' }
    }
    if (msg.includes('ERC20: transfer amount exceeds balance')) {
      return { ok: false, error: 'Недостаточно средств на балансе' }
    }

    // Извлекаем revert reason из контракта
    const reason = msg.match(/reason="([^"]+)"/)?.[1]
                || msg.match(/reverted: (.+?)(?:"|$)/)?.[1]
                || msg.match(/reverted with reason string '([^']+)'/)?.[1]

    if (reason) {
      // Переводим коды контрактов на человеческий русский
      const human = translateContractError(reason)
      return { ok: false, error: human }
    }

    return { ok: false, error: msg.slice(0, 150) }
  }
}

/**
 * Перевод revert reason'ов от контрактов на русский.
 * Покрывает основные ошибки v2.4.
 */
function translateContractError(reason) {
  const map = {
    // ClubPools
    'P:zero amount': 'Сумма не может быть 0',
    'P:zero target': 'Цель сбора не может быть 0',
    'P:invalid pool': 'Пул не существует',
    'P:pool not open': 'Пул закрыт для покупки долей',
    'P:need level 7+': 'Нужен GlobalWay уровень 7 или выше',
    'P:still frozen': 'Год заморозки ещё не прошёл',
    'P:empty pool': 'Пул пуст (нет DCT)',
    'P:insufficient DCT': 'Недостаточно DCT',
    'P:only full redeem supported': 'Можно делать только полный redeem',
    'P:not in gem': 'Пул не находится в статусе InGem',
    'P:invalid status for gem purchase': 'Неверный статус пула для закупки',
    'P:still active': 'Пул ещё активен (не прошло 90 дней)',
    'P:nothing to claim': 'Нечего забирать',
    'P:drained': 'Контракт деактивирован',
    'P:not drained': 'Контракт не деактивирован',
    'P:factory not whitelisted': 'Завод не одобрен multisig',
    'P:cannot touch reserve fund': 'Нельзя трогать резервный фонд',
    'P:no DCT in pool': 'Нет DCT в этом пуле',
    'P:offer not open': 'Предложение неактивно',
    'P:cannot buy own': 'Нельзя купить свой оффер',
    'P:seller DCT changed': 'Количество DCT продавца изменилось',
    'P:real price >= floor': 'Реальная цена не ниже защитной — используйте redeem',
    'P:insufficient reserve': 'Недостаточно резервного фонда',

    // ClubMarket
    'M:not listed': 'Товар не на витрине',
    'M:cannot buy own': 'Нельзя купить свой товар',
    'M:need level 1+': 'Нужен GlobalWay уровень 1 или выше',
    'M:need level 4+': 'Нужен уровень 4+ для Resale',
    'M:not in escrow': 'Товар не в эскроу',
    'M:not buyer': 'Только покупатель может это сделать',
    'M:escrow not locked': 'Эскроу уже разблокировано',
    'M:no tracking, use claimStuck after 90d': 'Трек-номер не указан. Используйте claimStuckEscrow через 90 дней',
    'M:was shipped': 'Товар уже отправлен',
    'M:not stuck': 'Эскроу ещё не застряло (90 дней не прошло)',
    'M:deadline passed, cannot mark shipped': '30 дней прошло — отправку отметить уже нельзя',
    'M:use buyItemWithCoupon for discount': 'Для скидки используйте buyItemWithCoupon',
    'M:coupon expired': 'Купон истёк',
    'M:coupon used': 'Купон уже использован',
    'M:invalid signature': 'Подпись купона неверна',
    'M:not your coupon': 'Купон не на ваш адрес',
    'M:invalid discount': 'Скидка должна быть от 1 до 5%',
    'M:DCT exceeds item price': 'DCT превышают цену товара',
    'M:DCT value too small': 'Стоимость DCT слишком мала',
    'M:pool not in gem': 'Пул не в статусе InGem',
    'M:contract drained': 'Контракт деактивирован',

    // ClubDCT
    'DCT:direct transfer disabled, use specific functions': 'Прямой перевод DCT запрещён',
    'DCT:not enough DCT in pool': 'Недостаточно DCT в этом пуле',
    'DCT:not enough unlocked DCT in pool': 'Недостаточно разморожённых DCT в этом пуле',
    'DCT:not enough locked': 'Недостаточно заблокированных DCT',
    'DCT:zero amount': 'Сумма не может быть 0',

    // ClubMarketing
    'MK:nothing to claim': 'Нечего забирать',
    'MK:still active': 'Контракт ещё активен',
    'MK:contract drained': 'Маркетинг деактивирован',
  }
  return map[reason] || `Контракт: ${reason}`
}

// ═══════════════════════════════════════════════════════
// АЛИАСЫ для совместимости со старыми именами/импортами
// ═══════════════════════════════════════════════════════

// Старое имя — используется в LotsAdmin
export { createLotOnChain as createLot }

// Совсем старое (на случай если где-то использовалось)
export const buyShareFromBalance = buyShare

// ═══════════════════════════════════════════════════════
// ЗАГЛУШКИ — функционал удалён в v2.3+, но фронт его ждёт
// ═══════════════════════════════════════════════════════
// Эти функции возвращают пустые/безопасные значения чтобы фронт
// не падал. Новый UI должен НЕ использовать их.

// TrustScore — удалено
export async function getUserTrustInfo() {
  return { score: 0, tier: 0, canPurchase: true, canStake: true, canShowcase: true }
}

// UserBoost — удалено
export async function getUserBoostInfo() {
  return { totalBurned: '0', currentBoostBP: 0, totalStakingRateBP: 0 }
}
export async function burnNSTForBoost() {
  throw new Error('Boost-функция удалена в v2.4')
}

// InsuranceFund — отдельный инструмент, не часть Diamond Club
export async function getInsuranceFundStats() {
  return { balance: '0', deposited: '0', paidClaims: '0' }
}
export async function getInsuranceUserBalance() { return '0' }
export async function getUserWithdrawRequests() { return [] }
export async function requestWithdraw() {
  throw new Error('Insurance удалён в v2.4')
}

// GemVaultV2 (старая модель камней) — удалено
export async function getOldGems() { return [] }
export async function getOldGemDetails() { return null }
