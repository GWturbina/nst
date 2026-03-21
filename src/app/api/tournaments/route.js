/**
 * API Route: /api/tournaments
 * 
 * GET — лидерборд за текущий/указанный месяц
 * POST — обновить статистику (вызывается при тапах, покупках, продажах)
 * 
 * FIX #1: Защита от накрутки:
 *   - 'tap' — валидация через dc_taps (сверка total_dct)
 *   - 'invite','turnover','gem_sale','jewelry_sale' — только admin/service
 * 
 * Категории:
 *   invites     — кто больше пригласил
 *   turnover    — товарооборот (своя + команда)
 *   taps_dct    — кто натапал больше NSS
 *   max_gem     — самая большая продажа камня
 *   max_jewelry — самая большая продажа изделия
 * 
 * Обнуление: 1-го числа каждого месяца (автоматически по month key)
 * Призы: 1-3 место — DCT / доли бриллиантов (назначает Админ)
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyWallet } from '@/lib/authHelper'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ═══ Проверка Origin ═══
function checkOrigin(request) {
  const origin = request.headers.get('origin') || request.headers.get('referer') || ''
  const allowed = process.env.NEXT_PUBLIC_SITE_URL || ''
  if (process.env.NODE_ENV === 'production' && allowed && !origin.startsWith(allowed)) {
    return false
  }
  // FIX: если NEXT_PUBLIC_SITE_URL не задан в production — блокируем
  if (process.env.NODE_ENV === 'production' && !allowed) {
    return false
  }
  return true
}

// Действия, которые может вызвать только admin (или внутренний сервис)
const ADMIN_ONLY_ACTIONS = ['invite', 'turnover', 'gem_sale', 'jewelry_sale']

// GET: лидерборд
export async function GET(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })

  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || getCurrentMonth()
    const category = searchParams.get('category') || 'invites'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const orderColumn = {
      invites: 'invites',
      turnover: 'turnover',
      taps_dct: 'taps_dct',
      max_gem: 'max_gem_sale',
      max_jewelry: 'max_jewelry_sale',
    }[category] || 'invites'

    const { data, error } = await supabase
      .from('dc_tournaments')
      .select('*')
      .eq('month', month)
      .gt(orderColumn, 0)
      .order(orderColumn, { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({
      ok: true,
      month,
      category,
      leaderboard: data || [],
      currentMonth: getCurrentMonth(),
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка загрузки' }, { status: 500 })
  }
}

// POST: обновить статистику
export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { wallet, action, amount, adminWallet } = body

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
    }

    // FIX #7: Проверка подписи — для admin-действий проверяем adminWallet, для tap — wallet
    const authField = ADMIN_ONLY_ACTIONS.includes(action) ? 'adminWallet' : 'wallet'
    const verified = await verifyWallet(body, authField)
    if (!verified) {
      return NextResponse.json({ ok: false, error: 'Неверная подпись кошелька' }, { status: 401 })
    }

    const wLower = wallet.toLowerCase()
    const month = getCurrentMonth()

    // ═══ FIX #1: Проверка прав на действие ═══
    if (ADMIN_ONLY_ACTIONS.includes(action)) {
      // Эти действия — только для админа
      if (!adminWallet || !/^0x[a-fA-F0-9]{40}$/.test(adminWallet)) {
        return NextResponse.json({ ok: false, error: 'Требуется adminWallet' }, { status: 403 })
      }
      const aLower = adminWallet.toLowerCase()
      const { data: admin } = await supabase
        .from('dc_admins')
        .select('role, active')
        .eq('wallet', aLower)
        .single()
      if (!admin || !admin.active) {
        return NextResponse.json({ ok: false, error: 'Нет прав администратора' }, { status: 403 })
      }
    } else if (action === 'tap') {
      // Тапы — валидируем через dc_taps (сверка что пользователь реально тапает)
      const { data: tapRecord } = await supabase
        .from('dc_taps')
        .select('total_dct, total_taps')
        .eq('wallet', wLower)
        .single()
      if (!tapRecord) {
        return NextResponse.json({ ok: false, error: 'Нет записи тапов' }, { status: 400 })
      }
      // amount не может быть больше total_dct из серверной тапалки
      const val = parseFloat(amount) || 0
      if (val > parseFloat(tapRecord.total_dct) + 1) {
        return NextResponse.json({ ok: false, error: 'Невалидная сумма тапов' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ ok: false, error: 'Неизвестное действие' }, { status: 400 })
    }

    // Получить или создать запись
    let { data: record } = await supabase
      .from('dc_tournaments')
      .select('*')
      .eq('wallet', wLower)
      .eq('month', month)
      .single()

    if (!record) {
      const { data: newRecord, error } = await supabase
        .from('dc_tournaments')
        .insert({ wallet: wLower, month })
        .select()
        .single()
      if (error) throw error
      record = newRecord
    }

    // Обновить по действию
    const updates = { updated_at: new Date().toISOString() }
    const val = parseFloat(amount) || 0

    switch (action) {
      case 'invite':
        updates.invites = (record.invites || 0) + 1
        break
      case 'turnover':
        updates.turnover = +(parseFloat(record.turnover || 0) + val).toFixed(2)
        break
      case 'tap':
        updates.taps_dct = +(parseFloat(record.taps_dct || 0) + val).toFixed(4)
        break
      case 'gem_sale':
        if (val > parseFloat(record.max_gem_sale || 0)) updates.max_gem_sale = val
        break
      case 'jewelry_sale':
        if (val > parseFloat(record.max_jewelry_sale || 0)) updates.max_jewelry_sale = val
        break
      default:
        return NextResponse.json({ ok: false, error: 'Неизвестное действие' }, { status: 400 })
    }

    const { error } = await supabase
      .from('dc_tournaments')
      .update(updates)
      .eq('wallet', wLower)
      .eq('month', month)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
