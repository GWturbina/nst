/**
 * API Route: /api/orders
 * FIX C3: Серверная проверка админских действий
 * FIX M4: Rate-limit на создание заказов
 * 
 * POST /api/orders — создать заказ (rate-limit: 1 заказ в 30 сек)
 * PATCH /api/orders — обновить статус (только для админов, проверка через Supabase)
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

const RATE_LIMIT_SEC = 30 // 30 секунд между заказами

const STATUS_TRANSITIONS = {
  PAID:       ['APPROVED', 'CANCELLED'],
  APPROVED:   ['PRODUCTION', 'CANCELLED'],
  PRODUCTION: ['READY', 'CANCELLED'],
  READY:      ['COMPLETED'],
  COMPLETED:  [],
  CANCELLED:  [],
}

// ═══ Проверка Origin (защита от чужих сайтов) ═══
function checkOrigin(request) {
  const origin = request.headers.get('origin') || request.headers.get('referer') || ''
  const allowed = process.env.NEXT_PUBLIC_SITE_URL || ''
  // В dev режиме пропускаем, в prod — проверяем
  if (process.env.NODE_ENV === 'production' && allowed && !origin.startsWith(allowed)) {
    return false
  }
  return true
}

// ═══ POST: Создать заказ (с rate-limit) ═══
export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await request.json()
    const { wallet, params } = body

    // Валидация кошелька
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
    }

    const wLower = wallet.toLowerCase()

    // FIX M4: Rate-limit через Supabase (работает на Vercel Serverless)
    const cutoff = new Date(Date.now() - RATE_LIMIT_SEC * 1000).toISOString()
    const { data: recentOrders } = await supabase
      .from('dc_orders')
      .select('id')
      .eq('wallet', wLower)
      .gte('created_at', cutoff)
      .limit(1)
    if (recentOrders && recentOrders.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Подождите ${RATE_LIMIT_SEC} сек перед следующим заказом` },
        { status: 429 }
      )
    }

    // Санитизация
    const clean = (str) => String(str || '').replace(/[<>"';]/g, '').slice(0, 200)
    const num = (v, min = 0, max = 999999) => Math.max(min, Math.min(max, parseFloat(v) || 0))

    if (!params || !params.gemType || !params.clubPrice) {
      return NextResponse.json({ ok: false, error: 'Неполные данные' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('dc_orders')
      .insert({
        wallet: wLower,
        gem_type: clean(params.gemType),
        shape: clean(params.shape),
        clarity: clean(params.clarity),
        color: clean(params.color) || null,
        fancy_color: clean(params.fancyColor) || null,
        intensity: clean(params.intensity) || null,
        carats: num(params.carats, 0.1, 100),
        has_cert: !!params.hasCert,
        region: clean(params.region),
        buy_mode: clean(params.buyMode),
        is_fraction: !!params.isFraction,
        fraction_count: Math.max(0, parseInt(params.fractionCount) || 0),
        total_fractions: Math.max(0, parseInt(params.totalFractions) || 0),
        retail_price: num(params.retailPrice),
        club_price: num(params.clubPrice),
        savings: num(params.savings),
        discount_pct: num(params.discountPct, 0, 100),
        spec_string: clean(params.specString),
        quality_tier: params.qualityTier === 'premium' ? 'premium' : 'standard',
        status: 'PAID',
        paid_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: 'Ошибка создания заказа' }, { status: 500 })
    }

    // Rate-limit обеспечивается через Supabase (проверка created_at выше)

    // Лог
    await supabase.from('dc_order_log').insert({
      order_id: data.id,
      action: 'CREATED',
      actor: wLower,
      details: `Заказ: ${clean(params.specString)} — $${num(params.clubPrice)}`,
    })

    return NextResponse.json({ ok: true, order: data })

  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}

// ═══ PATCH: Обновить статус (FIX C3: серверная проверка админа) ═══
export async function PATCH(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await request.json()
    const { orderId, newStatus, adminWallet, note } = body

    // Валидация
    if (!adminWallet || !/^0x[a-fA-F0-9]{40}$/.test(adminWallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
    }
    if (!orderId || !newStatus) {
      return NextResponse.json({ ok: false, error: 'Нет orderId или newStatus' }, { status: 400 })
    }

    const aLower = adminWallet.toLowerCase()

    // FIX C3: Проверяем роль СЕРВЕРНО через Supabase (service_role ключ)
    const { data: admin } = await supabase
      .from('dc_admins')
      .select('role, active, max_amount')
      .eq('wallet', aLower)
      .single()

    if (!admin || !admin.active) {
      return NextResponse.json({ ok: false, error: 'Нет прав администратора' }, { status: 403 })
    }
    if (admin.role === 'operator') {
      return NextResponse.json({ ok: false, error: 'Оператор не может менять статус' }, { status: 403 })
    }

    // Получаем заказ
    const { data: order } = await supabase
      .from('dc_orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!order) {
      return NextResponse.json({ ok: false, error: 'Заказ не найден' }, { status: 404 })
    }

    // FIX C5: Проверка перехода статуса
    const allowed = STATUS_TRANSITIONS[order.status] || []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { ok: false, error: `Нельзя: ${order.status} → ${newStatus}` },
        { status: 400 }
      )
    }

    // Проверка лимита для manager
    if (admin.role === 'manager' && admin.max_amount > 0 && order.club_price > admin.max_amount) {
      return NextResponse.json(
        { ok: false, error: `Сумма $${order.club_price} > лимит $${admin.max_amount}` },
        { status: 403 }
      )
    }

    // Обновляем
    const updates = { status: newStatus }
    const now = new Date().toISOString()
    if (newStatus === 'APPROVED') { updates.approved_by = aLower; updates.approved_at = now }
    if (newStatus === 'PRODUCTION') { updates.production_at = now }
    if (newStatus === 'READY') { updates.ready_at = now }
    if (newStatus === 'COMPLETED') { updates.completed_by = aLower; updates.completed_at = now }
    if (newStatus === 'CANCELLED') { updates.cancelled_at = now; updates.cancel_reason = note || '' }
    if (note) updates.admin_note = note

    const { error } = await supabase
      .from('dc_orders')
      .update(updates)
      .eq('id', orderId)

    if (error) {
      return NextResponse.json({ ok: false, error: 'Ошибка обновления' }, { status: 500 })
    }

    // Лог
    await supabase.from('dc_order_log').insert({
      order_id: orderId,
      action: newStatus,
      actor: aLower,
      details: note || `Статус → ${newStatus}`,
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
