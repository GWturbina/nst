/**
 * API Route: /api/tap
 * Серверная верификация тапов — защита от накрутки
 *
 * РЕФЕРАЛЬНАЯ СИСТЕМА NSS:
 *   - 50 NSS разовый бонус спонсору при первом тапе приглашённого
 *   - 10% от каждого тапа приглашённого → спонсору
 *
 * ИЗМЕНЕНИЯ (Пакет 3):
 *   • Atomic update через optimistic lock — защита от race condition
 *     (при параллельных запросах повторный тап будет отброшен, а не засчитан дважды)
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyWallet } from '@/lib/authHelper'
import { checkOrigin } from '@/lib/checkOrigin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
if (!supabaseUrl || !supabaseServiceKey) console.error('SUPABASE_SERVICE_KEY не задан!')

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

const ENERGY_MAX = 200
const REGEN_MS = 120000
const MIN_TAP_INTERVAL_MS = 150
const NSS_PER_TAP = [0.01, 0.03, 0.05, 0.08, 0.12, 0.16, 0.20, 0.24, 0.28, 0.32, 0.35, 0.38, 0.40]

const INVITE_BONUS_NSS = 50
const REFERRAL_TAP_PCT = 10

const DECAY_START_DAYS = 180
const DECAY_PCT_PER_DAY = 1
const MS_PER_DAY = 86400000

function calcDecay(totalNss, lastTapAt) {
  if (!lastTapAt || totalNss <= 0) return { decayed: 0, remaining: totalNss, daysInactive: 0 }
  const now = Date.now()
  const daysInactive = Math.floor((now - lastTapAt) / MS_PER_DAY)
  if (daysInactive <= DECAY_START_DAYS) return { decayed: 0, remaining: totalNss, daysInactive }
  const decayDays = daysInactive - DECAY_START_DAYS
  const decayPct = Math.min(100, decayDays * DECAY_PCT_PER_DAY)
  const decayed = +(totalNss * decayPct / 100).toFixed(4)
  const remaining = +(totalNss - decayed).toFixed(4)
  return { decayed, remaining: Math.max(0, remaining), daysInactive, decayPct }
}

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'
const NSS_PLATFORM_ADDR = '0xFb1ddFa8A7EAB0081EAe24ec3d24B0ED4Dd84f2B'
const BRIDGE_ABI = ['function getUserStatus(address user) external view returns (tuple(bool isRegistered, uint256 odixId, uint8 maxPackage, uint8 rank, bool quarterlyActive, address sponsor, bool[12] activeLevels))']
const NSS_ABI = ['function bridge() external view returns (address)']

async function getSponsorWallet(walletAddress) {
  try {
    const { ethers } = await import('ethers')
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const nss = new ethers.Contract(NSS_PLATFORM_ADDR, NSS_ABI, provider)
    const bridgeAddr = await nss.bridge()
    const bridge = new ethers.Contract(bridgeAddr, BRIDGE_ABI, provider)
    const status = await bridge.getUserStatus(walletAddress)
    if (status.isRegistered && status.sponsor && status.sponsor !== '0x0000000000000000000000000000000000000000') {
      return status.sponsor.toLowerCase()
    }
    return null
  } catch { return null }
}


async function creditSponsor(sponsorWallet, amount) {
  if (!sponsorWallet || amount <= 0) return
  let { data: sponsor } = await supabase
    .from('dc_taps').select('total_nss, referral_nss').eq('wallet', sponsorWallet).single()

  if (!sponsor) {
    await supabase.from('dc_taps').insert({
      wallet: sponsorWallet, energy: ENERGY_MAX, total_nss: amount, referral_nss: amount,
      total_taps: 0, last_tap_at: Date.now(), last_regen_at: Date.now(),
    })
    return
  }
  await supabase.from('dc_taps').update({
    total_nss: +((sponsor.total_nss || 0) + amount).toFixed(4),
    referral_nss: +((sponsor.referral_nss || 0) + amount).toFixed(4),
  }).eq('wallet', sponsorWallet)
}

export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await request.json()
    const { wallet, level } = body
    const verified = await verifyWallet(body)
    if (!verified) return NextResponse.json({ ok: false, error: 'Auth failed' }, { status: 401 })
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return NextResponse.json({ ok: false, error: 'Invalid wallet' }, { status: 400 })

    const lv = Math.max(0, Math.min(12, parseInt(level) || 0))
    const nssPerTap = NSS_PER_TAP[lv] || 0.01
    const walletLower = wallet.toLowerCase()
    const now = Date.now()

    let { data: player } = await supabase.from('dc_taps').select('*').eq('wallet', walletLower).single()

    if (!player) {
      // Новый игрок — ищем спонсора в блокчейне
      const sponsorWallet = await getSponsorWallet(walletLower)
      const { data: newPlayer, error: insertErr } = await supabase.from('dc_taps').insert({
        wallet: walletLower, energy: ENERGY_MAX, total_nss: 0, referral_nss: 0,
        total_taps: 0, last_tap_at: now, last_regen_at: now,
        sponsor_wallet: sponsorWallet, invite_bonus_paid: false,
      }).select().single()
      if (insertErr) return NextResponse.json({ ok: false, error: 'DB error' }, { status: 500 })
      player = newPlayer

      if (sponsorWallet) {
        await creditSponsor(sponsorWallet, INVITE_BONUS_NSS)
        await supabase.from('dc_taps').update({ invite_bonus_paid: true }).eq('wallet', walletLower)
      }
    }

    // Кеш спонсора для старых записей
    if (!player.sponsor_wallet && !player.invite_bonus_paid) {
      const sponsorWallet = await getSponsorWallet(walletLower)
      if (sponsorWallet) {
        await supabase.from('dc_taps').update({ sponsor_wallet: sponsorWallet, invite_bonus_paid: true }).eq('wallet', walletLower)
        player.sponsor_wallet = sponsorWallet
        await creditSponsor(sponsorWallet, INVITE_BONUS_NSS)
      } else {
        await supabase.from('dc_taps').update({ invite_bonus_paid: true }).eq('wallet', walletLower)
      }
    }

    // Сгорание NSS
    const decay = calcDecay(player.total_nss, player.last_tap_at)
    if (decay.decayed > 0) {
      player.total_nss = decay.remaining
      await supabase.from('dc_taps').update({ total_nss: decay.remaining }).eq('wallet', walletLower)
    }

    // Cooldown
    const timeSinceLastTap = now - (player.last_tap_at || 0)
    if (timeSinceLastTap < MIN_TAP_INTERVAL_MS) {
      return NextResponse.json({ ok: false, error: 'Too fast', energy: player.energy, totalNss: player.total_nss }, { status: 429 })
    }

    // Энергия
    const timeSinceRegen = now - (player.last_regen_at || now)
    const regenAmount = Math.floor(timeSinceRegen / REGEN_MS)
    const currentEnergy = Math.min(ENERGY_MAX, (player.energy || 0) + regenAmount)
    if (currentEnergy <= 0) {
      return NextResponse.json({ ok: false, error: 'No energy', energy: 0, totalNss: player.total_nss })
    }

    // Начисляем тап
    const newEnergy = currentEnergy - 1
    const earned = nssPerTap
    const newTotal = +(player.total_nss + earned).toFixed(4)
    const newTaps = (player.total_taps || 0) + 1

    // ═══ Пакет 3: Atomic update через optimistic lock ═══
    // Обновляем ТОЛЬКО если last_tap_at в БД совпадает с тем что мы читали.
    // Если два параллельных запроса — второй не пройдёт (count=0) и вернёт 429.
    const { data: updated, error: updErr, count } = await supabase
      .from('dc_taps')
      .update({
        energy: newEnergy, total_nss: newTotal, total_taps: newTaps,
        last_tap_at: now, last_regen_at: regenAmount > 0 ? now : player.last_regen_at, level: lv,
      })
      .eq('wallet', walletLower)
      .eq('last_tap_at', player.last_tap_at || 0)  // optimistic lock
      .select()

    if (updErr || !updated || updated.length === 0) {
      return NextResponse.json({ ok: false, error: 'Concurrent tap rejected', energy: player.energy, totalNss: player.total_nss }, { status: 429 })
    }

    // 10% от тапа → спонсору (асинхронно)
    let referralBonus = 0
    if (player.sponsor_wallet) {
      referralBonus = +(earned * REFERRAL_TAP_PCT / 100).toFixed(4)
      if (referralBonus > 0) creditSponsor(player.sponsor_wallet, referralBonus).catch(() => {})
    }

    return NextResponse.json({
      ok: true, earned, energy: newEnergy, maxEnergy: ENERGY_MAX,
      totalNss: newTotal, totalTaps: newTaps, referralBonus,
      decayApplied: decay.decayed > 0 ? decay.decayed : 0,
    })
  } catch { return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 }) }
}

// GET — состояние игрока
export async function GET(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 503 })
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return NextResponse.json({ ok: false, error: 'Invalid wallet' }, { status: 400 })

    const walletLower = wallet.toLowerCase()
    const { data: player } = await supabase.from('dc_taps').select('*').eq('wallet', walletLower).single()

    if (!player) {
      return NextResponse.json({ ok: true, energy: ENERGY_MAX, maxEnergy: ENERGY_MAX, totalNss: 0, totalTaps: 0, referralNss: 0 })
    }

    const now = Date.now()
    const regenAmount = Math.floor((now - (player.last_regen_at || now)) / REGEN_MS)
    const currentEnergy = Math.min(ENERGY_MAX, (player.energy || 0) + regenAmount)

    const decay = calcDecay(player.total_nss, player.last_tap_at)

    return NextResponse.json({
      ok: true, energy: currentEnergy, maxEnergy: ENERGY_MAX,
      totalNss: decay.remaining, totalTaps: player.total_taps || 0,
      referralNss: player.referral_nss || 0,
      decay: decay.decayed > 0 ? { lost: decay.decayed, daysInactive: decay.daysInactive, pct: decay.decayPct } : null,
    })
  } catch { return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 }) }
}
