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
import GlobalWayABIFile from '@/contracts/abi/GlobalWay.json'
import NSTTokenABIFile from '@/contracts/abi/NSTToken.json'
import SwapHelperABIFile from '@/contracts/abi/SwapHelper.json'

const ABIS = {
  NSSPlatform: NSSPlatformABIFile.abi || NSSPlatformABIFile,
  GlobalWay: GlobalWayABIFile.abi || GlobalWayABIFile,
  NSTToken: NSTTokenABIFile.abi || NSTTokenABIFile,
  SwapHelper: SwapHelperABIFile.abi || SwapHelperABIFile,
}

const READ_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'
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
    usdt: ethers.formatEther(usdtBal), // opBNB USDT = 18 decimals
  }
}

// ═══════════════════════════════════════════════════
// КУРС BNB
// ═══════════════════════════════════════════════════

export async function getBNBPrice() {
  // Primary: API route (Binance/CoinGecko — точный биржевой курс)
  try {
    const res = await fetch('/api/bnb-price')
    if (res.ok) {
      const data = await res.json()
      if (data.ok && data.price > 10) return data.price
    }
  } catch {}
  // Fallback: SwapHelper on-chain (opBNB USDT = 18 decimals!)
  try {
    const swap = getReadContract('SwapHelper')
    if (!swap) return null
    const price = await swap.getBNBPrice()
    const parsed = Number(ethers.formatEther(price))
    if (parsed > 10) return parsed
    // Если контракт возвращает в 6 decimals — попробовать так
    const parsed6 = Number(ethers.formatUnits(price, 6))
    if (parsed6 > 10) return parsed6
  } catch {}
  return null
}

// ═══════════════════════════════════════════════════
// РЕГИСТРАЦИЯ / УРОВНИ
// ═══════════════════════════════════════════════════
// Регистрация ВСЕГДА идёт через GlobalWay.register() —
// это вход в иерархию партнёрской программы (matrixRegistry → odixId).
// NSSPlatform используется только для покупки уровней Diamond Club
// и тап-маркетинга, но НЕ для базовой регистрации в систему.
// GlobalWayBridge.registerUser() имеет модификатор onlyProjectOrDirector
// и НЕ может быть вызван пользователем напрямую — это только для серверной
// регистрации из внешних проектов (CardGift, GWAD).

export async function register(sponsorId = 0) {
  const gw = getContract('GlobalWay')

  // ★ ФИКС: Сначала проверяем НАПРЯМУЮ в GW (не через Bridge!).
  // Bridge может быть не синхронизирован с GW — поэтому если кошелёк уже
  // зарегистрирован прямо в GlobalWay, register() ревёртит без reason,
  // и пользователь видит "спонсор не существует" хотя на самом деле всё ок.
  try {
    const accs = await window.ethereum?.request({ method: 'eth_accounts' })
    const me = accs?.[0]
    if (me) {
      const isReg = await gw.isUserRegistered(me).catch(() => false)
      if (isReg) {
        // Уже зарегистрирован напрямую в GW — не делаем повторную транзакцию
        const err = new Error('Already registered')
        err.reason = 'Already registered'
        throw err
      }
    }
  } catch (e) {
    if (e?.reason === 'Already registered') throw e
    // Игнорируем другие ошибки проверки — пробуем register всё равно
  }

  const tx = await gw.register(sponsorId)
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
  if (!address) return null

  // ★★★ КРИТИЧНЫЙ ФИКС: используем getReadContract (публичный opBNB RPC),
  // а НЕ getContract (который через web3.signer = SafePal RPC).
  // SafePal может быть на BSC (chainId 56) или просто лагать с кэшем —
  // тогда вызов GW.isUserRegistered возвращает false для уже зарегистрированных
  // пользователей, и они снова видят модал регистрации.
  //
  // ALSO: убираем Bridge fallback для isRegistered. Bridge тут НЕ "источник истины
  // когда GW не отвечает" — у Bridge свой mapping, который НЕ обновляется при
  // регистрации через GlobalWay.register() напрямую. Если GW.isUserRegistered
  // вернул false — значит реально не зарегистрирован, точка. Bridge тут не помощник.
  try {
    const gw = getReadContract('GlobalWay')
    if (!gw) return null

    const isReg = await gw.isUserRegistered(address)
    if (!isReg) {
      return {
        isRegistered: false,
        odixId: 0,
        maxPackage: 0,
        rank: 0,
        quarterlyActive: false,
        sponsor: '0x0000000000000000000000000000000000000000',
        activeLevels: [],
      }
    }

    // Зарегистрирован — обогащаем данными
    const info = await gw.getUserInfo(address).catch(() => null)
    const maxLevel = info ? Number(info.maxLevel) : 0

    // Bridge — ТОЛЬКО для дополнительных полей (odixId, sponsor),
    // НЕ для проверки регистрации
    const bridgeData = await (async () => {
      try {
        const bridge = await getBridgeContract()
        if (!bridge) return null
        return await bridge.getUserStatus(address)
      } catch { return null }
    })()

    return {
      isRegistered: true,
      odixId: bridgeData ? Number(bridgeData.odixId) : 0,
      maxPackage: maxLevel,
      rank: bridgeData ? Number(bridgeData.rank) : 0,
      quarterlyActive: bridgeData ? bridgeData.quarterlyActive : false,
      sponsor: bridgeData ? bridgeData.sponsor : '0x0000000000000000000000000000000000000000',
      activeLevels: bridgeData ? [...bridgeData.activeLevels] : [],
    }
  } catch (e) {
    console.error('getGWUserStatus error:', e)
    return null
  }
}

export async function getUserLevel(address) {
  try {
    const status = await getGWUserStatus(address)
    return status ? status.maxPackage : 0
  } catch { return 0 }
}

export async function isRegistered(address) {
  // ★★★ ФИКС: проверяем GlobalWay через публичный RPC, НЕ Bridge.
  // Bridge не знает про прямые регистрации через GW.register() —
  // у него свой mapping для проектов. Источник истины — только GW.
  try {
    const gw = getReadContract('GlobalWay')
    if (!gw) return false
    return await gw.isUserRegistered(address)
  } catch { return false }
}

export async function getOwner(contractName) {
  return await safeRead(contractName, 'owner', [])
}
