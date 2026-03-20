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
  // Views — лоты
  'function getLotCount() view returns (uint256)',
  'function getLotInfo(uint256 id) view returns (tuple(uint256 gemId, uint16 caratX100, string name, string imageURI, uint8 certLab, string certNumber, bool certified, uint256 costPrice, uint256 clubPrice, uint256 wholesalePrice, uint256 totalFractions, uint256 soldFractions, uint256 fractionPriceDCT, uint8 mode, uint16 stakingAPR, uint64 stakingStartedAt, uint256 stakingDays, uint256 totalCycleProfit, uint8 cyclesCompleted, uint256 jewelryCost, uint256 jewelryFunded, bool jewelryActive, uint256 saleAmountUSDT, uint8 status, address lotSupplier, address lotOriginator) l, uint256 sr, uint256 tv)',
  'function getUserLotInfo(uint256 id, address u) view returns (uint256 fr, uint256 cl, bool v, uint256 pct)',
  'function getLotStatus(uint256 id) view returns (uint8)',
  'function getLotCostPrice(uint256 id) view returns (uint256)',
  'function getLotCyclesCompleted(uint256 id) view returns (uint8)',
  'function holderFractions(uint256, address) view returns (uint256)',
  'function stakingReserveUSDT(uint256) view returns (uint256)',
  'function getClaimableStaking(uint256 lotId, address user) view returns (uint256)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
  'function lotCount() view returns (uint256)',
  'function MAX_CYCLES() view returns (uint8)',
  // Views — цены
  'function getClubPrice(uint256 caratX100, bool cert) view returns (uint256)',
  'function getWholesalePrice(uint256 caratX100, bool cert) view returns (uint256)',
  'function getMarketPrice(uint256 caratX100, bool cert) view returns (uint256)',
  'function getPriceInfo(uint256 c, bool cert) view returns (uint256 cost, uint256 club, uint256 ws, uint256 mkt)',
  'function getRegisteredCarats() view returns (uint256[])',
  // Write
  'function buyFractions(uint256 lotId, uint256 amount)',
  'function claimStaking(uint256 lotId)',
  'function voteForSale(uint256 lotId)',
  'function claimSaleProceeds(uint256 lotId)',
  'function setApprovalForAll(address operator, bool approved)',
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
const fmt6 = (v) => ethers.formatUnits(v, 6)  // USDT 6 decimals
const parse = ethers.parseEther
const parse6 = (v) => ethers.parseUnits(String(v), 6)

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
    const count = Number(await c.getLotCount())
    const lots = []
    for (let i = 0; i < count && i < 100; i++) {
      try {
        const [lotData, stakingReserve, totalValue] = await c.getLotInfo(i)
        lots.push({
          id: i,
          gemId: Number(lotData.gemId),
          caratX100: Number(lotData.caratX100),
          carats: (Number(lotData.caratX100) / 100).toFixed(2),
          name: lotData.name,
          imageURI: lotData.imageURI,
          certified: lotData.certified,
          certLab: Number(lotData.certLab),
          certNumber: lotData.certNumber,
          costPrice: fmt6(lotData.costPrice),
          clubPrice: fmt6(lotData.clubPrice),
          wholesalePrice: fmt6(lotData.wholesalePrice),
          totalFractions: Number(lotData.totalFractions),
          soldFractions: Number(lotData.soldFractions),
          fractionPriceDCT: fmt(lotData.fractionPriceDCT),
          mode: Number(lotData.mode),
          // mode: 0=CREATED, 1=FUNDRAISING, 2=STAKING, 3=JEWELRY, 4=FOR_SALE, 5=SOLD, 6=CLOSED
          stakingAPR: Number(lotData.stakingAPR),
          stakingStartedAt: Number(lotData.stakingStartedAt),
          stakingDays: Number(lotData.stakingDays),
          totalCycleProfit: fmt6(lotData.totalCycleProfit),
          cyclesCompleted: Number(lotData.cyclesCompleted),
          jewelryCost: fmt6(lotData.jewelryCost),
          jewelryFunded: fmt6(lotData.jewelryFunded),
          jewelryActive: lotData.jewelryActive,
          saleAmountUSDT: fmt6(lotData.saleAmountUSDT),
          status: Number(lotData.status),
          supplier: lotData.lotSupplier,
          originator: lotData.lotOriginator,
          // Дополнительно
          stakingReserve: fmt6(stakingReserve),
          totalValue: fmt6(totalValue),
        })
      } catch { break }
    }
    return lots
  } catch { return [] }
}

export async function getUserLotInfo(lotId, address) {
  const c = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  if (!c) return null
  try {
    const info = await c.getUserLotInfo(lotId, address)
    return {
      fractions: Number(info.fr),           // мои доли
      claimableStaking: fmt6(info.cl),       // доступный стейкинг-доход в USDT
      hasVoted: info.v,                      // голосовал за продажу?
      ownershipPct: Number(info.pct),        // % владения (BP, /100 для %)
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

export async function buyFractions(lotId, amount) {
  // Оплата DCT — нужен approve DCT на FractionalGem
  const cRead = getDCTRead('FractionalGem', FRACTIONALGEM_ABI)
  const lotInfo = await cRead.getLotInfo(lotId)
  const fractionPrice = lotInfo[0].fractionPriceDCT
  const totalCost = fractionPrice * BigInt(amount)
  await ensureDCTApproval(ADDRESSES.FractionalGem, totalCost)
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.buyFractions(lotId, amount)
  return await tx.wait()
}

export async function claimFractionalStaking(lotId) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.claimStaking(lotId)
  return await tx.wait()
}

export async function voteForSale(lotId) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.voteForSale(lotId)
  return await tx.wait()
}

export async function claimSaleProceeds(lotId) {
  const c = getDCT('FractionalGem', FRACTIONALGEM_ABI)
  const tx = await c.claimSaleProceeds(lotId)
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
