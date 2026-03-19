/**
 * API Route: /api/tap
 * Серверная верификация тапов — защита от накрутки
 * 
 * Клиент отправляет: { wallet, level, taps (count за сессию) }
 * Сервер проверяет: энергию, cooldown, уровень
 * Сервер возвращает: { ok, earned, energy, totalDct }
 * 
 * Хранилище: Supabase таблица dc_taps
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_KEY не задан! Серверные API не будут работать.')
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// Лимиты из gameData (дублируем на сервере — источник правды)
const ENERGY_MAX = 200
const REGEN_MS = 120000  // 1 энергия за 120 сек
const MIN_TAP_INTERVAL_MS = 150  // Минимум 150мс между тапами (защита от автокликера)
const DCT_PER_TAP = [0.01, 0.03, 0.05, 0.08, 0.12, 0.16, 0.20, 0.24, 0.28, 0.32, 0.35, 0.38, 0.40]

// ═══ Проверка Origin ═══
function checkOrigin(request) {
  const origin = request.headers.get('origin') || request.headers.get('referer') || ''
  const allowed = process.env.NEXT_PUBLIC_SITE_URL || ''
  if (process.env.NODE_ENV === 'production' && allowed && !origin.startsWith(allowed)) {
    return false
  }
  // FIX #6: если NEXT_PUBLIC_SITE_URL не задан в production — блокируем
  if (process.env.NODE_ENV === 'production' && !allowed) {
    return false
  }
  return true
}

export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await request.json()
    const { wallet, level } = body

    // Валидация входных данных
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'Invalid wallet' }, { status: 400 })
    }
    const lv = Math.max(0, Math.min(12, parseInt(level) || 0))
    const dctPerTap = DCT_PER_TAP[lv] || 0.01

    // Получаем или создаём запись игрока
    const walletLower = wallet.toLowerCase()
    let { data: player, error: fetchErr } = await supabase
      .from('dc_taps')
      .select('*')
      .eq('wallet', walletLower)
      .single()

    const now = Date.now()

    if (!player) {
      // Новый игрок
      const { data: newPlayer, error: insertErr } = await supabase
        .from('dc_taps')
        .insert({
          wallet: walletLower,
          energy: ENERGY_MAX,
          total_dct: 0,
          total_taps: 0,
          last_tap_at: now,
          last_regen_at: now,
        })
        .select()
        .single()

      if (insertErr) {
        return NextResponse.json({ ok: false, error: 'DB error' }, { status: 500 })
      }
      player = newPlayer
    }

    // Проверка cooldown (минимум 150мс между тапами)
    const timeSinceLastTap = now - (player.last_tap_at || 0)
    if (timeSinceLastTap < MIN_TAP_INTERVAL_MS) {
      return NextResponse.json({
        ok: false,
        error: 'Too fast',
        energy: player.energy,
        totalDct: player.total_dct,
      }, { status: 429 })
    }

    // Рассчитываем восстановленную энергию с последнего тапа
    const timeSinceRegen = now - (player.last_regen_at || now)
    const regenAmount = Math.floor(timeSinceRegen / REGEN_MS)
    const currentEnergy = Math.min(ENERGY_MAX, (player.energy || 0) + regenAmount)

    // Проверка энергии
    if (currentEnergy <= 0) {
      return NextResponse.json({
        ok: false,
        error: 'No energy',
        energy: 0,
        totalDct: player.total_dct,
      })
    }

    // Начисляем тап
    const newEnergy = currentEnergy - 1
    const earned = dctPerTap
    const newTotal = +(player.total_dct + earned).toFixed(4)
    const newTaps = (player.total_taps || 0) + 1

    // Обновляем в базе
    const { error: updateErr } = await supabase
      .from('dc_taps')
      .update({
        energy: newEnergy,
        total_dct: newTotal,
        total_taps: newTaps,
        last_tap_at: now,
        last_regen_at: regenAmount > 0 ? now : player.last_regen_at,
        level: lv,
      })
      .eq('wallet', walletLower)

    if (updateErr) {
      return NextResponse.json({ ok: false, error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      earned,
      energy: newEnergy,
      maxEnergy: ENERGY_MAX,
      totalDct: newTotal,
      totalTaps: newTaps,
    })

  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

// GET — получить текущее состояние игрока
export async function GET(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 503 })
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'Invalid wallet' }, { status: 400 })
    }

    const walletLower = wallet.toLowerCase()
    const { data: player } = await supabase
      .from('dc_taps')
      .select('*')
      .eq('wallet', walletLower)
      .single()

    if (!player) {
      return NextResponse.json({
        ok: true,
        energy: ENERGY_MAX,
        maxEnergy: ENERGY_MAX,
        totalDct: 0,
        totalTaps: 0,
      })
    }

    // Рассчитываем текущую энергию
    const now = Date.now()
    const timeSinceRegen = now - (player.last_regen_at || now)
    const regenAmount = Math.floor(timeSinceRegen / REGEN_MS)
    const currentEnergy = Math.min(ENERGY_MAX, (player.energy || 0) + regenAmount)

    return NextResponse.json({
      ok: true,
      energy: currentEnergy,
      maxEnergy: ENERGY_MAX,
      totalDct: player.total_dct || 0,
      totalTaps: player.total_taps || 0,
    })

  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
