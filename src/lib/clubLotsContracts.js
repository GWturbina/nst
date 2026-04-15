'use client'
/**
 * clubLotsContracts.js — Контракт-слой для модуля "Клубные лоты"
 * 
 * Взаимодействие со смарт-контрактом ClubLots на opBNB
 * Пока контракт не задеплоен — все функции gracefully возвращают null/[]
 */
import { ethers } from 'ethers'
import web3 from './web3'
import ADDRESSES from '@/contracts/addresses'

const READ_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'
const readProvider = new ethers.JsonRpcProvider(READ_RPC)

// ═══ Minimal ABI ═══
const CLUBLOTS_ABI = [
  // Views
  'function getLotCount() view returns (uint256)',
  'function getLotInfo(uint256 lotId) view returns (uint256 gemCost, uint256 sharePrice, uint256 totalShares, uint256 soldShares, uint8 minGWLevel, uint8 status, address winner, uint64 completedAt, uint256 lockPeriod, uint256 stoneFund, uint64 unlockAt)',
  'function getUserLotInfo(uint256 lotId, address user) view returns (uint16 shares, uint256 paid, bool compensated, bool isWinner, uint256 compensationAmount, bool canClaim)',
  'function getLotParticipants(uint256 lotId) view returns (address[])',
  'function getLotParticipantCount(uint256 lotId) view returns (uint256)',
  'function marketingBalance(address user) view returns (uint256)',
  'function getFunds() view returns (uint256 compensation, uint256 bonus, uint256 reserve)',
  'function admins(address user) view returns (bool)',
  'function lots(uint256) view returns (uint256 gemCost, uint256 sharePrice, uint256 totalShares, uint256 soldShares, uint8 minGWLevel, uint8 status, address winner, uint64 filledAt, uint64 completedAt, uint256 lockPeriod, uint256 stoneFund, bytes32 adminCommit)',
  // Write
  'function buyShare(uint256 lotId, uint16 count)',
  'function buyShareFromBalance(uint256 lotId, uint16 count)',
  'function claimEarnings()',
  'function claimCompensation(uint256 lotId)',
  // Admin
  'function createLot(uint256 gemCost, uint256 sharePrice, uint8 minGWLevel, bytes32 adminCommit) returns (uint256)',
  'function giftShare(uint256 lotId, address recipient, uint16 count)',
  'function revealWinner(uint256 lotId, uint256 secret)',
  'function cancelLot(uint256 lotId)',
  'function setLotMinLevel(uint256 lotId, uint8 level)',
  'function setAdmin(address addr, bool active)',
  'function setDefaultLockPeriod(uint256 days_)',
  'function refundCancelled(uint256 lotId)',
  // Emergency
  'function requestEmergencyWithdraw(address token, address to, uint256 amount)',
  'function executeEmergencyWithdraw(uint256 reqId)',
  'function rescueUserBalance(address user, address to)',
]

const USDT_ABI = [
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
]

// ═══ opBNB USDT = 18 decimals! НЕ 6 как на Ethereum ═══
const fmtUSDT = (v) => ethers.formatEther(v)          // 18 decimals
const parseUSDT = (v) => ethers.parseEther(String(v))  // 18 decimals

function getContract() {
  if (!web3.signer) throw new Error('Кошелёк не подключён')
  const addr = ADDRESSES.ClubLots
  if (!addr || addr.startsWith('0x_')) throw new Error('ClubLots не задеплоен')
  return new ethers.Contract(addr, CLUBLOTS_ABI, web3.signer)
}

function getReadContract() {
  const addr = ADDRESSES.ClubLots
  if (!addr || addr.startsWith('0x_')) return null
  return new ethers.Contract(addr, CLUBLOTS_ABI, readProvider)
}

async function ensureUSDTApproval(amount) {
  const usdt = new ethers.Contract(ADDRESSES.USDT, USDT_ABI, web3.signer)
  const allowance = await usdt.allowance(web3.address, ADDRESSES.ClubLots)
  if (allowance < amount) {
    const tx = await usdt.approve(ADDRESSES.ClubLots, amount)
    await tx.wait()
  }
}

// ═══════════════════════════════════════════════════
// READ — Лоты
// ═══════════════════════════════════════════════════

export async function getLotCount() {
  const c = getReadContract()
  if (!c) return 0
  try { return Number(await c.getLotCount()) } catch { return 0 }
}

export async function getLotInfo(lotId) {
  const c = getReadContract()
  if (!c) return null
  try {
    const info = await c.getLotInfo(lotId)
    return {
      gemCost: fmtUSDT(info.gemCost),
      sharePrice: fmtUSDT(info.sharePrice),
      totalShares: Number(info.totalShares),
      soldShares: Number(info.soldShares),
      minGWLevel: Number(info.minGWLevel),
      status: Number(info.status), // 0=Active 1=Filled 2=Revealing 3=Completed 4=Unlocked 5=Cancelled
      winner: info.winner,
      completedAt: Number(info.completedAt),
      lockPeriod: Number(info.lockPeriod),
      stoneFund: fmtUSDT(info.stoneFund),
      unlockAt: Number(info.unlockAt),
    }
  } catch { return null }
}

export async function getAllLots() {
  const c = getReadContract()
  if (!c) return []
  try {
    const count = Number(await c.getLotCount())
    const lots = []
    for (let i = 0; i < count && i < 200; i++) {
      const info = await getLotInfo(i)
      if (info) lots.push({ id: i, ...info })
    }
    return lots
  } catch { return [] }
}

export async function getUserLotInfo(lotId, address) {
  const c = getReadContract()
  if (!c) return null
  try {
    const info = await c.getUserLotInfo(lotId, address)
    return {
      shares: Number(info.shares),
      paid: fmtUSDT(info.paid),
      compensated: info.compensated,
      isWinner: info.isWinner,
      compensationAmount: fmtUSDT(info.compensationAmount),
      canClaim: info.canClaim,
    }
  } catch { return null }
}

export async function getMarketingBalance(address) {
  const c = getReadContract()
  if (!c) return '0'
  try {
    const bal = await c.marketingBalance(address)
    return fmtUSDT(bal)
  } catch { return '0' }
}

export async function getFundsInfo() {
  const c = getReadContract()
  if (!c) return null
  try {
    const f = await c.getFunds()
    return {
      compensation: fmtUSDT(f.compensation),
      bonus: fmtUSDT(f.bonus),
      reserve: fmtUSDT(f.reserve),
    }
  } catch { return null }
}

export async function isLotAdmin(address) {
  const c = getReadContract()
  if (!c) return false
  try { return await c.admins(address) } catch { return false }
}

// ═══════════════════════════════════════════════════
// WRITE — Покупка долей
// ═══════════════════════════════════════════════════

export async function buyShare(lotId, count) {
  const c = getContract()
  const info = await getReadContract().getLotInfo(lotId)
  const totalCost = info.sharePrice * BigInt(count)
  await ensureUSDTApproval(totalCost)
  const tx = await c.buyShare(lotId, count)
  return await tx.wait()
}

export async function buyShareFromBalance(lotId, count) {
  const c = getContract()
  const tx = await c.buyShareFromBalance(lotId, count)
  return await tx.wait()
}

export async function claimEarnings() {
  const c = getContract()
  const tx = await c.claimEarnings()
  return await tx.wait()
}

export async function claimCompensation(lotId) {
  const c = getContract()
  const tx = await c.claimCompensation(lotId)
  return await tx.wait()
}

export async function refundCancelled(lotId) {
  const c = getContract()
  const tx = await c.refundCancelled(lotId)
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// ADMIN — Управление лотами
// ═══════════════════════════════════════════════════

export async function createLotOnChain(gemCostUSDT, sharePriceUSDT, minLevel, secretNumber) {
  const c = getContract()
  const commit = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [secretNumber]))
  const tx = await c.createLot(parseUSDT(gemCostUSDT), parseUSDT(sharePriceUSDT), minLevel, commit)
  const receipt = await tx.wait()
  // Извлечь lotId из события LotCreated
  const event = receipt.logs.find(l => {
    try { return c.interface.parseLog(l)?.name === 'LotCreated' } catch { return false }
  })
  if (event) {
    const parsed = c.interface.parseLog(event)
    return { lotId: Number(parsed.args.lotId), receipt }
  }
  return { lotId: null, receipt }
}

export async function giftShareOnChain(lotId, recipientAddress, count) {
  const c = getContract()
  const tx = await c.giftShare(lotId, recipientAddress, count)
  return await tx.wait()
}

export async function revealWinnerOnChain(lotId, secretNumber) {
  const c = getContract()
  const tx = await c.revealWinner(lotId, secretNumber)
  return await tx.wait()
}

export async function cancelLotOnChain(lotId) {
  const c = getContract()
  const tx = await c.cancelLot(lotId)
  return await tx.wait()
}
