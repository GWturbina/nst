'use client'
/**
 * NSS Diamond Club v10.2 — Contract Service Layer
 * GemVaultV2 + DiamondP2P + InsuranceFund + TrustScore + UserBoost + ReferralPool + ShowcaseMarket
 * MetalVault отключён (заглушен). P2P вынесен в DiamondP2P.
 * Все вызовы Diamond Club контрактов в одном месте.
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
// MINIMAL ABIs (для чтения — без ABI файлов)
// ═══════════════════════════════════════════════════

const GEMVAULT_ABI = [
  // Views
  'function getClubPrice(uint256 gemId) view returns (uint256)',
  'function getPriceBreakdown(uint256 gemId) view returns (uint256 market, uint256 club, uint256 insurance, uint256 marketing, uint256 supplier_, uint256 staking, uint256 clubFund_, uint256 author_)',
  'function getStakingReward(uint256 purchaseId) view returns (uint256 reward, bool ready)',
  'function getUserPurchases(address user) view returns (uint256[])',
  'function getPurchaseInfo(uint256 id) view returns (uint256 gemId, address buyer, uint8 mode, uint8 status, uint256 pricePaid, uint256 marketValue, uint16 stakingRateBP, uint64 stakingEndsAt, uint256 pendingReward)',
  'function getVaultStats() view returns (uint256 totalSales, uint256 reserve, uint256 paidOut, uint256 catCount, uint256 gemCount, uint256 purchaseCount)',
  'function gems(uint256) view returns (uint256 categoryId, string name, string certHash, uint256 marketPrice, uint256 weight, bool available, bool fractional, uint256 totalFractions, uint256 soldFractions)',
  'function categories(uint256) view returns (string name, string assetType, uint256 stakingPeriod, uint256 minInvestment, address supplier, bool active)',
  'function clubDiscountBP() view returns (uint256)',
  'function stakingReserve() view returns (uint256)',
  // Write
  'function buyGem(uint256 gemId, uint8 mode, uint256 fractions)',
  'function convertToAsset(uint256 purchaseId)',
  'function claimStaking(uint256 purchaseId, uint8 option)',
  'function restake(uint256 purchaseId)',
]

const DIAMONDP2P_ABI = [
  // Views
  'function getListing(uint256 id) view returns (tuple(address vault, uint256 purchaseId, address seller, uint256 price, bool active))',
  'function getListingCount() view returns (uint256)',
  'function getStats() view returns (uint256 trades, uint256 volume, uint256 commissions)',
  'function isListed(address vault, uint256 purchaseId) view returns (bool)',
  'function defaultCommissionBP() view returns (uint256)',
  'function vaultListingId(address vault, uint256 purchaseId) view returns (uint256)',
  // Write
  'function list(address vault, uint256 purchaseId, uint256 price)',
  'function buy(uint256 listingId)',
  'function cancel(uint256 listingId)',
]

// MetalVault ABI отключён — контракт не задеплоен

const INSURANCE_ABI = [
  'function userBalance(address) view returns (uint256)',
  'function isFrozen(address) view returns (bool)',
  'function getFundStats() view returns (uint256 balance, uint256 deposited, uint256 paidClaims, uint256 confiscated_, uint256 withdrawn)',
  'function getBalanceBreakdown() view returns (uint256 usdtOnContract, uint256 fundBalance, uint256 usersTotal, uint256 pendingWithdrawals, uint256 accountedTotal)',
  'function getUserWithdrawals(address user) view returns (uint256[])',
  'function withdrawRequests(uint256) view returns (uint256 id, address user, uint256 amount, uint64 requestedAt, uint64 availableAt, uint8 status)',
  'function withdrawDelay() view returns (uint64)',
  'function getVerificationStatus(uint256 purchaseId) view returns (address owner_, uint64 lastVerified, uint64 nextDeadline, bool verified, uint16 missedCount, bool overdue)',
  'function requestWithdraw(uint256 amount)',
  'function executeWithdraw(uint256 requestId)',
  'function verifyAsset(uint256 purchaseId)',
  'function submitClaim(uint256 purchaseId, uint256 claimAmount, string reason, string evidenceIPFS)',
]

const TRUSTSCORE_ABI = [
  'function getScore(address user) view returns (uint16)',
  'function getTier(address user) view returns (uint8)',
  'function getUserInfo(address user) view returns (uint16 score, uint8 tier, uint64 lastActivity, bool canPurchase, bool canStake, bool canShowcase)',
]

const USERBOOST_ABI = [
  'function getStakingRate(address user) view returns (uint16)',
  'function getUserBoostInfo(address user) view returns (uint256 totalBurned, uint16 currentBoostBP, uint16 totalStakingRateBP, uint64 lastBoostTime, uint256 nstToNextLevel, uint16 nextLevelBP)',
  'function getBoostBP(address user) view returns (uint16)',
  'function getBoostLevelsCount() view returns (uint256)',
  'function boostLevels(uint256) view returns (uint256 nstThreshold, uint16 boostBP)',
  'function baseStakingRateBP() view returns (uint16)',
  'function maxStakingRateBP() view returns (uint16)',
  'function totalNSTBurned() view returns (uint256)',
  'function boost(uint256 nstAmount)',
]

const REFERRALPOOL_ABI = [
  'function claimable(address) view returns (uint256)',
  'function getReferrer(address user) view returns (address)',
  'function getDirectReferrals(address user) view returns (address[])',
  'function getPoolBalance() view returns (uint256)',
  'function claim()',
]

const SHOWCASE_ABI = [
  'function getListing(uint256 id) view returns (tuple(uint256 id, address seller, address agent, uint8 assetType, string title, string description, string imageURI, string certURI, uint256 priceUSDT, uint8 status, uint64 listedAt, uint64 soldAt, address buyer))',
  'function getActiveListings() view returns (uint256[])',
  'function getMarketStats() view returns (uint256 total, uint256 sales, uint256 burned, uint256 commissions)',
  'function isAgent(address user) view returns (bool)',
  'function listOnShowcase(uint8 assetType, string title, string description, string imageURI, string certURI, uint256 priceUSDT)',
  'function confirmSale(uint256 listingId, address buyer)',
  'function cancelListing(uint256 listingId)',
  'function buyAgentLicense()',
]

// ═══════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════

const fmt = ethers.formatEther
const fmt6 = (v) => ethers.formatUnits(v, 6)  // USDT 6 decimals
const parse = ethers.parseEther
const parse6 = (v) => ethers.parseUnits(v, 6) // USDT 6 decimals

function getDC(name, abi) {
  if (!web3.signer) throw new Error('Кошелёк не подключён')
  const addr = ADDRESSES[name]
  if (!addr || addr.startsWith('0x_')) throw new Error(`${name} не задеплоен`)
  return new ethers.Contract(addr, abi, web3.signer)
}

function getDCRead(name, abi) {
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

// ═══════════════════════════════════════════════════
// GemVaultV2 — Камни
// ═══════════════════════════════════════════════════

export async function getGemVaultStats() {
  const c = getDCRead('GemVaultV2', GEMVAULT_ABI)
  if (!c) return null
  try {
    const s = await c.getVaultStats()
    return {
      totalSales: fmt6(s.totalSales),
      reserve: fmt6(s.reserve),
      paidOut: fmt6(s.paidOut),
      categories: Number(s.catCount),
      gems: Number(s.gemCount),
      purchases: Number(s.purchaseCount),
    }
  } catch { return null }
}

export async function getGemsList() {
  const c = getDCRead('GemVaultV2', GEMVAULT_ABI)
  if (!c) return []
  try {
    const stats = await c.getVaultStats()
    const gemCount = Number(stats.gemCount)
    const gems = []
    for (let i = 0; i < gemCount && i < 50; i++) {
      try {
        const g = await c.gems(i)
        const clubPrice = await c.getClubPrice(i)
        gems.push({
          id: i,
          categoryId: Number(g.categoryId),
          name: g.name,
          certHash: g.certHash,
          marketPrice: fmt6(g.marketPrice),
          clubPrice: fmt6(clubPrice),
          weight: Number(g.weight),
          available: g.available,
          fractional: g.fractional,
          totalFractions: Number(g.totalFractions),
          soldFractions: Number(g.soldFractions),
        })
      } catch { break }
    }
    return gems
  } catch { return [] }
}

export async function getUserGemPurchases(address) {
  const c = getDCRead('GemVaultV2', GEMVAULT_ABI)
  if (!c) return []
  try {
    const ids = await c.getUserPurchases(address)
    const purchases = []
    for (const id of ids) {
      try {
        const p = await c.getPurchaseInfo(id)
        const reward = await c.getStakingReward(id)
        purchases.push({
          id: Number(id),
          gemId: Number(p.gemId),
          buyer: p.buyer,
          mode: Number(p.mode),        // 0=PURCHASE, 1=ASSET
          status: Number(p.status),    // 0=OWNED, 1=STAKING, 2=CLAIMED, 3=LISTED_P2P
          pricePaid: fmt6(p.pricePaid),
          marketValue: fmt6(p.marketValue),
          stakingRateBP: Number(p.stakingRateBP),
          stakingEndsAt: Number(p.stakingEndsAt),
          pendingReward: fmt6(p.pendingReward),
          rewardReady: reward.ready,
        })
      } catch {}
    }
    return purchases
  } catch { return [] }
}

export async function buyGemV2(gemId, mode = 1, fractions = 1) {
  const c = getDC('GemVaultV2', GEMVAULT_ABI)
  const cRead = getDCRead('GemVaultV2', GEMVAULT_ABI)
  const clubPrice = await cRead.getClubPrice(gemId)
  await ensureUSDTApproval(ADDRESSES.GemVaultV2, clubPrice)
  const tx = await c.buyGem(gemId, mode, fractions)
  return await tx.wait()
}

export async function convertGemToAsset(purchaseId) {
  const c = getDC('GemVaultV2', GEMVAULT_ABI)
  const tx = await c.convertToAsset(purchaseId)
  return await tx.wait()
}

export async function claimGemStaking(purchaseId, option = 0) {
  const c = getDC('GemVaultV2', GEMVAULT_ABI)
  const tx = await c.claimStaking(purchaseId, option)
  return await tx.wait()
}

export async function restakeGem(purchaseId) {
  const c = getDC('GemVaultV2', GEMVAULT_ABI)
  const tx = await c.restake(purchaseId)
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// DiamondP2P — P2P торговля
// ═══════════════════════════════════════════════════

export async function getP2PListings() {
  const c = getDCRead('DiamondP2P', DIAMONDP2P_ABI)
  if (!c) return []
  try {
    const count = Number(await c.getListingCount())
    const listings = []
    for (let i = 1; i <= count && i <= 50; i++) {
      try {
        const l = await c.getListing(i)
        if (l.active) {
          listings.push({
            id: i,
            vault: l.vault,
            purchaseId: Number(l.purchaseId),
            seller: l.seller,
            price: fmt6(l.price),
            active: l.active,
          })
        }
      } catch {}
    }
    return listings
  } catch { return [] }
}

export async function getP2PStats() {
  const c = getDCRead('DiamondP2P', DIAMONDP2P_ABI)
  if (!c) return null
  try {
    const [trades, volume, commissions] = await c.getStats()
    return {
      trades: Number(trades),
      volume: fmt6(volume),
      commissions: fmt6(commissions),
    }
  } catch { return null }
}

export async function listOnP2P(vaultAddress, purchaseId, priceUSDT) {
  const c = getDC('DiamondP2P', DIAMONDP2P_ABI)
  const tx = await c.list(vaultAddress, purchaseId, parse6(priceUSDT))
  return await tx.wait()
}

export async function buyFromP2P(listingId) {
  const c = getDC('DiamondP2P', DIAMONDP2P_ABI)
  const cRead = getDCRead('DiamondP2P', DIAMONDP2P_ABI)
  const listing = await cRead.getListing(listingId)
  await ensureUSDTApproval(ADDRESSES.DiamondP2P, listing.price)
  const tx = await c.buy(listingId)
  return await tx.wait()
}

export async function cancelP2PListing(listingId) {
  const c = getDC('DiamondP2P', DIAMONDP2P_ABI)
  const tx = await c.cancel(listingId)
  return await tx.wait()
}

export async function isListedOnP2P(vaultAddress, purchaseId) {
  const c = getDCRead('DiamondP2P', DIAMONDP2P_ABI)
  if (!c) return false
  try { return await c.isListed(vaultAddress, purchaseId) } catch { return false }
}

// ═══════════════════════════════════════════════════
// MetalVault — Металлы
// ═══════════════════════════════════════════════════

export async function getMetalVaultStats() {
  // MetalVault отключён — возвращаем null
  return null
}

export async function getMetalsList() {
  // MetalVault отключён
  return []
}

export async function buyMetal(metalId, grams, mode = 1) {
  throw new Error('MetalVault временно отключён')
}

export async function getUserMetalPurchases(address) {
  // MetalVault отключён
  return []
}

// ═══════════════════════════════════════════════════
// InsuranceFund — Страховой фонд
// ═══════════════════════════════════════════════════

export async function getInsuranceUserBalance(address) {
  const c = getDCRead('InsuranceFund', INSURANCE_ABI)
  if (!c) return '0'
  try {
    const bal = await c.userBalance(address)
    return fmt6(bal)
  } catch { return '0' }
}

export async function getInsuranceFundStats() {
  const c = getDCRead('InsuranceFund', INSURANCE_ABI)
  if (!c) return null
  try {
    const [stats, breakdown] = await Promise.all([
      c.getFundStats(),
      c.getBalanceBreakdown(),
    ])
    return {
      fundBalance: fmt6(stats.balance),
      totalDeposited: fmt6(stats.deposited),
      totalPaidClaims: fmt6(stats.paidClaims),
      totalConfiscated: fmt6(stats.confiscated_),
      totalWithdrawn: fmt6(stats.withdrawn),
      usdtOnContract: fmt6(breakdown.usdtOnContract),
      usersTotal: fmt6(breakdown.usersTotal),
      pendingWithdrawals: fmt6(breakdown.pendingWithdrawals),
    }
  } catch { return null }
}

export async function getUserWithdrawRequests(address) {
  const c = getDCRead('InsuranceFund', INSURANCE_ABI)
  if (!c) return []
  try {
    const ids = await c.getUserWithdrawals(address)
    const requests = []
    for (const id of ids) {
      try {
        const r = await c.withdrawRequests(id)
        requests.push({
          id: Number(r.id),
          amount: fmt6(r.amount),
          requestedAt: Number(r.requestedAt),
          availableAt: Number(r.availableAt),
          status: Number(r.status), // 0=NONE, 1=PENDING, 2=APPROVED, 3=FROZEN, 4=COMPLETED
        })
      } catch {}
    }
    return requests
  } catch { return [] }
}

export async function requestWithdraw(amountUSDT) {
  const c = getDC('InsuranceFund', INSURANCE_ABI)
  const tx = await c.requestWithdraw(parse6(amountUSDT))
  return await tx.wait()
}

export async function executeWithdraw(requestId) {
  const c = getDC('InsuranceFund', INSURANCE_ABI)
  const tx = await c.executeWithdraw(requestId)
  return await tx.wait()
}

export async function isUserFrozen(address) {
  const c = getDCRead('InsuranceFund', INSURANCE_ABI)
  if (!c) return false
  try { return await c.isFrozen(address) } catch { return false }
}

export async function verifyAsset(purchaseId) {
  const c = getDC('InsuranceFund', INSURANCE_ABI)
  const tx = await c.verifyAsset(purchaseId)
  return await tx.wait()
}

export async function submitClaim(purchaseId, amountUSDT, reason, evidenceIPFS) {
  const c = getDC('InsuranceFund', INSURANCE_ABI)
  const tx = await c.submitClaim(purchaseId, parse6(amountUSDT), reason, evidenceIPFS || '')
  return await tx.wait()
}

export async function getVerificationStatus(purchaseId) {
  const c = getDCRead('InsuranceFund', INSURANCE_ABI)
  if (!c) return null
  try {
    const v = await c.getVerificationStatus(purchaseId)
    return {
      owner: v.owner_,
      lastVerified: Number(v.lastVerified),
      nextDeadline: Number(v.nextDeadline),
      verified: v.verified,
      missedCount: Number(v.missedCount),
      overdue: v.overdue,
    }
  } catch { return null }
}

// ═══════════════════════════════════════════════════
// TrustScore — Репутация
// ═══════════════════════════════════════════════════

export async function getUserTrustInfo(address) {
  const c = getDCRead('TrustScore', TRUSTSCORE_ABI)
  if (!c) return null
  try {
    const info = await c.getUserInfo(address)
    const tierNames = ['NONE', 'PROBATION', 'BRONZE', 'SILVER', 'GOLD']
    return {
      score: Number(info.score),
      tier: Number(info.tier),
      tierName: tierNames[Number(info.tier)] || 'NONE',
      canPurchase: info.canPurchase,
      canStake: info.canStake,
      canShowcase: info.canShowcase,
    }
  } catch { return null }
}

// ═══════════════════════════════════════════════════
// UserBoost — Буст ставки
// ═══════════════════════════════════════════════════

export async function getUserBoostInfo(address) {
  const c = getDCRead('UserBoost', USERBOOST_ABI)
  if (!c) return null
  try {
    const info = await c.getUserBoostInfo(address)
    return {
      currentRate: Number(info.totalStakingRateBP) / 100, // BP → %
      boostBP: Number(info.currentBoostBP),
      nstBurned: fmt(info.totalBurned),
      nextBurnRequired: fmt(info.nstToNextLevel),
      nextLevelBP: Number(info.nextLevelBP),
    }
  } catch { return null }
}

export async function burnNSTForBoost(amount) {
  const c = getDC('UserBoost', USERBOOST_ABI)
  const tx = await c.boost(parse(amount))
  return await tx.wait()
}

export async function getBoostLevels() {
  const c = getDCRead('UserBoost', USERBOOST_ABI)
  if (!c) return []
  try {
    const count = Number(await c.getBoostLevelsCount())
    const levels = []
    for (let i = 0; i < count; i++) {
      const l = await c.boostLevels(i)
      levels.push({
        threshold: fmt(l.nstThreshold),
        boostBP: Number(l.boostBP),
      })
    }
    return levels
  } catch { return [] }
}

// ═══════════════════════════════════════════════════
// ReferralPool — Реферальные бонусы
// ═══════════════════════════════════════════════════

export async function getReferralClaimable(address) {
  const c = getDCRead('ReferralPool', REFERRALPOOL_ABI)
  if (!c) return '0'
  try {
    const bal = await c.claimable(address)
    return fmt(bal)
  } catch { return '0' }
}

export async function claimReferralBonus() {
  const c = getDC('ReferralPool', REFERRALPOOL_ABI)
  const tx = await c.claim()
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// ShowcaseMarket — Витрина
// ═══════════════════════════════════════════════════

export async function getShowcaseListings() {
  const c = getDCRead('ShowcaseMarket', SHOWCASE_ABI)
  if (!c) return []
  try {
    const ids = await c.getActiveListings()
    const listings = []
    for (const id of ids) {
      try {
        const l = await c.getListing(id)
        listings.push({
          id: Number(id),
          seller: l.seller,
          agent: l.agent,
          assetType: Number(l.assetType),
          title: l.title,
          description: l.description,
          imageURI: l.imageURI,
          certURI: l.certURI,
          price: fmt6(l.priceUSDT),
          status: Number(l.status),
          listedAt: Number(l.listedAt),
        })
      } catch {}
    }
    return listings
  } catch { return [] }
}

export async function getShowcaseStats() {
  const c = getDCRead('ShowcaseMarket', SHOWCASE_ABI)
  if (!c) return null
  try {
    const s = await c.getMarketStats()
    return {
      total: Number(s.total),
      sales: Number(s.sales),
      burned: fmt6(s.burned),
      commissions: fmt6(s.commissions),
    }
  } catch { return null }
}

export async function checkIsAgent(address) {
  const c = getDCRead('ShowcaseMarket', SHOWCASE_ABI)
  if (!c) return false
  try { return await c.isAgent(address) } catch { return false }
}

export async function listOnShowcase(assetType, title, description, imageURI, certURI, priceUSDT) {
  const c = getDC('ShowcaseMarket', SHOWCASE_ABI)
  const tx = await c.listOnShowcase(assetType, title, description, imageURI, certURI, parse6(priceUSDT))
  return await tx.wait()
}

export async function confirmShowcaseSale(listingId, buyerAddress) {
  const c = getDC('ShowcaseMarket', SHOWCASE_ABI)
  const tx = await c.confirmSale(listingId, buyerAddress)
  return await tx.wait()
}

export async function cancelShowcaseListing(listingId) {
  const c = getDC('ShowcaseMarket', SHOWCASE_ABI)
  const tx = await c.cancelListing(listingId)
  return await tx.wait()
}

export async function buyAgentLicense() {
  const c = getDC('ShowcaseMarket', SHOWCASE_ABI)
  const tx = await c.buyAgentLicense()
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// СВОДНАЯ ЗАГРУЗКА DIAMOND CLUB
// ═══════════════════════════════════════════════════

export async function loadDiamondClubDashboard(address) {
  const [
    insuranceBalance,
    trustInfo,
    boostInfo,
    referralClaimable,
    gemPurchases,
    gemStats,
    insuranceStats,
    frozen,
    p2pStats,
    showcaseStats,
  ] = await Promise.all([
    getInsuranceUserBalance(address).catch(() => '0'),
    getUserTrustInfo(address).catch(() => null),
    getUserBoostInfo(address).catch(() => null),
    getReferralClaimable(address).catch(() => '0'),
    getUserGemPurchases(address).catch(() => []),
    getGemVaultStats().catch(() => null),
    getInsuranceFundStats().catch(() => null),
    isUserFrozen(address).catch(() => false),
    getP2PStats().catch(() => null),
    getShowcaseStats().catch(() => null),
  ])

  return {
    insuranceBalance,
    trustInfo,
    boostInfo,
    referralClaimable,
    gemPurchases,
    metalPurchases: [], // MetalVault отключён
    gemStats,
    metalStats: null,   // MetalVault отключён
    insuranceStats,
    frozen,
    p2pStats,
    showcaseStats,
  }
}
