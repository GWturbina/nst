'use client'
/**
 * DCT Diamond Club v3.2 — Contract Service Layer
 * DCTToken + DCTBridge + FractionalGem + DCTExchange + GemFractionDEX + DCTHeritage + GemShowcase
 * 
 * Этот файл обслуживает 7 новых DCT контрактов.
 * Существующие контракты (GemVaultV2, DiamondP2P и т.д.) — в diamondContracts.js
 * НЕ ТРОГАТЬ diamondContracts.js — он работает.
 */
import { ethers } from 'ethers'
import web3 from './web3'
import ADDRESSES from '@/contracts/addresses'

// ═══════════════════════════════════════════════════
// READ PROVIDER (без кошелька)
// ═══════════════════════════════════════════════════
const READ_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'
const readProvider = new ethers.JsonRpcProvider(READ_RPC)

// ═══════════════════════════════════════════════════
// MINIMAL ABIs
// ═══════════════════════════════════════════════════

const DCTTOKEN_ABI = [
  // Views
  'function getCurrentPrice() view returns (uint256)',
  'function usdtToDCT(uint256 usdtAmount) view returns (uint256)',
  'function dctToUSDT(uint256 dctAmount) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function freeBalance(address user) view returns (uint256)',
  'function lockedBalance(address user) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function totalBackingValue() view returns (uint256)',
  'function isPaused() view returns (bool)',
  'function getTokenInfo() view returns (uint256 price, uint256 supply, uint256 backing, bool paused_, uint64 pauseExpires, uint64 lastOwnerActive, bool emergencyAvailable)',
  'function getUserInfo(address user) view returns (uint256 total, uint256 locked, uint256 free, uint256 valueUSDT, uint64 lastActive, bool canEmergency)',
  'function allowance(address owner, address spender) view returns (uint256)',
  // Write
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
]

const DCTBRIDGE_ABI = [
  // Views
  'function getClaimableGems(address user) view returns (uint256[] purchaseIds, uint256[] marketValues, uint256[] estimatedDCT)',
  'function gemClaimed(uint256) view returns (bool)',
  'function gemMintedAmount(uint256) view returns (uint256)',
  'function BACKING_RATE_BP() view returns (uint16)',
  // Write
  'function claimGemDCT(uint256 purchaseId) returns (uint256)',
  'function claimAllGemDCT() returns (uint256 totalMinted)',
]

const FRACTIONALGEM_ABI = [
  // ═══ V2 (FractionalGemV2) — реальный задеплоенный контракт ═══
  // Views — состояние лота
  'function lots(uint256) view returns (uint256 costPriceUSDT, uint256 clubPriceUSDT, uint256 fractionPriceUSDT, uint256 totalFractions, uint256 soldFractions, uint16 stakingAPR, uint64 stakingStartedAt, uint256 stakingDays, uint8 status, uint64 createdAt, uint64 fundraisingDeadline, uint8 cyclesCompleted, bool supplierPaid, uint256 totalGhost, uint256 dissolvedGhost, uint256 ghostDebtUSDT, address lotSupplier)',
  'function lotCount() view returns (uint256)',
  'function holderFractions(uint256, address) view returns (uint256)',
  'function stakingReserveUSDT(uint256) view returns (uint256)',
  'function getClaimableStaking(uint256 lotId, address user) view returns (uint256)',
  'function lockedDCTPerLot(uint256, address) view returns (uint256)',
  'function lotContributedUSDT(uint256, address) view returns (uint256)',
  'function lotMintedDCT(uint256, address) view returns (uint256)',
  'function accumulatedCycleProfit(uint256) view returns (uint256)',
  'function saleAmountUSDT(uint256) view returns (uint256)',
  'function hasClaimedSale(uint256, address) view returns (bool)',
  'function refundClaimed(uint256, address) view returns (bool)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
  'function MAX_CYCLES() view returns (uint8)',
  'function MAX_FRACTIONS() view returns (uint256)',
  'function MARKETING_BP() view returns (uint16)',
  'function BACKING_BP() view returns (uint16)',
  'function VERSION() view returns (string)',
  'function admins(address) view returns (bool)',
  'function owner() view returns (address)',
  'function dctToken() view returns (address)',
  'function usdt() view returns (address)',
  // Write — для партнёров
  'function buyFractionsUSDT(uint256 lotId, uint256 amount)',
  'function buyFractionsDCT(uint256 lotId, uint256 amount)',
  'function claimStakingAndContinue(uint256 lotId)',
  'function claimStakingAndUnlock(uint256 lotId)',
  'function extendStaking(uint256 lotId)',
  'function claimAfterFinalSale(uint256 lotId)',
  'function refundCancelledLot(uint256 lotId)',
  'function setApprovalForAll(address operator, bool approved)',
  // Admin — управление лотом
  'function createLot(tuple(uint256 costPriceUSDT, uint256 totalFractions, uint16 stakingAPR, uint256 stakingDays, uint64 fundraisingDays, address lotSupplier, uint256 reservedCount, address[] giftRecipients, uint256[] giftAmounts) p) returns (uint256)',
  'function payToSupplier(uint256 lotId)',
  'function clubBuyRemaining(uint256 lotId)',
  'function extendDeadline(uint256 lotId, uint64 additionalDays)',
  'function cancelLot(uint256 lotId, bool force)',
  'function settleGiftDebt(uint256 lotId, address recipient, uint256 amountUSDT)',
  'function fundStakingReserve(uint256 lotId, uint256 amount)',
  'function confirmCycleSale(uint256 lotId, uint256 saleUSDT)',
  'function withdrawCycleProfit(uint256 lotId, address to, uint256 amount)',
  'function forceForSale(uint256 id)',
  'function confirmFinalSale(uint256 lotId, uint256 amt)',
  'function addAdmin(address a)',
  'function removeAdmin(address a)',
]

const DCTEXCHANGE_ABI = [
  // Views
  'function getBestPrices() view returns (uint256 bestBid, uint256 bestAsk)',
  'function getExchangeStats() view returns (uint256 volumeDCT, uint256 volumeUSDT, uint256 burnedDCT, uint256 trades, uint256 activeBuys, uint256 activeSells, uint256 backingPrice)',
  'function getActiveSellOrders() view returns (tuple(uint256 orderId, uint8 orderType, address maker, uint256 dctAmount, uint256 dctFilled, uint256 pricePerDCT, uint8 status, uint64 createdAt)[])',
  'function getActiveBuyOrders() view returns (tuple(uint256 orderId, uint8 orderType, address maker, uint256 dctAmount, uint256 dctFilled, uint256 pricePerDCT, uint8 status, uint64 createdAt)[])',
  'function orders(uint256 id) view returns (uint256 orderId, uint8 orderType, address maker, uint256 dctAmount, uint256 dctFilled, uint256 pricePerDCT, uint8 status, uint64 createdAt)',
  'function TRADE_FEE_BP() view returns (uint16)',
  // Write
  'function createSellOrder(uint256 dctAmount, uint256 pricePerDCT) returns (uint256)',
  'function createBuyOrder(uint256 dctAmount, uint256 pricePerDCT) returns (uint256)',
  'function fillSellOrder(uint256 orderId, uint256 dctAmount)',
  'function fillBuyOrder(uint256 orderId, uint256 dctAmount)',
  'function cancelOrder(uint256 orderId)',
]

const GEMFRACTIONDEX_ABI = [
  // Views
  'function getActiveSellOrders(uint256 lotId) view returns (tuple(uint256 orderId, uint256 lotId, address seller, uint256 fractions, uint256 pricePerFractionDCT, bool active, uint64 createdAt)[])',
  'function getOrder(uint256 id) view returns (tuple(uint256 orderId, uint256 lotId, address seller, uint256 fractions, uint256 pricePerFractionDCT, bool active, uint64 createdAt))',
  'function orderCount() view returns (uint256)',
  'function TRADE_FEE_BP() view returns (uint16)',
  // Write
  'function createSellOrder(uint256 lotId, uint256 fractions, uint256 priceDCT)',
  'function fillSellOrder(uint256 orderId, uint256 fractions)',
  'function cancelSellOrder(uint256 orderId)',
]

const DCTHERIT_ABI = [
  // Views
  'function getHeritage(address user) view returns (bool active, bool executed, uint64 lastActivity, uint64 inactivityPeriod, uint64 canExecuteAt, bool canExecuteNow, uint8 heirCount)',
  'function getHeirs(address user) view returns (address[] wallets, uint16[] shares, string[] labels)',
  'function checkApprovals(address user) view returns (bool dctApproved, bool fractionsApproved)',
  'function estimateHeirShare(address owner, address heir) view returns (uint256 dctAmount, uint256 fractionsTotal)',
  'function MIN_INACTIVITY() view returns (uint64)',
  'function MAX_HEIRS() view returns (uint8)',
  // Write
  'function configureHeritage(address[] wallets, uint16[] sharesBP, string[] labels, uint256 inactivityDays)',
  'function cancelHeritage()',
  'function ping()',
]

const GEMSHOWCASE_ABI = [
  // Views
  'function showcaseCount() view returns (uint256)',
  'function getActiveListings() view returns (tuple(uint256 lotId, uint256 salePrice, address seller, bool active, bool sold)[])',
  'function showcaseListings(uint256 id) view returns (uint256 lotId, uint256 salePrice, address seller, bool active, bool sold)',
]

// ═══════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════

const fmt = ethers.formatEther       // 18 decimals (DCT, BNB)
const fmt6 = (v) => ethers.formatEther(v)  // opBNB USDT = 18 decimals!
const parse = ethers.parseEther
const parse6 = (v) => ethers.parseEther(String(v)) // opBNB USDT = 18 decimals!

function getDCT(name, abi) {
  if (!web3.signer) throw new Error('Кошелёк не подключён')
  const addr = ADDRESSES[name]
  if (!addr || addr.startsWith('0x_')) throw new Error(`${name} не задеплоен`)
  return new ethers.Contract(addr, abi, web3.signer)
}

function getDCTRead(name, abi) {
  const addr = ADDRESSES[name]
  if (!addr || addr.startsWith('0x_')) return null
  return new ethers.Contract(addr, abi, readProvider)
}

function getUSDT() {
  return new ethers.Contract(ADDRESSES.USDT, [
    'function approve(address,uint256) returns (bool)',
    'function allowance(address,address) view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
  ], web3.signer)
}

async function ensureUSDTApproval(spender, amount) {
  const usdt = getUSDT()
  const allowance = await usdt.allowance(web3.address, spender)
  if (allowance < amount) {
    const tx = await usdt.approve(spender, amount)
    await tx.wait()
  }
}

async function ensureDCTApproval(spender, amount) {
  const dct = getDCT('DCTToken', DCTTOKEN_ABI)
  const allowance = await dct.allowance(web3.address, spender)
  if (allowance < amount) {
    const tx = await dct.approve(spender, amount)
    await tx.wait()
  }
}

// ═══════════════════════════════════════════════════
// DCTToken — Токен DCT
// ═══════════════════════════════════════════════════

export async function getDCTTokenInfo() {
  const c = getDCTRead('DCTToken', DCTTOKEN_ABI)
  if (!c) return null
  try {
    const info = await c.getTokenInfo()
    return {
      price: fmt6(info.price),         // цена DCT в USDT (6 decimals)
      supply: fmt(info.supply),        // общий выпуск DCT
      backing: fmt6(info.backing),     // общее обеспечение в USDT
      paused: info.paused_,
      emergencyAvailable: info.emergencyAvailable,
    }
  } catch { return null }
}

export async function getDCTUserInfo(address) {
  const c = getDCTRead('DCTToken', DCTTOKEN_ABI)
  if (!c) return null
  try {
    const info = await c.getUserInfo(address)
    return {
      total: fmt(info.total),          // весь баланс DCT
      locked: fmt(info.locked),        // заморожено
      free: fmt(info.free),            // свободно
      valueUSDT: fmt6(info.valueUSDT), // стоимость в USDT
    }
  } catch { return null }
}

export async function getDCTPrice() {
  const c = getDCTRead('DCTToken', DCTTOKEN_ABI)
  if (!c) return '0'
  try {
    const price = await c.getCurrentPrice()
    return fmt6(price)
  } catch { return '0' }
}

// ═══════════════════════════════════════════════════
// DCTBridge — Получение DCT за камни
// ═══════════════════════════════════════════════════

export async function getClaimableGems(address) {
  const c = getDCTRead('DCTBridge', DCTBRIDGE_ABI)
  if (!c) return { purchaseIds: [], marketValues: [], estimatedDCT: [] }
  try {
    const result = await c.getClaimableGems(address)
    return {
      purchaseIds: result.purchaseIds.map(id => Number(id)),
      marketValues: result.marketValues.map(v => fmt6(v)),
      estimatedDCT: result.estimatedDCT.map(v => fmt(v)),
    }
  } catch { return { purchaseIds: [], marketValues: [], estimatedDCT: [] } }
}

export async function claimAllGemDCT() {
  const c = getDCT('DCTBridge', DCTBRIDGE_ABI)
  const tx = await c.claimAllGemDCT()
  return await tx.wait()
}

export async function claimSingleGemDCT(purchaseId) {
  const c = getDCT('DCTBridge', DCTBRIDGE_ABI)
  const tx = await c.claimGemDCT(purchaseId)
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// FractionalGem — Доли камней (ERC-1155)
// ═══════════════════════════════════════════════════

export async function getAllFractionalLots() {
  const c = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  if (!c) return []
  try {
    const count = Number(await c.lotCount())
    const lots = []
    for (let i = 0; i < count && i < 100; i++) {
      try {
        const lot = await c.lots(i)
        // Дополнительно подтянем резерв стейкинга (отдельный геттер)
        let stakingReserve = 0n
        try { stakingReserve = await c.stakingReserveUSDT(i) } catch {}

        lots.push({
          id: i,
          // Экономика (V2)
          costPrice: fmt6(lot.costPriceUSDT),         // закупка камня в USDT
          clubPrice: fmt6(lot.clubPriceUSDT),         // = costPrice / 0.85
          fractionPriceUSDT: fmt6(lot.fractionPriceUSDT), // цена 1 доли в USDT
          totalFractions: Number(lot.totalFractions),
          soldFractions: Number(lot.soldFractions),
          // Стейкинг
          stakingAPR: Number(lot.stakingAPR),         // BP, 1200 = 12%
          stakingStartedAt: Number(lot.stakingStartedAt),
          stakingDays: Number(lot.stakingDays),
          // Жизненный цикл (V2 enum LotStatus)
          // 0=PENDING 1=FUNDRAISING 2=FULLY_FUNDED 3=STAKING_ACTIVE 4=FOR_SALE 5=SOLD 6=CANCELLED
          status: Number(lot.status),
          createdAt: Number(lot.createdAt),
          fundraisingDeadline: Number(lot.fundraisingDeadline),
          cyclesCompleted: Number(lot.cyclesCompleted),
          supplierPaid: lot.supplierPaid,
          // Ghost-доли
          totalGhost: Number(lot.totalGhost),
          dissolvedGhost: Number(lot.dissolvedGhost),
          ghostDebtUSDT: fmt6(lot.ghostDebtUSDT),
          // Адрес
          supplier: lot.lotSupplier,
          // Дополнительно
          stakingReserve: fmt6(stakingReserve),
        })
      } catch { break }
    }
    return lots
  } catch { return [] }
}

export async function getUserLotInfo(lotId, address) {
  // V2: getUserLotInfo больше нет — собираем из отдельных геттеров
  const c = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  if (!c) return null
  try {
    const [fractions, claimable, contributedUSDT, mintedDCT, lockedDCT] = await Promise.all([
      c.holderFractions(lotId, address),
      c.getClaimableStaking(lotId, address),
      c.lotContributedUSDT(lotId, address),
      c.lotMintedDCT(lotId, address),
      c.lockedDCTPerLot(lotId, address),
    ])
    return {
      fractions: Number(fractions),
      claimableStaking: fmt6(claimable),
      contributedUSDT: fmt6(contributedUSDT),
      mintedDCT: fmt(mintedDCT),
      lockedDCT: fmt(lockedDCT),
    }
  } catch { return null }
}

export async function getClaimableStaking(lotId, address) {
  const c = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  if (!c) return '0'
  try {
    const amount = await c.getClaimableStaking(lotId, address)
    return fmt6(amount)
  } catch { return '0' }
}

// V2: оплата USDT (партнёр платит USDT, контракт минтит DCT с локом)
export async function buyFractionsUSDT(lotId, amount) {
  const cRead = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  const lot = await cRead.lots(lotId)
  const totalCost = lot.fractionPriceUSDT * BigInt(amount)
  // Approve USDT (6 decimals) на контракт FractionalGem
  await ensureUSDTApproval(ADDRESSES.FractionalGem, totalCost)
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.buyFractionsUSDT(lotId, amount)
  return await tx.wait()
}

// V2: оплата DCT (партнёр платит уже накопленными DCT)
export async function buyFractionsDCT(lotId, amount) {
  const cRead = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  const lot = await cRead.lots(lotId)
  // В DCT-режиме бэкинг идёт без маркетинга → = totalUSDT × 0.85
  const totalUSDT = lot.fractionPriceUSDT * BigInt(amount)
  const backingUSDT = totalUSDT * 8500n / 10000n
  // dctRequired считает контракт сам через getCurrentPrice — мы только approve максимум
  // Approve с запасом по безопасности (×2)
  await ensureDCTApproval(ADDRESSES.FractionalGem, backingUSDT * 4n)
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.buyFractionsDCT(lotId, amount)
  return await tx.wait()
}

// Совместимость со старым кодом — buyFractions по-умолчанию = USDT-вариант
export async function buyFractions(lotId, amount) {
  return await buyFractionsUSDT(lotId, amount)
}

// V2: claimStaking разделён на 2 функции
//  - claimStakingAndContinue — забрать накопленный USDT, стейкинг продолжается
//  - claimStakingAndUnlock — после окончания stakingDays: забрать USDT + разблокировать DCT
export async function claimFractionalStaking(lotId) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.claimStakingAndContinue(lotId)
  return await tx.wait()
}

export async function claimStakingAndUnlock(lotId) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.claimStakingAndUnlock(lotId)
  return await tx.wait()
}

// V2: voteForSale заменён — после финальной продажи держатели вызывают claimAfterFinalSale
export async function voteForSale(lotId) {
  // Совместимость со старым UI — теперь это noop, голосование убрано в V2
  // Финальную продажу запускает админ через forceForSale + confirmFinalSale
  return { ok: false, error: 'В V2 голосование убрано — продажу запускает админ' }
}

export async function claimSaleProceeds(lotId) {
  // V2: после finalSale партнёры забирают свою долю через claimAfterFinalSale
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.claimAfterFinalSale(lotId)
  return await tx.wait()
}

// V2: возврат денег при отменённом лоте
export async function refundCancelledLot(lotId) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.refundCancelledLot(lotId)
  return await tx.wait()
}

/** Одобрить FractionalGem для Heritage (ERC-1155 setApprovalForAll) */
export async function approveFractionsForHeritage() {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.setApprovalForAll(ADDRESSES.DCTHeritage, true)
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// DCTExchange — Биржа DCT/USDT
// ═══════════════════════════════════════════════════

export async function getExchangeBestPrices() {
  const c = getDCTRead('DCTExchange', DCTEXCHANGE_ABI)
  if (!c) return { bestBid: '0', bestAsk: '0' }
  try {
    const [bestBid, bestAsk] = await c.getBestPrices()
    return {
      bestBid: fmt6(bestBid),   // лучшая цена покупки
      bestAsk: fmt6(bestAsk),   // лучшая цена продажи
    }
  } catch { return { bestBid: '0', bestAsk: '0' } }
}

export async function getExchangeStats() {
  const c = getDCTRead('DCTExchange', DCTEXCHANGE_ABI)
  if (!c) return null
  try {
    const s = await c.getExchangeStats()
    return {
      volumeDCT: fmt(s.volumeDCT),
      volumeUSDT: fmt6(s.volumeUSDT),
      burnedDCT: fmt(s.burnedDCT),
      trades: Number(s.trades),
      activeBuys: Number(s.activeBuys),
      activeSells: Number(s.activeSells),
      backingPrice: fmt6(s.backingPrice),
    }
  } catch { return null }
}

export async function getActiveSellOrders() {
  const c = getDCTRead('DCTExchange', DCTEXCHANGE_ABI)
  if (!c) return []
  try {
    const orders = await c.getActiveSellOrders()
    return orders.map(o => ({
      orderId: Number(o.orderId),
      orderType: Number(o.orderType),  // 0=BUY, 1=SELL
      maker: o.maker,
      dctAmount: fmt(o.dctAmount),
      dctFilled: fmt(o.dctFilled),
      dctRemaining: fmt(o.dctAmount - o.dctFilled),
      pricePerDCT: fmt6(o.pricePerDCT),
      createdAt: Number(o.createdAt),
    }))
  } catch { return [] }
}

export async function getActiveBuyOrders() {
  const c = getDCTRead('DCTExchange', DCTEXCHANGE_ABI)
  if (!c) return []
  try {
    const orders = await c.getActiveBuyOrders()
    return orders.map(o => ({
      orderId: Number(o.orderId),
      orderType: Number(o.orderType),
      maker: o.maker,
      dctAmount: fmt(o.dctAmount),
      dctFilled: fmt(o.dctFilled),
      dctRemaining: fmt(o.dctAmount - o.dctFilled),
      pricePerDCT: fmt6(o.pricePerDCT),
      createdAt: Number(o.createdAt),
    }))
  } catch { return [] }
}

export async function createBuyOrderDCT(dctAmount, pricePerDCT) {
  // Покупка DCT за USDT → нужен approve USDT на DCTExchange
  const totalUSDT = parseFloat(dctAmount) * parseFloat(pricePerDCT)
  await ensureUSDTApproval(ADDRESSES.DCTExchange, parse6(totalUSDT.toFixed(6)))
  const c = getDCT('DCTExchange', DCTEXCHANGE_ABI)
  const tx = await c.createBuyOrder(parse(dctAmount), parse6(pricePerDCT))
  return await tx.wait()
}

export async function createSellOrderDCT(dctAmount, pricePerDCT) {
  // Продажа DCT → нужен approve DCT на DCTExchange
  await ensureDCTApproval(ADDRESSES.DCTExchange, parse(dctAmount))
  const c = getDCT('DCTExchange', DCTEXCHANGE_ABI)
  const tx = await c.createSellOrder(parse(dctAmount), parse6(pricePerDCT))
  return await tx.wait()
}

export async function fillSellOrder(orderId, dctAmount) {
  // Заполнить ордер продажи = купить DCT → approve USDT
  const cRead = getDCTRead('DCTExchange', DCTEXCHANGE_ABI)
  const order = await cRead.orders(orderId)
  const totalUSDT = parse(dctAmount) * order.pricePerDCT / parse('1')
  await ensureUSDTApproval(ADDRESSES.DCTExchange, totalUSDT)
  const c = getDCT('DCTExchange', DCTEXCHANGE_ABI)
  const tx = await c.fillSellOrder(orderId, parse(dctAmount))
  return await tx.wait()
}

export async function fillBuyOrder(orderId, dctAmount) {
  // Заполнить ордер покупки = продать DCT → approve DCT
  await ensureDCTApproval(ADDRESSES.DCTExchange, parse(dctAmount))
  const c = getDCT('DCTExchange', DCTEXCHANGE_ABI)
  const tx = await c.fillBuyOrder(orderId, parse(dctAmount))
  return await tx.wait()
}

export async function cancelExchangeOrder(orderId) {
  const c = getDCT('DCTExchange', DCTEXCHANGE_ABI)
  const tx = await c.cancelOrder(orderId)
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// GemFractionDEX — Биржа долей камней
// ═══════════════════════════════════════════════════

export async function getFractionDEXOrders(lotId) {
  const c = getDCTRead('GemFractionDEX', GEMFRACTIONDEX_ABI)
  if (!c) return []
  try {
    const orders = await c.getActiveSellOrders(lotId)
    return orders.map(o => ({
      orderId: Number(o.orderId),
      lotId: Number(o.lotId),
      seller: o.seller,
      fractions: Number(o.fractions),
      pricePerFractionDCT: fmt(o.pricePerFractionDCT),
      createdAt: Number(o.createdAt),
    }))
  } catch { return [] }
}

export async function createFractionSellOrder(lotId, fractions, priceDCTPerFraction) {
  // Продажа долей: нужен setApprovalForAll для GemFractionDEX
  const fg = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const isApproved = await fg.isApprovedForAll(web3.address, ADDRESSES.GemFractionDEX)
  if (!isApproved) {
    const appTx = await fg.setApprovalForAll(ADDRESSES.GemFractionDEX, true)
    await appTx.wait()
  }
  const c = getDCT('GemFractionDEX', GEMFRACTIONDEX_ABI)
  const tx = await c.createSellOrder(lotId, fractions, parse(priceDCTPerFraction))
  return await tx.wait()
}

export async function fillFractionSellOrder(orderId, fractions) {
  // Покупка долей за DCT → approve DCT на GemFractionDEX
  const cRead = getDCTRead('GemFractionDEX', GEMFRACTIONDEX_ABI)
  const order = await cRead.getOrder(orderId)
  const totalDCT = order.pricePerFractionDCT * BigInt(fractions)
  await ensureDCTApproval(ADDRESSES.GemFractionDEX, totalDCT)
  const c = getDCT('GemFractionDEX', GEMFRACTIONDEX_ABI)
  const tx = await c.fillSellOrder(orderId, fractions)
  return await tx.wait()
}

export async function cancelFractionSellOrder(orderId) {
  const c = getDCT('GemFractionDEX', GEMFRACTIONDEX_ABI)
  const tx = await c.cancelSellOrder(orderId)
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// DCTHeritage — Наследование
// ═══════════════════════════════════════════════════

export async function getHeritageInfo(address) {
  const c = getDCTRead('DCTHeritage', DCTHERIT_ABI)
  if (!c) return null
  try {
    const h = await c.getHeritage(address)
    return {
      active: h.active,
      executed: h.executed,
      lastActivity: Number(h.lastActivity),
      inactivityPeriod: Number(h.inactivityPeriod),  // секунды
      inactivityDays: Math.floor(Number(h.inactivityPeriod) / 86400),
      canExecuteAt: Number(h.canExecuteAt),
      canExecuteNow: h.canExecuteNow,
      heirCount: Number(h.heirCount),
    }
  } catch { return null }
}

export async function getHeirs(address) {
  const c = getDCTRead('DCTHeritage', DCTHERIT_ABI)
  if (!c) return []
  try {
    const result = await c.getHeirs(address)
    const heirs = []
    for (let i = 0; i < result.wallets.length; i++) {
      heirs.push({
        wallet: result.wallets[i],
        shareBP: Number(result.shares[i]),     // basis points
        sharePct: (Number(result.shares[i]) / 100).toFixed(0), // %
        label: result.labels[i],
      })
    }
    return heirs
  } catch { return [] }
}

export async function checkHeritageApprovals(address) {
  const c = getDCTRead('DCTHeritage', DCTHERIT_ABI)
  if (!c) return { dctApproved: false, fractionsApproved: false }
  try {
    const result = await c.checkApprovals(address)
    return {
      dctApproved: result.dctApproved,
      fractionsApproved: result.fractionsApproved,
    }
  } catch { return { dctApproved: false, fractionsApproved: false } }
}

export async function configureHeritage(wallets, sharesBP, labels, inactivityDays) {
  const c = getDCT('DCTHeritage', DCTHERIT_ABI)
  const tx = await c.configureHeritage(wallets, sharesBP, labels, inactivityDays)
  return await tx.wait()
}

export async function cancelHeritage() {
  const c = getDCT('DCTHeritage', DCTHERIT_ABI)
  const tx = await c.cancelHeritage()
  return await tx.wait()
}

export async function pingHeritage() {
  const c = getDCT('DCTHeritage', DCTHERIT_ABI)
  const tx = await c.ping()
  return await tx.wait()
}

/** Одобрить DCT для Heritage (approve на текущий баланс × 2, не бесконечно) */
export async function approveDCTForHeritage() {
  const dct = getDCT('DCTToken', DCTTOKEN_ABI)
  const balance = await dct.balanceOf(web3.address)
  // Одобряем двойной баланс (с запасом), а не бесконечность
  const approveAmount = balance * 2n
  const tx = await dct.approve(ADDRESSES.DCTHeritage, approveAmount)
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// FractionalGem — Админские функции (owner only)
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// FractionalGem V2 — Админские функции (owner / admin only)
// ═══════════════════════════════════════════════════

/**
 * Создать фракционный лот в контракте V2.
 * V2 принимает структуру CreateLotParams. Меты камня (название, фото, сертификат)
 * хранятся вне контракта — в БД (Supabase), привязка по lotId после возврата tx.
 *
 * @param {object} p
 * @param {number|string} p.costPriceUSDT     — закупочная цена камня в USDT (обычные доллары, например 5600)
 * @param {number} p.totalFractions           — сколько долей всего (например 100)
 * @param {number} p.stakingAPR               — APR в BP (1200 = 12%)
 * @param {number} p.stakingDays              — длительность стейкинга в днях (например 365)
 * @param {number} [p.fundraisingDays=0]      — дней на сбор (0 = дефолт 30)
 * @param {string} [p.lotSupplier]            — адрес поставщика (если пусто — дефолтный supplierWallet контракта)
 * @param {number} [p.reservedCount=0]        — резервные доли (ghost) для админа
 * @param {string[]} [p.giftRecipients=[]]    — получатели подарочных долей
 * @param {number[]} [p.giftAmounts=[]]       — кол-во подарочных долей для каждого получателя
 */
export async function createFractionalLot(p) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  // USDT: 6 decimals (parse6) — это правильно для opBNB USDT
  const params = {
    costPriceUSDT:   parse6(String(p.costPriceUSDT)),
    totalFractions:  BigInt(p.totalFractions),
    stakingAPR:      parseInt(p.stakingAPR),
    stakingDays:     BigInt(p.stakingDays),
    fundraisingDays: BigInt(p.fundraisingDays || 0),
    lotSupplier:     p.lotSupplier || ethers.ZeroAddress,
    reservedCount:   BigInt(p.reservedCount || 0),
    giftRecipients:  Array.isArray(p.giftRecipients) ? p.giftRecipients : [],
    giftAmounts:     (Array.isArray(p.giftAmounts) ? p.giftAmounts : []).map(a => BigInt(a)),
  }
  // Сначала пробуем штатно (с симуляцией)
  try {
    const tx = await c.createLot(params)
    return await tx.wait()
  } catch (err) {
    // Если симуляция упала — пробуем явно с gasLimit (минуем eth_estimateGas)
    const msg = err?.shortMessage || err?.message || ''
    if (msg.includes('missing revert data') || msg.includes('cannot estimate gas') || msg.includes('execution reverted')) {
      console.warn('Estimate gas failed, retrying with explicit gasLimit:', msg)
      const tx = await c.createLot(params, { gasLimit: 800000n })
      return await tx.wait()
    }
    throw err
  }
}

// V2: startFundraising убрано — лот сразу создаётся в FUNDRAISING.
// Оставлено как noop для совместимости со старым UI.
export async function startLotFundraising(lotId) {
  return { skipped: true, reason: 'В V2 сбор стартует автоматически при создании лота' }
}

// V2: addCycleProfit заменён на confirmCycleSale
export async function addLotCycleProfit(lotId, profitUSDT) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.confirmCycleSale(lotId, parse6(String(profitUSDT)))
  return await tx.wait()
}

export async function fundLotStakingReserve(lotId, amountUSDT) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  // Approve USDT на контракт фракций (admin тоже должен approve)
  const amount = parse6(String(amountUSDT))
  await ensureUSDTApproval(ADDRESSES.FractionalGem, amount)
  const tx = await c.fundStakingReserve(lotId, amount)
  return await tx.wait()
}

// V2: ювелирка убрана из контракта (вся ювелирная логика теперь во внешних сервисах)
export async function requestLotJewelry(lotId, jewelryCost, mode) {
  return { skipped: true, reason: 'В V2 запрос ювелирки убран из контракта' }
}

export async function fundLotJewelry(lotId, amountUSDT) {
  return { skipped: true, reason: 'В V2 финансирование ювелирки убрано из контракта' }
}

export async function forceLotForSale(lotId) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.forceForSale(lotId)
  return await tx.wait()
}

// V2: confirmSale переименован в confirmFinalSale
export async function confirmLotSale(lotId, saleAmountUSDT) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.confirmFinalSale(lotId, parse6(String(saleAmountUSDT)))
  return await tx.wait()
}

// V2: emergencyClaimStaking — нет такой функции, осталось только cancelLot для отмены
export async function emergencyLotClaimStaking(lotId) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.cancelLot(lotId, true)
  return await tx.wait()
}

// V2: emergencyRefundToPartner убран — в V2 возврат идёт через refundCancelledLot (партнёр сам)
export async function emergencyRefundPartner(address, amountUSDT, reason) {
  return { skipped: true, reason: 'В V2 возврат идёт через cancelLot + refundCancelledLot (партнёр сам)' }
}

// ═══ Доп. функции V2 ═══
export async function payLotToSupplier(lotId) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.payToSupplier(lotId)
  return await tx.wait()
}

export async function clubBuyRemainingFractions(lotId) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.clubBuyRemaining(lotId)
  return await tx.wait()
}

export async function extendLotDeadline(lotId, additionalDays) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.extendDeadline(lotId, BigInt(additionalDays))
  return await tx.wait()
}

export async function cancelFractionalLot(lotId, force = false) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.cancelLot(lotId, !!force)
  return await tx.wait()
}

export async function getFractionalGemOwner() {
  const c = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  return await c.owner()
}

export async function getFractionalGemVersion() {
  const c = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  try { return await c.VERSION() } catch { return null }
}

export async function isFractionalGemAdmin(address) {
  const c = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  try {
    const [isAdmin, owner] = await Promise.all([
      c.admins(address),
      c.owner()
    ])
    return isAdmin || (owner && address && owner.toLowerCase() === address.toLowerCase())
  } catch { return false }
}

// Управление админами (owner-only)
export async function addFractionalAdmin(address) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.addAdmin(address)
  return await tx.wait()
}

export async function removeFractionalAdmin(address) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.removeAdmin(address)
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// GemShowcase — Витрина циклов (только чтение, управление из AdminPanel)
// ═══════════════════════════════════════════════════

export async function getGemShowcaseListings() {
  const c = getDCTRead('GemShowcase', GEMSHOWCASE_ABI)
  if (!c) return []
  try {
    const listings = await c.getActiveListings()
    return listings.map((l, i) => ({
      id: i,
      lotId: Number(l.lotId),
      salePrice: fmt6(l.salePrice),
      seller: l.seller,
      active: l.active,
      sold: l.sold,
    }))
  } catch { return [] }
}

// ═══════════════════════════════════════════════════
// ДОПОЛНИТЕЛЬНЫЕ ЭКСПОРТЫ (используются в DCTPage.jsx)
// ═══════════════════════════════════════════════════

// Загрузить полный дашборд DCT — токен + пользователь
export async function loadDCTDashboard(address) {
  try {
    const [tokenInfo, userInfo, claimableGems, exchangeStats, bestPrices, heritageInfo] = await Promise.all([
      getDCTTokenInfo().catch(() => null),
      address ? getDCTUserInfo(address).catch(() => null) : null,
      address ? getClaimableGems(address).catch(() => ({ purchaseIds: [], marketValues: [], estimatedDCT: [] })) : { purchaseIds: [], marketValues: [], estimatedDCT: [] },
      getExchangeStats().catch(() => null),
      getExchangeBestPrices().catch(() => null),
      address ? getHeritageInfo(address).catch(() => null) : null,
    ])
    return { tokenInfo, userInfo, claimableGems, exchangeStats, bestPrices, heritageInfo }
  } catch {
    return { tokenInfo: null, userInfo: null, claimableGems: { purchaseIds: [], marketValues: [], estimatedDCT: [] }, exchangeStats: null, bestPrices: null, heritageInfo: null }
  }
}

// Backing rate из DCTBridge
export async function getBridgeBackingRate() {
  const c = getDCTRead('DCTBridge', DCTBRIDGE_ABI)
  if (!c) return 0
  try { return Number(await c.BACKING_RATE_BP()) } catch { return 0 }
}

// Claim одного гема по purchaseId (алиас)
export async function claimGemDCT(purchaseId) {
  const c = getDCT('DCTBridge', DCTBRIDGE_ABI)
  const tx = await c.claimGemDCT(purchaseId)
  return await tx.wait()
}

// Металлы — пока не реализовано (MetalVault не задеплоен)
export async function getClaimableMetals(address) {
  return { ids: [], values: [], estimated: [] }
}

export async function claimAllMetalDCT() {
  throw new Error('Металлы пока не доступны')
}

// Таблица цен из FractionalGem
export async function getGemPriceTable() {
  const c = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  if (!c) return []
  try {
    const carats = await c.getRegisteredCarats()
    const table = []
    for (const ct of carats) {
      try {
        const info = await c.getPriceInfo(ct, false)
        const infoCert = await c.getPriceInfo(ct, true)
        table.push({
          caratX100: Number(ct),
          carat: Number(ct) / 100,
          cost: fmt6(info.cost),
          club: fmt6(info.club),
          wholesale: fmt6(info.ws),
          market: fmt6(info.mkt),
          costCert: fmt6(infoCert.cost),
          clubCert: fmt6(infoCert.club),
          wholesaleCert: fmt6(infoCert.ws),
          marketCert: fmt6(infoCert.mkt),
        })
      } catch {}
    }
    return table
  } catch { return [] }
}

// Купить целый камень (через FractionalGem — все доли)
export async function buyWholeGem(lotId) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const cRead = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  const lotInfo = await cRead.getLotInfo(lotId)
  const remaining = lotInfo.l.totalFractions - lotInfo.l.soldFractions
  if (remaining <= 0n) throw new Error('Все доли проданы')
  // Approve DCT
  const cost = lotInfo.l.fractionPriceDCT * remaining
  await ensureDCTApproval(ADDRESSES.FractionalGem, cost)
  const tx = await c.buyFractions(lotId, remaining)
  return await tx.wait()
}

// Голосование за продажу лота (алиас)
export async function voteForLotSale(lotId) {
  return await voteForSale(lotId)
}

// Забрать прибыль от продажи лота (алиас)
export async function claimLotSaleProceeds(lotId) {
  return await claimSaleProceeds(lotId)
}

// Количество записей в витрине
export async function getGemShowcaseCount() {
  const c = getDCTRead('GemShowcase', GEMSHOWCASE_ABI)
  if (!c) return 0
  try { return Number(await c.showcaseCount()) } catch { return 0 }
}

// GemShowcase — запись на витрину (нужен approve fractions)
const GEMSHOWCASE_WRITE_ABI = [
  'function createListing(uint256 lotId, uint256 salePrice)',
  'function buyListing(uint256 listingId)',
  'function cancelListing(uint256 listingId)',
]

export async function createGemShowcaseListing(lotId, salePriceUSDT) {
  const c = getDCT('GemShowcase', GEMSHOWCASE_WRITE_ABI)
  // Approve fractions for GemShowcase
  const fg = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const isApproved = await fg.isApprovedForAll(web3.address, ADDRESSES.GemShowcase)
  if (!isApproved) {
    const appTx = await fg.setApprovalForAll(ADDRESSES.GemShowcase, true)
    await appTx.wait()
  }
  const tx = await c.createListing(lotId, parse6(salePriceUSDT))
  return await tx.wait()
}

export async function buyFromGemShowcase(listingId) {
  const c = getDCT('GemShowcase', GEMSHOWCASE_WRITE_ABI)
  // Нужен USDT approve
  const cRead = getDCTRead('GemShowcase', GEMSHOWCASE_ABI)
  const listing = await cRead.showcaseListings(listingId)
  await ensureUSDTApproval(ADDRESSES.GemShowcase, listing.salePrice)
  const tx = await c.buyListing(listingId)
  return await tx.wait()
}

export async function cancelGemShowcaseListing(listingId) {
  const c = getDCT('GemShowcase', GEMSHOWCASE_WRITE_ABI)
  const tx = await c.cancelListing(listingId)
  return await tx.wait()
}

// DCTExchange — алиасы с именами из DCTPage
export async function fillSellOrderDCT(orderId, dctAmount) {
  return await fillSellOrder(orderId, dctAmount)
}

export async function fillBuyOrderDCT(orderId, dctAmount) {
  return await fillBuyOrder(orderId, dctAmount)
}

// Heritage — константы
export async function getHeritageConstants() {
  const c = getDCTRead('DCTHeritage', DCTHERIT_ABI)
  if (!c) return { minInactivity: 0, maxHeirs: 0 }
  try {
    const min = await c.MIN_INACTIVITY()
    const max = await c.MAX_HEIRS()
    return { minInactivity: Number(min), maxHeirs: Number(max) }
  } catch { return { minInactivity: 0, maxHeirs: 0 } }
}

// Heritage — исполнение (любой может вызвать если срок прошёл)
export async function executeHeritage(ownerAddress) {
  const c = getDCT('DCTHeritage', [
    'function execute(address owner)',
  ])
  const tx = await c.execute(ownerAddress)
  return await tx.wait()
}
