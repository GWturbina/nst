'use client'
/**
 * teamContracts.js — 9 линий партнёров из GlobalWay
 * Адаптировано для Diamond Club (NST)
 * v2: + GlobalWayStats + CardGiftMarketing + MatrixPaymentsV2
 */
import { ethers } from 'ethers'
import ADDRESSES from '@/contracts/addresses'

const READ_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'
const readProvider = new ethers.JsonRpcProvider(READ_RPC)

const fmt = ethers.formatEther

// ═══ Минимальные ABI ═══

const GLOBALWAY_ABI = [
  'function getDirectReferrals(address user) view returns (address[])',
]

const REGISTRY_ABI = [
  'function getUserInfo(address user) view returns (uint256 userId, uint256 sponsorId, uint256 personalInvites, bool isRegistered)',
]

const STATS_ABI = [
  'function getUserFullStats(address user) view returns (bool isRegistered, address sponsor, uint8 maxLevel, bool quarterlyActive, uint256 partnerEarnings, uint256 matrixEarnings, uint256 pensionBalance, uint256 leaderBalance, uint256 totalPendingBalance, uint256 frozenForAutoUpgrade, uint8 matrixRank, uint8 leaderRank)',
  'function getUserBalances(address user) view returns (uint256 partnerFromSponsor, uint256 partnerFromUpline, uint256 matrixEarnings, uint256 matrixFrozen, uint256 pensionBalance, uint256 leaderBalance, uint256 totalBalance)',
]

const MARKETING_ABI = [
  'function getAllLevelPercents() view returns (uint256[])',
  'function getAllRequiredGWLevels() view returns (uint256[])',
  'function getUserMarketingStats(address user) view returns (uint256 totalEarned, uint256[] earnedByLine)',
]

const MATRIXPAY_ABI = [
  'function getUserEarnings(address user) view returns (uint256 total, uint256 autoUpgraded, uint256 frozen)',
  'function getUserRank(address user) view returns (uint8)',
]

const NSSPLATFORM_ABI = [
  'function bridge() view returns (address)',
]

const BRIDGE_ABI = [
  'function getUserStatus(address user) view returns (tuple(bool isRegistered, uint256 odixId, uint8 maxPackage, uint8 rank, bool quarterlyActive, address sponsor, bool[12] activeLevels))',
]

// ═══ Контракты (safe — null если адрес отсутствует) ═══

function safe(name, abi) {
  const addr = ADDRESSES[name]
  if (!addr || addr.startsWith('0x_')) return null
  try { return new ethers.Contract(addr, abi, readProvider) } catch { return null }
}

function getGW()        { return safe('GlobalWay', GLOBALWAY_ABI) }
function getRegistry()  { return safe('MatrixRegistry', REGISTRY_ABI) }
function getStats()     { return safe('GlobalWayStats', STATS_ABI) }
function getMarketing() { return safe('CardGiftMarketing', MARKETING_ABI) }
function getMatrixPay() { return safe('MatrixPaymentsV2', MATRIXPAY_ABI) }

let _bridgeAddr = null
async function getBridge() {
  try {
    if (!_bridgeAddr) {
      const nss = new ethers.Contract(ADDRESSES.NSSPlatform, NSSPLATFORM_ABI, readProvider)
      _bridgeAddr = await nss.bridge()
    }
    return new ethers.Contract(_bridgeAddr, BRIDGE_ABI, readProvider)
  } catch { return null }
}

// ═══════════════════════════════════════════════════
// 9 ЛИНИЙ ПАРТНЁРОВ
// ═══════════════════════════════════════════════════

export async function getDirectReferrals(address) {
  try { const gw = getGW(); if (!gw) return []; return [...(await gw.getDirectReferrals(address))] } catch { return [] }
}

export async function getPartnerDetails(address) {
  try {
    const [regInfo, fullStats] = await Promise.all([
      getRegistry()?.getUserInfo(address).catch(() => null) || null,
      getStats()?.getUserFullStats(address).catch(() => null) || null,
    ])
    // Fallback на bridge если Stats недоступен
    if (!fullStats) {
      const bridge = await getBridge()
      if (bridge) {
        try {
          const s = await bridge.getUserStatus(address)
          return {
            address, userId: Number(s.odixId), sponsorId: regInfo ? Number(regInfo.sponsorId) : 0,
            personalInvites: regInfo ? Number(regInfo.personalInvites) : 0,
            maxLevel: Number(s.maxPackage), matrixRank: Number(s.rank),
            quarterlyActive: s.quarterlyActive, partnerEarnings: '0', matrixEarnings: '0',
          }
        } catch {}
      }
    }
    return {
      address,
      userId: regInfo ? Number(regInfo.userId) : 0,
      sponsorId: regInfo ? Number(regInfo.sponsorId) : 0,
      personalInvites: regInfo ? Number(regInfo.personalInvites) : 0,
      maxLevel: fullStats ? Number(fullStats.maxLevel) : 0,
      matrixRank: fullStats ? Number(fullStats.matrixRank) : 0,
      quarterlyActive: fullStats ? fullStats.quarterlyActive : false,
      partnerEarnings: fullStats ? fmt(fullStats.partnerEarnings) : '0',
      matrixEarnings: fullStats ? fmt(fullStats.matrixEarnings) : '0',
    }
  } catch {
    return { address, userId: 0, sponsorId: 0, personalInvites: 0, maxLevel: 0, matrixRank: 0, quarterlyActive: false, partnerEarnings: '0', matrixEarnings: '0' }
  }
}

export async function loadLineDetails(addresses) {
  if (!addresses?.length) return []
  const results = []; const batchSize = 10
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize)
    const details = await Promise.all(batch.map(addr => getPartnerDetails(addr)))
    results.push(...details)
  }
  return results
}

export async function getNextLineAddresses(lineAddresses) {
  if (!lineAddresses?.length) return []
  const gw = getGW(); if (!gw) return []
  const allRefs = []; const batchSize = 10
  for (let i = 0; i < lineAddresses.length; i += batchSize) {
    const batch = lineAddresses.slice(i, i + batchSize)
    const results = await Promise.all(batch.map(addr => gw.getDirectReferrals(addr).then(r => [...r]).catch(() => [])))
    results.forEach(refs => allRefs.push(...refs))
  }
  return allRefs
}

// ═══════════════════════════════════════════════════
// СТАТИСТИКА + БАЛАНСЫ
// ═══════════════════════════════════════════════════

export async function getUserFullStats(address) {
  const c = getStats()
  if (!c) return null
  try {
    const s = await c.getUserFullStats(address)
    return {
      isRegistered: s.isRegistered, sponsor: s.sponsor, maxLevel: Number(s.maxLevel),
      quarterlyActive: s.quarterlyActive, partnerEarnings: fmt(s.partnerEarnings),
      matrixEarnings: fmt(s.matrixEarnings), pensionBalance: fmt(s.pensionBalance),
      leaderBalance: fmt(s.leaderBalance), totalPending: fmt(s.totalPendingBalance),
      frozenAutoUpgrade: fmt(s.frozenForAutoUpgrade), matrixRank: Number(s.matrixRank),
      leaderRank: Number(s.leaderRank),
    }
  } catch { return null }
}

export async function getUserGWBalances(address) {
  const c = getStats()
  if (!c) return null
  try {
    const b = await c.getUserBalances(address)
    return {
      partnerFromSponsor: fmt(b.partnerFromSponsor), partnerFromUpline: fmt(b.partnerFromUpline),
      matrixEarnings: fmt(b.matrixEarnings), matrixFrozen: fmt(b.matrixFrozen),
      pensionBalance: fmt(b.pensionBalance), leaderBalance: fmt(b.leaderBalance),
      totalBalance: fmt(b.totalBalance),
    }
  } catch { return null }
}

// ═══════════════════════════════════════════════════
// МАРКЕТИНГ (CardGiftMarketing)
// ═══════════════════════════════════════════════════

export async function getMarketingPercents() {
  const c = getMarketing()
  if (!c) return [10, 7, 5, 3, 2, 1, 1, 0.5, 0.5]
  try { return (await c.getAllLevelPercents()).map(v => Number(v) / 100) } catch { return [10, 7, 5, 3, 2, 1, 1, 0.5, 0.5] }
}

export async function getRequiredLevels() {
  const c = getMarketing()
  if (!c) return [1, 2, 3, 4, 5, 6, 7, 8, 9]
  try { return (await c.getAllRequiredGWLevels()).map(v => Number(v)) } catch { return [1, 2, 3, 4, 5, 6, 7, 8, 9] }
}

export async function getUserMarketingStats(address) {
  const c = getMarketing()
  if (!c) return { totalEarned: '0', earnedByLine: Array(9).fill('0') }
  try { const [total, byLine] = await c.getUserMarketingStats(address); return { totalEarned: fmt(total), earnedByLine: byLine.map(v => fmt(v)) } } catch { return { totalEarned: '0', earnedByLine: Array(9).fill('0') } }
}

export async function getMatrixUserStats(address) {
  const c = getMatrixPay()
  if (!c) return { totalEarned: '0', autoUpgraded: '0', frozen: '0', rank: 0 }
  try { const [total, autoUpgraded, frozen] = await c.getUserEarnings(address); const rank = await c.getUserRank(address).catch(()=>0); return { totalEarned: fmt(total), autoUpgraded: fmt(autoUpgraded), frozen: fmt(frozen), rank: Number(rank) } } catch { return { totalEarned: '0', autoUpgraded: '0', frozen: '0', rank: 0 } }
}

// ═══ Ранги ═══
export const RANK_NAMES  = { 0: 'Без ранга', 1: 'Silver', 2: 'Gold', 3: 'Platinum', 4: 'Diamond', 5: 'Crown' }
export const RANK_COLORS = { 0: '#94a3b8', 1: '#c0c0c0', 2: '#ffd700', 3: '#a855f7', 4: '#60a5fa', 5: '#f59e0b' }
export const RANK_EMOJIS = { 0: '⚪', 1: '🥈', 2: '🥇', 3: '💎', 4: '💠', 5: '👑' }

// ═══ Маркетинг Diamond Club ═══
export const DC_MARKETING_LINES = [
  { line: 1, pct: 20, minLevel: 1 },
  { line: 2, pct: 15, minLevel: 2 },
  { line: 3, pct: 10, minLevel: 3 },
  { line: 4, pct: 10, minLevel: 4 },
  { line: 5, pct: 9,  minLevel: 5 },
  { line: 6, pct: 8,  minLevel: 6 },
  { line: 7, pct: 7,  minLevel: 7 },
  { line: 8, pct: 6,  minLevel: 8 },
  { line: 9, pct: 5,  minLevel: 9 },
]
