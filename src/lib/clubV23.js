'use client'
/**
 * Diamond Club v2.3 — Unified Contract Service Layer
 * ═══════════════════════════════════════════════════════
 * 
 * Заменяет 3 старых helper'а:
 *  - lib/diamondContracts.js (GemVaultV2, DiamondP2P, InsuranceFund, TrustScore, UserBoost, ReferralPool)
 *  - lib/dctContracts.js     (DCTToken, DCTBridge, FractionalGem, DCTExchange, GemFractionDEX, DCTHeritage, GemShowcase)
 *  - lib/clubLotsContracts.js (ClubLots)
 * 
 * Один файл — пять контрактов:
 *  - ClubDirectors  — голосование 60% директоров
 *  - ClubDCT        — токен DCT с заморозкой и эскроу
 *  - ClubMarketing  — распределение 10% по 9 уровням
 *  - ClubPools      — пулы, доли, P2P внутри пулов, redeem
 *  - ClubMarket     — магазин с эскроу, NSS купоны, lazy burn
 * 
 * USDT на opBNB = 18 decimals (не 6!) — поэтому используем formatEther/parseEther.
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
// MINIMAL ABIs (только функции которые нужны фронту)
// ═══════════════════════════════════════════════════

const CLUBDCT_ABI = [
  // ERC20
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  // Заморозка/разморозка
  'function getFrozenBalance(address user) view returns (uint256)',
  'function getUnlockedBalance(address user) view returns (uint256)',
  'function getHoldingsCount(address user) view returns (uint256)',
  'function getHoldingsByPool(address user, uint256 poolId) view returns (uint256)',
  'function getAllHoldings(address user) view returns (tuple(uint256 poolId, uint256 amount, uint64 unlocksAt)[])',
]

const CLUBPOOLS_ABI = [
  // Пулы — структура
  'function poolsCount() view returns (uint256)',
  'function getPool(uint256 poolId) view returns (tuple(string name, uint256 targetUSDT, uint256 collectedUSDT, uint256 totalShares, uint256 sharesSold, uint256 sharePrice, uint8 minGWLevel, uint8 status, uint64 createdAt, uint64 deadline, uint256 treasuryUSDT, uint256 totalDCT, uint256 itemId, uint256 saleAmount, uint64 redeemUnlocksAt, address creator))',
  'function getPoolStatus(uint256 poolId) view returns (uint8)',
  'function getCurrentDCTPrice(uint256 poolId) view returns (uint256)',
  'function getUserInvestment(address user, uint256 poolId) view returns (uint256)',
  'function getReserveBalance() view returns (uint256)',
  
  // Покупка доли в пуле
  'function buyShare(uint256 poolId, uint256 sharesCount)',
  
  // P2P — продажа долей пула между партнёрами
  'function listShareForSale(uint256 poolId, uint256 dctAmount, uint256 priceUSDT)',
  'function buyShareP2P(uint256 offerId)',
  'function cancelOffer(uint256 offerId)',
  
  // Redeem (выкуп камня партнёром)
  'function redeem(uint256 poolId, uint256 dctAmount)',
  'function redeemAtFloor(uint256 poolId)',
  
  // Аварийные функции
  'function claimInactivePool(uint256 poolId)',
  'function claimDrainedPool(uint256 poolId)',
  
  // Whitelist заводов (только multisig)
  'function approvedFactories(address factory) view returns (bool)',
  'function addFactory(address factory)',
  'function revokeFactory(address factory)',
  
  // Owner функции
  'function createPool(string name, uint256 targetUSDT, uint256 totalShares, uint8 minGWLevel, uint64 fundraisingDays)',
  'function recordGemPurchased(uint256 poolId, uint256 itemId, uint256 cost)',
  'function recordSale(uint256 poolId, uint256 saleAmount)',
  'function withdrawForGemPurchase(address to, uint256 amount)',
]

const CLUBMARKET_ABI = [
  // Items на витрине
  'function getItem(uint256 itemId) view returns (tuple(uint256 poolId, address seller, uint256 priceUSDT, string description, string imageURI, uint8 status, uint64 createdAt, address buyer, uint64 boughtAt))',
  'function getEscrow(uint256 itemId) view returns (tuple(uint256 amountUSDT, uint64 escrowEndsAt, uint8 status, string trackingNumber, uint64 shippedAt, uint64 confirmedAt))',
  'function getActiveItemCount() view returns (uint256)',
  
  // Покупка
  'function buyItem(uint256 itemId, uint256 dctToBurn)',
  'function buyItemWithCoupon(uint256 itemId, uint256 dctToBurn, uint16 discountBP, uint64 deadline, bytes signature)',
  'function buyItemWithDCT(uint256 itemId, uint256 dctAmount)',
  
  // Эскроу
  'function markShipped(uint256 itemId, string trackingNumber)',
  'function confirmReceived(uint256 itemId)',
  'function autoReleaseExpired(uint256 itemId)',
  'function disputeItem(uint256 itemId, string reason)',
  'function claimStuckEscrow(uint256 itemId)',
  
  // Партнёрская продажа (resale)
  'function listResale(uint256 poolItemId, uint256 priceUSDT, string description, string imageURI)',
  'function cancelListing(uint256 itemId)',
  
  // Owner функции
  'function listGemFromPool(uint256 poolId, uint256 priceUSDT, string description, string imageURI)',
  'function listJewelryFromPool(uint256 poolId, uint256 priceUSDT, string description, string imageURI)',
]

const CLUBMARKETING_ABI = [
  'function getBalance(address partner) view returns (uint256)',
  'function getEarningsByLevel(address partner) view returns (uint256[9])',
  'function getCurrentPhase() view returns (uint8)',
  'function adsToPhaseSwitch() view returns (uint256)',
  'function claim()',
  'function claimInactive()',
]

const CLUBDIRECTORS_ABI = [
  'function getDirectors() view returns (address[])',
  'function getDirectorsCount() view returns (uint256)',
  'function requiredApprovals() view returns (uint256)',
  'function getProposal(uint256 proposalId) view returns (tuple(address target, uint8 action, bytes data, uint256 createdAt, uint256 approvalCount, uint8 status, address[] approvers))',
  'function getAllProposals() view returns (uint256[])',
]

// ═══════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════

const fmt = ethers.formatEther          // 18 decimals
const fmt6 = ethers.formatEther         // opBNB USDT = 18 decimals (alias)
const parse = ethers.parseEther
const parse6 = (v) => ethers.parseEther(String(v))   // opBNB USDT = 18 decimals

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
  const abi = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
  ]
  return new ethers.Contract(ADDRESSES.USDT, abi, web3.signer)
}

async function ensureUSDTApproval(spender, amount) {
  const usdt = getUSDT()
  const currentAllowance = await usdt.allowance(web3.address, spender)
  if (currentAllowance < amount) {
    const tx = await usdt.approve(spender, amount)
    await tx.wait()
  }
}

async function ensureDCTApproval(spender, amount) {
  const dct = getContract('ClubDCT', CLUBDCT_ABI)
  const currentAllowance = await dct.allowance(web3.address, spender)
  if (currentAllowance < amount) {
    const tx = await dct.approve(spender, amount)
    await tx.wait()
  }
}

// ═══════════════════════════════════════════════════
// CLUB DCT — токен DCT
// ═══════════════════════════════════════════════════

export async function getDCTBalance(address) {
  const c = getReadContract('ClubDCT', CLUBDCT_ABI)
  if (!c || !address) return '0'
  try { return fmt(await c.balanceOf(address)) } catch { return '0' }
}

export async function getDCTUserInfo(address) {
  const c = getReadContract('ClubDCT', CLUBDCT_ABI)
  if (!c || !address) return null
  try {
    const [total, frozen, unlocked] = await Promise.all([
      c.balanceOf(address),
      c.getFrozenBalance(address),
      c.getUnlockedBalance(address),
    ])
    return {
      total: fmt(total),
      locked: fmt(frozen),       // алиас старого имени
      free: fmt(unlocked),       // алиас старого имени
      frozen: fmt(frozen),
      unlocked: fmt(unlocked),
    }
  } catch { return null }
}

export async function getDCTHoldings(address) {
  const c = getReadContract('ClubDCT', CLUBDCT_ABI)
  if (!c || !address) return []
  try {
    const all = await c.getAllHoldings(address)
    return all.map(h => ({
      poolId: Number(h.poolId),
      amount: fmt(h.amount),
      unlocksAt: Number(h.unlocksAt),
    }))
  } catch { return [] }
}

export async function getDCTTokenInfo() {
  const c = getReadContract('ClubDCT', CLUBDCT_ABI)
  if (!c) return null
  try {
    const supply = await c.totalSupply()
    return {
      totalSupply: fmt(supply),
      // Текущая цена DCT — через ClubPools, не ClubDCT
      // (цена зависит от treasury конкретного пула)
    }
  } catch { return null }
}

// ═══════════════════════════════════════════════════
// CLUB POOLS — пулы и доли
// ═══════════════════════════════════════════════════

export async function getPoolsCount() {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c) return 0
  try { return Number(await c.poolsCount()) } catch { return 0 }
}

export async function getPool(poolId) {
  const c = getReadContract('ClubPools', CLUBPOOLS_ABI)
  if (!c) return null
  try {
    const p = await c.getPool(poolId)
    return {
      poolId,
      name: p.name,
      targetUSDT: fmt(p.targetUSDT),
      collectedUSDT: fmt(p.collectedUSDT),
      totalShares: Number(p.totalShares),
      sharesSold: Number(p.sharesSold),
      sharePrice: fmt(p.sharePrice),
      minGWLevel: Number(p.minGWLevel),
      status: Number(p.status),  // 0=Fundraising, 1=Funded, 2=GemBought, 3=Sold, 4=Cancelled, 5=Drained
      createdAt: Number(p.createdAt),
      deadline: Number(p.deadline),
      treasuryUSDT: fmt(p.treasuryUSDT),
      totalDCT: fmt(p.totalDCT),
      itemId: Number(p.itemId),
      saleAmount: fmt(p.saleAmount),
      redeemUnlocksAt: Number(p.redeemUnlocksAt),
      creator: p.creator,
    }
  } catch { return null }
}

export async function getAllPools() {
  const count = await getPoolsCount()
  if (count === 0) return []
  const pools = []
  for (let i = 0; i < count; i++) {
    const p = await getPool(i)
    if (p) pools.push(p)
  }
  return pools
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

// Покупка доли — основная функция партнёра
export async function buyShare(poolId, sharesCount) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const cRead = getReadContract('ClubPools', CLUBPOOLS_ABI)
  const pool = await cRead.getPool(poolId)
  const totalCost = pool.sharePrice * BigInt(sharesCount)
  // approve USDT
  await ensureUSDTApproval(ADDRESSES.ClubPools, totalCost)
  const tx = await c.buyShare(poolId, sharesCount)
  return await tx.wait()
}

// P2P — выставить долю на продажу
export async function listShareForSaleP2P(poolId, dctAmount, priceUSDT) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.listShareForSale(poolId, parse(dctAmount), parse6(priceUSDT))
  return await tx.wait()
}

// P2P — купить чью-то долю
export async function buyShareP2P(offerId, priceUSDT) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  await ensureUSDTApproval(ADDRESSES.ClubPools, parse6(priceUSDT))
  const tx = await c.buyShareP2P(offerId)
  return await tx.wait()
}

export async function cancelP2POffer(offerId) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.cancelOffer(offerId)
  return await tx.wait()
}

// Redeem — выкуп камня партнёром (текущая цена DCT)
export async function redeem(poolId, dctAmount) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  await ensureDCTApproval(ADDRESSES.ClubPools, parse(dctAmount))
  const tx = await c.redeem(poolId, parse(dctAmount))
  return await tx.wait()
}

// Redeem at floor — защитная цена $0.56
export async function redeemAtFloor(poolId) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.redeemAtFloor(poolId)
  return await tx.wait()
}

// Claim из stuck-пула (90 дней без активности)
export async function claimInactivePool(poolId) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.claimInactivePool(poolId)
  return await tx.wait()
}

// Claim из drained-контракта (после форс-мажора)
export async function claimDrainedPool(poolId) {
  const c = getContract('ClubPools', CLUBPOOLS_ABI)
  const tx = await c.claimDrainedPool(poolId)
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// CLUB MARKET — магазин с эскроу
// ═══════════════════════════════════════════════════

export async function getActiveItemCount() {
  const c = getReadContract('ClubMarket', CLUBMARKET_ABI)
  if (!c) return 0
  try { return Number(await c.getActiveItemCount()) } catch { return 0 }
}

export async function getMarketItem(itemId) {
  const c = getReadContract('ClubMarket', CLUBMARKET_ABI)
  if (!c) return null
  try {
    const item = await c.getItem(itemId)
    return {
      itemId,
      poolId: Number(item.poolId),
      seller: item.seller,
      priceUSDT: fmt(item.priceUSDT),
      description: item.description,
      imageURI: item.imageURI,
      status: Number(item.status),  // 0=Listed, 1=Sold, 2=Cancelled
      createdAt: Number(item.createdAt),
      buyer: item.buyer,
      boughtAt: Number(item.boughtAt),
    }
  } catch { return null }
}

export async function getEscrow(itemId) {
  const c = getReadContract('ClubMarket', CLUBMARKET_ABI)
  if (!c) return null
  try {
    const e = await c.getEscrow(itemId)
    return {
      itemId,
      amountUSDT: fmt(e.amountUSDT),
      escrowEndsAt: Number(e.escrowEndsAt),
      status: Number(e.status),    // 0=None, 1=Pending, 2=Shipped, 3=Confirmed, 4=Disputed, 5=Released
      trackingNumber: e.trackingNumber,
      shippedAt: Number(e.shippedAt),
      confirmedAt: Number(e.confirmedAt),
    }
  } catch { return null }
}

// Покупка камня через ClubMarket
// dctToBurn — сколько DCT партнёр хочет потратить (из своих unlocked)
export async function buyItem(itemId, dctToBurn = '0') {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const cRead = getReadContract('ClubMarket', CLUBMARKET_ABI)
  const item = await cRead.getItem(itemId)
  
  // Подсчёт сколько USDT нужно после применения DCT
  // (цена DCT определяется в контракте на момент покупки)
  // Для простоты — approve полную цену в USDT, контракт спишет нужное
  await ensureUSDTApproval(ADDRESSES.ClubMarket, item.priceUSDT)
  
  // Если есть DCT для сжигания — approve их тоже
  if (parse(dctToBurn) > 0n) {
    await ensureDCTApproval(ADDRESSES.ClubMarket, parse(dctToBurn))
  }
  
  const tx = await c.buyItem(itemId, parse(dctToBurn))
  return await tx.wait()
}

// Покупка только за DCT (lazy burn — DCT блокируются до confirmReceived)
export async function buyItemWithDCT(itemId, dctAmount) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  await ensureDCTApproval(ADDRESSES.ClubMarket, parse(dctAmount))
  const tx = await c.buyItemWithDCT(itemId, parse(dctAmount))
  return await tx.wait()
}

// Покупка с купоном NSS (со скидкой)
export async function buyItemWithCoupon(itemId, dctToBurn, discountBP, deadline, signature) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const cRead = getReadContract('ClubMarket', CLUBMARKET_ABI)
  const item = await cRead.getItem(itemId)
  
  // Сумма к оплате со скидкой
  const discounted = item.priceUSDT - (item.priceUSDT * BigInt(discountBP)) / 10000n
  await ensureUSDTApproval(ADDRESSES.ClubMarket, discounted)
  
  if (parse(dctToBurn) > 0n) {
    await ensureDCTApproval(ADDRESSES.ClubMarket, parse(dctToBurn))
  }
  
  const tx = await c.buyItemWithCoupon(itemId, parse(dctToBurn), discountBP, deadline, signature)
  return await tx.wait()
}

// Продавец отметил отправку
export async function markShipped(itemId, trackingNumber) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.markShipped(itemId, trackingNumber)
  return await tx.wait()
}

// Покупатель подтверждает получение
export async function confirmReceived(itemId) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.confirmReceived(itemId)
  return await tx.wait()
}

// Авто-релиз (после 30 дней)
export async function autoReleaseExpired(itemId) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.autoReleaseExpired(itemId)
  return await tx.wait()
}

// Открыть спор
export async function disputeItem(itemId, reason) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.disputeItem(itemId, reason)
  return await tx.wait()
}

// Claim stuck (если продавец/покупатель пропали)
export async function claimStuckEscrow(itemId) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.claimStuckEscrow(itemId)
  return await tx.wait()
}

// Партнёрская перепродажа (resale своего камня)
export async function listResale(poolItemId, priceUSDT, description, imageURI) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.listResale(poolItemId, parse6(priceUSDT), description, imageURI)
  return await tx.wait()
}

export async function cancelListing(itemId) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.cancelListing(itemId)
  return await tx.wait()
}

// Owner — выставить камень из пула на продажу
export async function listGemFromPool(poolId, priceUSDT, description, imageURI) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.listGemFromPool(poolId, parse6(priceUSDT), description, imageURI)
  return await tx.wait()
}

export async function listJewelryFromPool(poolId, priceUSDT, description, imageURI) {
  const c = getContract('ClubMarket', CLUBMARKET_ABI)
  const tx = await c.listJewelryFromPool(poolId, parse6(priceUSDT), description, imageURI)
  return await tx.wait()
}

// Получить все активные items (для витрины)
export async function getAllMarketItems() {
  const count = await getActiveItemCount()
  if (count === 0) return []
  const items = []
  // ВАЖНО: getActiveItemCount возвращает счётчик ВСЕХ items за всю историю.
  // Чтобы показать только активные — фильтруем по status.
  for (let i = 0; i < count; i++) {
    const item = await getMarketItem(i)
    if (item && item.status === 0) {
      items.push(item)
    }
  }
  return items
}

// ═══════════════════════════════════════════════════
// CLUB MARKETING — комиссии партнёров
// ═══════════════════════════════════════════════════

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
  try { return Number(await c.getCurrentPhase()) } catch { return 0 }
}

// Партнёр забирает свои комиссии
export async function claimMarketing() {
  const c = getContract('ClubMarketing', CLUBMARKETING_ABI)
  const tx = await c.claim()
  return await tx.wait()
}

// Алиас для совместимости
export const claimReferralBonus = claimMarketing

// ═══════════════════════════════════════════════════
// CLUB DIRECTORS — голосование (для админ-панели)
// ═══════════════════════════════════════════════════

export async function getDirectors() {
  const c = getReadContract('ClubDirectors', CLUBDIRECTORS_ABI)
  if (!c) return []
  try { return await c.getDirectors() } catch { return [] }
}

export async function getDirectorsCount() {
  const c = getReadContract('ClubDirectors', CLUBDIRECTORS_ABI)
  if (!c) return 0
  try { return Number(await c.getDirectorsCount()) } catch { return 0 }
}

export async function getRequiredApprovals() {
  const c = getReadContract('ClubDirectors', CLUBDIRECTORS_ABI)
  if (!c) return 0
  try { return Number(await c.requiredApprovals()) } catch { return 0 }
}

export async function getAllProposals() {
  const c = getReadContract('ClubDirectors', CLUBDIRECTORS_ABI)
  if (!c) return []
  try {
    const ids = await c.getAllProposals()
    return ids.map(id => Number(id))
  } catch { return [] }
}

export async function getProposal(proposalId) {
  const c = getReadContract('ClubDirectors', CLUBDIRECTORS_ABI)
  if (!c) return null
  try {
    const p = await c.getProposal(proposalId)
    return {
      proposalId,
      target: p.target,
      action: Number(p.action),
      data: p.data,
      createdAt: Number(p.createdAt),
      approvalCount: Number(p.approvalCount),
      status: Number(p.status),
      approvers: p.approvers,
    }
  } catch { return null }
}

// ═══════════════════════════════════════════════════
// ОБЩИЙ ДАШБОРД (для DiamondClubPage)
// ═══════════════════════════════════════════════════

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
    ] = await Promise.all([
      getDCTUserInfo(address),
      getDCTHoldings(address),
      getPoolsCount(),
      getReserveBalance(),
      getMarketingBalance(address),
      getActiveItemCount(),
    ])
    return {
      dctInfo,
      holdings,
      poolsCount,
      reserveBalance,
      marketingBalance,
      activeItemCount,
    }
  } catch (e) {
    console.error('loadDashboard error:', e)
    return null
  }
}

// Алиасы для совместимости со старыми компонентами:
export const loadDiamondClubDashboard = loadDashboard
export const loadDCTDashboard = loadDashboard

// ═══════════════════════════════════════════════════
// SAFECALL — обёртка с обработкой ошибок (используется в компонентах)
// ═══════════════════════════════════════════════════

export async function safeCall(fn) {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    const msg = err?.reason || err?.shortMessage || err?.message || 'Неизвестная ошибка'
    if (msg.includes('user rejected')) return { ok: false, error: 'Транзакция отклонена' }
    if (msg.includes('insufficient funds')) return { ok: false, error: 'Недостаточно средств (BNB на газ)' }
    const reason = msg.match(/reason="([^"]+)"/)?.[1] || msg.match(/reverted: (.+)/)?.[1]
    if (reason) return { ok: false, error: `Контракт: ${reason}` }
    return { ok: false, error: msg.slice(0, 120) }
  }
}

// ═══════════════════════════════════════════════════
// ЗАГЛУШКИ — функционал отсутствует в v2.3
// ═══════════════════════════════════════════════════
// Эти функции возвращают пустые/безопасные значения чтобы фронт
// не падал, пока не переделаны компоненты.

// TrustScore — удалено
export async function getUserTrustInfo() {
  return { score: 0, tier: 0, canPurchase: true, canStake: true, canShowcase: true }
}

// UserBoost — удалено
export async function getUserBoostInfo() {
  return { totalBurned: '0', currentBoostBP: 0, totalStakingRateBP: 0 }
}
export async function burnNSTForBoost() {
  throw new Error('Boost-функция удалена в v2.3')
}

// InsuranceFund — удалено (отдельный инструмент)
export async function getInsuranceFundStats() {
  return { balance: '0', deposited: '0', paidClaims: '0' }
}
export async function getInsuranceUserBalance() { return '0' }
export async function getUserWithdrawRequests() { return [] }
export async function requestWithdraw() { throw new Error('Insurance удалён в v2.3') }
export async function executeWithdraw() { throw new Error('Insurance удалён в v2.3') }
export async function verifyAsset() { throw new Error('Insurance удалён в v2.3') }
export async function submitClaim() { throw new Error('Insurance удалён в v2.3') }

// DCTHeritage — удалено
export async function getHeritageInfo() { return null }
export async function getHeirs() { return { wallets: [], shares: [], labels: [] } }
export async function checkHeritageApprovals() { return { dctApproved: false, fractionsApproved: false } }
export async function getHeritageConstants() { return { minInactivity: 0, maxHeirs: 0 } }
export async function configureHeritage() { throw new Error('Heritage удалён в v2.3') }
export async function cancelHeritage() { throw new Error('Heritage удалён в v2.3') }
export async function pingHeritage() { throw new Error('Heritage удалён в v2.3') }
export async function executeHeritage() { throw new Error('Heritage удалён в v2.3') }

// DCTBridge (gem→DCT claim) — удалено (DCT начисляется сразу в buyShare)
export async function getClaimableGems() {
  return { purchaseIds: [], marketValues: [], estimatedDCT: [] }
}
export async function claimGemDCT() { throw new Error('Bridge удалён — DCT начисляется автоматически') }
export async function claimAllGemDCT() { throw new Error('Bridge удалён — DCT начисляется автоматически') }
export async function getBridgeBackingRate() { return 0 }

// DCTExchange — будет в v2.4
export async function getExchangeStats() { return null }
export async function getExchangeBestPrices() { return null }
export async function getActiveSellOrders() { return [] }
export async function getActiveBuyOrders() { return [] }
export async function createSellOrderDCT() { throw new Error('Биржа DCT будет в v2.4') }
export async function createBuyOrderDCT() { throw new Error('Биржа DCT будет в v2.4') }
export async function fillSellOrderDCT() { throw new Error('Биржа DCT будет в v2.4') }
export async function fillBuyOrderDCT() { throw new Error('Биржа DCT будет в v2.4') }
export async function cancelExchangeOrder() { throw new Error('Биржа DCT будет в v2.4') }

// GemFractionDEX (P2P для долей) — заменено на P2P в ClubPools
export async function getFractionDEXOrders() { return [] }
export async function createFractionSellOrder(poolId, fractions, priceDCT) {
  return await listShareForSaleP2P(poolId, fractions, priceDCT)
}
export async function fillFractionSellOrder(offerId) {
  return await buyShareP2P(offerId, 0)  // priceUSDT берётся из offer'а
}
export async function cancelFractionSellOrder(offerId) {
  return await cancelP2POffer(offerId)
}

// GemShowcase — заменено на ClubMarket
export async function getGemShowcaseListings() {
  return await getAllMarketItems()
}
export async function getGemShowcaseCount() {
  return await getActiveItemCount()
}
export async function createGemShowcaseListing(itemId, priceUSDT) {
  return await listResale(itemId, priceUSDT, '', '')
}
export async function buyFromGemShowcase(itemId) {
  return await buyItem(itemId, '0')
}
export async function cancelGemShowcaseListing(itemId) {
  return await cancelListing(itemId)
}
export async function buyWholeGem(itemId) {
  return await buyItem(itemId, '0')
}

// FractionalLot (старая логика лотов) — заменено на пулы
export async function getAllFractionalLots() {
  return await getAllPools()
}
export async function getUserLotInfo(poolId, address) {
  const inv = await getUserInvestment(address, poolId)
  return { contributedUSDT: inv, mintedDCT: '0' }
}
export async function buyFractions(poolId, count) {
  return await buyShare(poolId, count)
}
export async function getClaimableStaking() { return '0' }
export async function claimFractionalStaking() {
  throw new Error('Стейкинг встроен в пулы — используй redeem')
}
export async function createFractionalLot() {
  throw new Error('Используй createPool')
}
export async function startLotFundraising() { throw new Error('createPool сразу запускает сбор') }
export async function fundLotStakingReserve() { throw new Error('Резерв формируется автоматически') }
export async function addLotCycleProfit() { throw new Error('Прибыль начисляется через recordSale') }
export async function requestLotJewelry() { throw new Error('Используй listJewelryFromPool') }
export async function confirmLotSale() { throw new Error('Используй recordSale') }
export async function voteForLotSale() { throw new Error('Голосование убрано — owner управляет') }
export async function claimLotSaleProceeds(poolId) { return await redeem(poolId, '0') }
export async function forceLotForSale() { throw new Error('Используй emergencyDeclare') }
export async function emergencyLotClaimStaking(poolId) { return await claimDrainedPool(poolId) }
export async function addFractionalAdmin() { throw new Error('Админы управляются через ClubDirectors') }
export async function removeFractionalAdmin() { throw new Error('Админы управляются через ClubDirectors') }
export async function getGemPriceTable() { return [] }

// Старые покупки (gem purchases) — теперь это items в ClubMarket
export async function getUserGemPurchases(address) {
  // В новой системе — это items которые человек купил.
  // Возвращаем пустой массив — фронт должен брать через getMarketItem(itemId)
  return []
}
export async function claimGemStaking() {
  throw new Error('Стейкинг встроен в пулы')
}
export async function convertGemToAsset() {
  throw new Error('Все покупки сразу являются физическими активами')
}
export async function restakeGem() {
  throw new Error('Restake встроен в пулы автоматически')
}

// Старый P2P → теперь P2P внутри ClubPools
export async function getP2PListings() { return [] }
export async function getP2PStats() { return { trades: 0, volume: '0', commissions: '0' } }
export async function listOnP2P(vault, purchaseId, priceUSDT) {
  // Маппинг: vault не используется (в новой системе только один источник — пулы)
  // purchaseId здесь = poolId
  throw new Error('Используй listShareForSaleP2P(poolId, dctAmount, priceUSDT)')
}
export async function buyFromP2P(listingId) { return await buyShareP2P(listingId, 0) }
export async function cancelP2PListing(listingId) { return await cancelP2POffer(listingId) }

// Старые ClubLots функции
export async function buyShareFromBalance(poolId, count) {
  // В v2.3 нет "balance" в ClubLots — есть marketing balance
  // Партнёр сначала claim'ит маркетинг, потом покупает за USDT
  throw new Error('Сначала claim() в ClubMarketing, затем buyShare(poolId, count)')
}
export async function claimEarnings() {
  return await claimMarketing()
}
export async function claimCompensation(poolId) {
  return await claimDrainedPool(poolId)
}
export async function createLotOnChain(...args) {
  throw new Error('Используй ClubPools.createPool через owner-кошелёк')
}
