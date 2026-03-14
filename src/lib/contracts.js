'use client'
/**
 * Diamond Club — Contract Service Layer
 * Только: регистрация GlobalWay + базовые балансы + уровни
 * DCT контракты — в dctContracts.js
 * Diamond контракты — в diamondContracts.js
 */
import { ethers } from 'ethers'
import web3 from './web3'
import ADDRESSES from '@/contracts/addresses'

import NSSPlatformABIFile from '@/contracts/abi/NSSPlatform.json'
import NSTTokenABIFile from '@/contracts/abi/NSTToken.json'
import SwapHelperABIFile from '@/contracts/abi/SwapHelper.json'

const ABIS = {
  NSSPlatform: NSSPlatformABIFile.abi || NSSPlatformABIFile,
  NSTToken: NSTTokenABIFile.abi || NSTTokenABIFile,
  SwapHelper: SwapHelperABIFile.abi || SwapHelperABIFile,
}

const READ_RPC = 'https://opbnb-mainnet-rpc.bnbchain.org'
const readProvider = new ethers.JsonRpcProvider(READ_RPC)

function getContract(name) {
  if (!web3.signer) throw new Error('Кошелёк не подключён')
  const addr = ADDRESSES[name]
  if (!addr || addr.startsWith('0x_')) throw new Error(`Контракт ${name} не задеплоен`)
  return new ethers.Contract(addr, ABIS[name], web3.signer)
}

function getReadContract(name) {
  const addr = ADDRESSES[name]
  if (!addr || addr.startsWith('0x_')) return null
  return new ethers.Contract(addr, ABIS[name], readProvider)
}

async function safeRead(contractName, method, args = []) {
  try {
    const c = getReadContract(contractName)
    if (!c) return null
    return await c[method](...args)
  } catch { return null }
}

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

const fmt = ethers.formatEther

// ═══════════════════════════════════════════════════
// БАЛАНСЫ
// ═══════════════════════════════════════════════════

export async function getBalances(address) {
  if (!address) return { bnb: '0', usdt: '0' }
  const [bnbRaw] = await Promise.all([
    readProvider.getBalance(address).catch(() => 0n),
  ])
  let usdtBal = 0n
  try {
    const usdt = new ethers.Contract(ADDRESSES.USDT, ['function balanceOf(address) view returns (uint256)'], readProvider)
    usdtBal = await usdt.balanceOf(address)
  } catch {}

  return {
    bnb: fmt(bnbRaw),
    usdt: ethers.formatUnits(usdtBal, 6),
  }
}

// ═══════════════════════════════════════════════════
// КУРС BNB
// ═══════════════════════════════════════════════════

export async function getBNBPrice() {
  try {
    const swap = getReadContract('SwapHelper')
    if (!swap) return null
    const price = await swap.getBNBPrice()
    return Number(ethers.formatUnits(price, 6))
  } catch { return null }
}

// ═══════════════════════════════════════════════════
// РЕГИСТРАЦИЯ / УРОВНИ (NSSPlatform + GlobalWay)
// ═══════════════════════════════════════════════════

export async function register(sponsorId = 0) {
  const nss = getContract('NSSPlatform')
  const tx = await nss.register(sponsorId)
  return await tx.wait()
}

export async function waitForRegistration(address, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const reg = await isRegistered(address).catch(() => false)
    if (reg) return true
  }
  return false
}

export async function buyLevel(level) {
  const nss = getContract('NSSPlatform')
  const bridgeAddr = await nss.bridge()
  const bridge = new ethers.Contract(bridgeAddr, [
    'function getLevelPrice(uint8) view returns (uint256)'
  ], readProvider)
  const price = await bridge.getLevelPrice(level)
  const tx = await nss.buyLevel(level, { value: price })
  return await tx.wait()
}

export async function buyMultipleLevels(fromLevel, toLevel) {
  const nss = getContract('NSSPlatform')
  const bridgeAddr = await nss.bridge()
  const bridge = new ethers.Contract(bridgeAddr, [
    'function getMultipleLevelsPrice(address,uint8,uint8) view returns (uint256)'
  ], readProvider)
  const price = await bridge.getMultipleLevelsPrice(web3.address, fromLevel, toLevel)
  const tx = await nss.buyMultipleLevels(fromLevel, toLevel, { value: price })
  return await tx.wait()
}

// ═══════════════════════════════════════════════════
// GlobalWayBridge
// ═══════════════════════════════════════════════════

const BRIDGE_ABI = [
  'function isUserRegistered(address user) external view returns (bool)',
  'function getUserStatus(address user) external view returns (tuple(bool isRegistered, uint256 odixId, uint8 maxPackage, uint8 rank, bool quarterlyActive, address sponsor, bool[12] activeLevels))',
  'function getUserOdixId(address user) external view returns (uint256)',
  'function getLevelPrice(uint8 level) external view returns (uint256)',
  'function getMultipleLevelsPrice(address user, uint8 fromLevel, uint8 toLevel) external view returns (uint256)',
]

let _bridgeAddr = null

export function resetContractsCache() {
  _bridgeAddr = null
}

async function getBridgeContract() {
  try {
    if (!_bridgeAddr) {
      const nss = getReadContract('NSSPlatform')
      if (!nss) return null
      _bridgeAddr = await nss.bridge()
    }
    return new ethers.Contract(_bridgeAddr, BRIDGE_ABI, readProvider)
  } catch { return null }
}

export async function getGWUserStatus(address) {
  try {
    const bridge = await getBridgeContract()
    if (!bridge) return null
    const s = await bridge.getUserStatus(address)
    return {
      isRegistered: s.isRegistered,
      odixId: Number(s.odixId),
      maxPackage: Number(s.maxPackage),
      rank: Number(s.rank),
      quarterlyActive: s.quarterlyActive,
      sponsor: s.sponsor,
      activeLevels: [...s.activeLevels],
    }
  } catch { return null }
}

export async function getUserLevel(address) {
  try {
    const status = await getGWUserStatus(address)
    return status ? status.maxPackage : 0
  } catch { return 0 }
}

export async function isRegistered(address) {
  try {
    const bridge = await getBridgeContract()
    if (!bridge) {
      const result = await safeRead('NSSPlatform', 'isNSSUser', [address])
      return result === true
    }
    return await bridge.isUserRegistered(address)
  } catch { return false }
}

export async function getOwner(contractName) {
  return await safeRead(contractName, 'owner', [])
}
