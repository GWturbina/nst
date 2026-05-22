'use client'
/**
 * Golden Reserve — Сервисный слой для контракта GoldReserve
 * ═══════════════════════════════════════════════════════
 *
 * Резервный (Золотой) пул Diamond Club.
 * Контракт: GoldReserve на opBNB (адрес в addresses.js → GoldReserve)
 *
 * Модель:
 *   - Партнёр вкладывает USDT, 1 USDT = 1 доля (deposit)
 *   - Owner берёт средства займами по номерам (withdrawToClub)
 *   - Возврат в конкретный заём (repayLoan): principal в кассу, излишек → прибыль на доли
 *   - Прибыль распределяется пропорционально долям (автоматически в контракте)
 *   - Партнёр забирает награду в любой момент (claimReward)
 *   - Выход через очередь, не ранее 6 месяцев (requestExit / processExitQueue)
 *
 * USDT на opBNB = 18 decimals → formatEther / parseEther.
 *
 * Импорт:
 *   import * as Gold from '@/lib/goldReserve'
 */
import { ethers } from 'ethers'
import web3 from './web3'
import ADDRESSES from '@/contracts/addresses'
import GoldReserveArtifact from '@/contracts/abi/GoldReserve.json'

function unwrapAbi(artifact) {
  if (Array.isArray(artifact)) return artifact
  if (artifact?.abi) return artifact.abi
  return artifact?.default?.abi || artifact?.default || []
}
const GOLD_ABI = unwrapAbi(GoldReserveArtifact)

const USDT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

// ─── READ PROVIDER (RPC без кошелька) ───
const READ_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'
const readProvider = new ethers.JsonRpcProvider(READ_RPC)

// ─── Форматирование (USDT 18 decimals) ───
const fmt = (v) => { try { return ethers.formatEther(v ?? 0n) } catch { return '0' } }
const parse = (v) => { try { return ethers.parseEther(String(v ?? 0)) } catch { return 0n } }
const num = (v) => { try { return Number(v ?? 0) } catch { return 0 } }

// ─── Contract factories ───
function getContract() {
  if (!web3.signer) throw new Error('Кошелёк не подключён')
  const addr = ADDRESSES.GoldReserve
  if (!addr || addr.startsWith('0x_')) throw new Error('GoldReserve не задеплоен')
  return new ethers.Contract(addr, GOLD_ABI, web3.signer)
}
function getReadContract() {
  const addr = ADDRESSES.GoldReserve
  if (!addr || addr.startsWith('0x_')) return null
  return new ethers.Contract(addr, GOLD_ABI, readProvider)
}
function getUSDT() {
  return new ethers.Contract(ADDRESSES.USDT, USDT_ABI, web3.signer)
}

// ─── Allowance — approve если нужно ───
async function ensureUSDTApproval(amountWei) {
  if (!web3.address) throw new Error('Адрес не определён')
  const usdt = getUSDT()
  const current = await usdt.allowance(web3.address, ADDRESSES.GoldReserve)
  if (current < amountWei) {
    const tx = await usdt.approve(ADDRESSES.GoldReserve, amountWei)
    await tx.wait()
  }
}

// ─── Обработка ошибок контракта в человеческий текст ───
function translateError(reason) {
  const map = {
    'GR:min $1': 'Минимальный вклад — $1',
    'GR:exit pending': 'Вы уже в очереди на выход — нельзя вкладывать',
    'GR:no reward': 'Нет накопленной награды',
    'GR:rewards low': 'В пуле наград недостаточно средств',
    'GR:no shares': 'У вас нет долей в фонде',
    'GR:already queued': 'Вы уже в очереди на выход',
    'GR:locked 6mo': 'Выход возможен только через 6 месяцев с последнего вложения',
    'GR:not enough free': 'Недостаточно свободных средств в кассе',
    'GR:loan closed': 'Этот заём уже погашен',
    'GR:bad loanId': 'Неверный номер займа',
    'GR:no shares for profit': 'Нет долей — некому распределять прибыль',
    'GR:cannot touch fund': 'Нельзя трогать средства фонда',
  }
  return map[reason] || reason
}

async function safeCall(fn) {
  try {
    const tx = await fn()
    const receipt = await tx.wait()
    return { ok: true, txHash: receipt.hash }
  } catch (err) {
    const msg = err?.reason || err?.shortMessage || err?.message || 'Неизвестная ошибка'
    const reason = msg.match(/reason="([^"]+)"/)?.[1]
      || msg.match(/"([^"]*GR:[^"]*)"/)?.[1]
      || (msg.includes('GR:') ? msg.match(/GR:[^\s"']+/)?.[0] : null)
    if (reason) return { ok: false, error: translateError(reason) }
    if (msg.includes('user rejected') || msg.includes('User denied')) {
      return { ok: false, error: 'Транзакция отменена' }
    }
    return { ok: false, error: msg.slice(0, 160) }
  }
}

// ═══════════════════════════════════════════════════════
// ПАРТНЁР
// ═══════════════════════════════════════════════════════

/**
 * Вложить USDT в фонд (1 USDT = 1 доля).
 * @param {number|string} amountUSDT сумма в USDT
 */
export async function deposit(amountUSDT) {
  const amountWei = parse(amountUSDT)
  if (amountWei <= 0n) return { ok: false, error: 'Введите сумму больше 0' }
  await ensureUSDTApproval(amountWei)
  const c = getContract()
  return safeCall(() => c.deposit(amountWei))
}

/** Забрать накопленную награду (партнёр сам платит газ) */
export async function claimReward() {
  const c = getContract()
  return safeCall(() => c.claimReward())
}

/** Запросить выход (встать в очередь). Не ранее 6 мес с последнего вложения. */
export async function requestExit() {
  const c = getContract()
  return safeCall(() => c.requestExit())
}

/**
 * Данные партнёра (для UI).
 * @returns {Promise<{shares, claimable, lastDeposit, exitRequested, unlockTime}>}
 */
export async function getStaker(address) {
  const c = getReadContract()
  if (!c) return null
  const addr = address || web3.address
  if (!addr) return null
  try {
    const [shares, claimable, lastDeposit, exitRequested, unlockTime] = await c.getStaker(addr)
    return {
      shares: fmt(shares),
      sharesRaw: shares,
      claimable: fmt(claimable),
      claimableRaw: claimable,
      lastDeposit: num(lastDeposit),
      exitRequested,
      unlockTime: num(unlockTime),
      canExitNow: num(unlockTime) > 0 && Date.now() / 1000 >= num(unlockTime),
    }
  } catch { return null }
}

/** Сколько награды накоплено (быстрый вызов) */
export async function pendingReward(address) {
  const c = getReadContract()
  if (!c) return '0'
  const addr = address || web3.address
  if (!addr) return '0'
  try { return fmt(await c.pendingReward(addr)) } catch { return '0' }
}

// ═══════════════════════════════════════════════════════
// OWNER (управление фондом)
// ═══════════════════════════════════════════════════════

/**
 * Взять средства из кассы в работу как отдельный заём.
 * @param {string} to адрес получателя (Binance / Trust / кошелёк)
 * @param {number|string} amountUSDT сумма
 * @param {string} purpose назначение (для прозрачности)
 */
export async function withdrawToClub(to, amountUSDT, purpose = '') {
  const amountWei = parse(amountUSDT)
  if (!to || !to.startsWith('0x') || to.length !== 42) {
    return { ok: false, error: 'Неверный адрес получателя' }
  }
  if (amountWei <= 0n) return { ok: false, error: 'Введите сумму больше 0' }
  const c = getContract()
  return safeCall(() => c.withdrawToClub(to, amountWei, String(purpose || '')))
}

/**
 * Вернуть средства в конкретный заём (авто-разделение principal/прибыль).
 * @param {number} loanId номер займа
 * @param {number|string} amountUSDT сумма возврата
 */
export async function repayLoan(loanId, amountUSDT) {
  const amountWei = parse(amountUSDT)
  if (amountWei <= 0n) return { ok: false, error: 'Введите сумму больше 0' }
  await ensureUSDTApproval(amountWei)
  const c = getContract()
  return safeCall(() => c.repayLoan(loanId, amountWei))
}

/** Раздать прибыль напрямую (премия из своих средств, не из займа) */
export async function distributeProfit(amountUSDT) {
  const amountWei = parse(amountUSDT)
  if (amountWei <= 0n) return { ok: false, error: 'Введите сумму больше 0' }
  await ensureUSDTApproval(amountWei)
  const c = getContract()
  return safeCall(() => c.distributeProfit(amountWei))
}

/** Обработать очередь на выход (FIFO). maxCount 1..50 */
export async function processExitQueue(maxCount = 10) {
  const c = getContract()
  return safeCall(() => c.processExitQueue(Math.max(1, Math.min(50, maxCount))))
}

// ═══════════════════════════════════════════════════════
// VIEW — общая информация о фонде
// ═══════════════════════════════════════════════════════

/**
 * Сводка по фонду (для дашборда).
 */
export async function getFundInfo() {
  const c = getReadContract()
  if (!c) return null
  try {
    const [totalShares, fundBalance, deployedAmount, rewardsPool, totalRewards, exitsCount, loansCount] =
      await Promise.all([
        c.totalShares(),
        c.fundBalance(),
        c.deployedAmount(),
        c.rewardsPool(),
        c.totalRewardsDistributed(),
        c.pendingExitsCount(),
        c.loansCount(),
      ])
    return {
      totalShares: fmt(totalShares),
      totalSharesRaw: totalShares,
      fundBalance: fmt(fundBalance),       // свободно в кассе
      deployedAmount: fmt(deployedAmount), // в работе
      rewardsPool: fmt(rewardsPool),       // пул наград
      totalRewardsDistributed: fmt(totalRewards),
      pendingExits: num(exitsCount),
      loansCount: num(loansCount),
    }
  } catch { return null }
}

/**
 * Список займов (для админки).
 * @param {number} count сколько займов прочитать (обычно = loansCount)
 */
export async function getLoans(count) {
  const c = getReadContract()
  if (!c) return []
  const out = []
  for (let i = 0; i < count; i++) {
    try {
      const loan = await c.loans(i)
      out.push({
        id: i,
        principal: fmt(loan.principal),
        repaid: fmt(loan.repaid),
        profitPaid: fmt(loan.profitPaid),
        purpose: loan.purpose,
        takenAt: num(loan.takenAt),
        active: loan.active,
        takenTo: loan.takenTo,
        outstanding: fmt(loan.principal - loan.repaid),
      })
    } catch { /* пропускаем */ }
  }
  return out
}

/** Свободная ликвидность в кассе */
export async function availableLiquidity() {
  const c = getReadContract()
  if (!c) return '0'
  try { return fmt(await c.availableLiquidity()) } catch { return '0' }
}

/** Баланс USDT партнёра (для подсказки сколько можно вложить) */
export async function getUSDTBalance(address) {
  const addr = address || web3.address
  if (!addr) return '0'
  try {
    const usdt = new ethers.Contract(ADDRESSES.USDT, USDT_ABI, readProvider)
    return fmt(await usdt.balanceOf(addr))
  } catch { return '0' }
}
