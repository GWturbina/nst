/**
 * API Route: /api/orders
 *
 * POST   — создать заказ
 *          - обычный заказ камня (order_type = 'stone', как было)
 *          - ЗАЯВКА С ВИТРИНЫ (order_type = 'showcase_request') — новый тип,
 *            пишется при нажатии "Хочу купить" в витрине.
 *
 * PATCH  — обновить статус (админ, проверка подписи + роли в Supabase)
 *
 * Rate-limit: 1 заказ в 30 сек на кошелёк (для обоих типов).
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyWallet } from '@/lib/authHelper'
import { checkOrigin } from '@/lib/checkOrigin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_KEY не задан! Серверные API не будут работать.')
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

const RATE_LIMIT_SEC = 30

const STATUS_TRANSITIONS = {
  PAID:       ['APPROVED', 'CANCELLED'],
  APPROVED:   ['PRODUCTION', 'CANCELLED'],
  PRODUCTION: ['READY', 'CANCELLED'],
  READY:      ['COMPLETED'],
  COMPLETED:  [],
  CANCELLED:  [],
  // Статусы для заявок с витрины
  NEW:        ['CONTACTED', 'CANCELLED'],
  CONTACTED:  ['COMPLETED', 'CANCELLED'],
}

const clean = (str) => String(str || '').replace(/[<>"';]/g, '').slice(0, 200)
const num = (v, min = 0, max = 999999) => Math.max(min, Math.min(max, parseFloat(v) || 0))

// ═══ POST: Создать заказ ═══
export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await request.json()
    const { wallet, orderType, params } = body

    const verified = await verifyWallet(body)
    if (!verified) {
      return NextResponse.json({ ok: false, error: 'Неверная подпись кошелька' }, { status: 401 })
    }

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
    }

    const wLower = wallet.toLowerCase()

    // Rate-limit
    const cutoff = new Date(Date.now() - RATE_LIMIT_SEC * 1000).toISOString()
    const { data: recentOrders } = await supabase
      .from('dc_orders')
      .select('id')
      .eq('wallet', wLower)
      .gte('created_at', cutoff)
      .limit(1)
    if (recentOrders && recentOrders.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Подождите ${RATE_LIMIT_SEC} сек перед следующей заявкой` },
        { status: 429 }
      )
    }

    // ──────────────────────────────────────────────
    // ВЕТКА 1: ЗАЯВКА С ВИТРИНЫ (showcase_request)
    // ──────────────────────────────────────────────
    if (orderType === 'showcase_request') {
      if (!params || !params.showcaseItemId) {
        return NextResponse.json({ ok: false, error: 'Не указан товар с витрины' }, { status: 400 })
      }
      const showcaseItemId = parseInt(params.showcaseItemId)
      if (!showcaseItemId || showcaseItemId < 1) {
        return NextResponse.json({ ok: false, error: 'Неверный ID товара' }, { status: 400 })
      }

      // Проверяем что товар существует и активен
      const { data: item } = await supabase
        .from('dc_showcase')
        .select('id, title, seller_wallet, club_price, status, category, shape, clarity, color, carat')
        .eq('id', showcaseItemId)
        .single()

      if (!item) {
        return NextResponse.json({ ok: false, error: 'Товар не найден' }, { status: 404 })
      }
      if (item.status !== 'active') {
        return NextResponse.json({ ok: false, error: 'Товар недоступен' }, { status: 400 })
      }
      if (item.seller_wallet === wLower) {
        return NextResponse.json({ ok: false, error: 'Нельзя заказать свой же товар' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('dc_orders')
        .insert({
          wallet: wLower,
          order_type: 'showcase_request',
          showcase_item_id: showcaseItemId,
          buyer_note: clean(params.note) || null,
          // Дублируем ключевые поля товара для быстрого отображения в админке
          spec_string: clean(item.title),
          gem_type: clean(item.category === 'jewelry' ? 'jewelry' : 'diamond'),
          shape: clean(item.shape),
          clarity: clean(item.clarity),
          color: clean(item.color),
          carats: item.carat || 0,
          club_price: num(item.club_price),
          retail_price: num(item.club_price), // для заявки розничной не знаем
          status: 'NEW',
        })
        .select()
        .single()

      if (error) {
        console.error('Showcase request insert error:', error)
        return NextResponse.json({ ok: false, error: 'Ошибка создания заявки' }, { status: 500 })
      }

      await supabase.from('dc_order_log').insert({
        order_id: data.id,
        action: 'CREATED',
        actor: wLower,
        details: `Заявка с витрины: ${clean(item.title)} — $${num(item.club_price)}`,
      })

      return NextResponse.json({ ok: true, order: data, sellerWallet: item.seller_wallet })
    }

    // ──────────────────────────────────────────────
    // ВЕТКА 2: ОБЫЧНЫЙ ЗАКАЗ КАМНЯ (stone)
    // ──────────────────────────────────────────────
    if (!params || !params.gemType || !params.clubPrice) {
      return NextResponse.json({ ok: false, error: 'Неполные данные' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('dc_orders')
      .insert({
        wallet: wLower,
        order_type: 'stone',
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

    await supabase.from('dc_order_log').insert({
      order_id: data.id,
      action: 'CREATED',
      actor: wLower,
      details: `Заказ: ${clean(params.specString)} — $${num(params.clubPrice)}`,
    })

    return NextResponse.json({ ok: true, order: data })

  } catch (err) {
    console.error('Orders POST error:', err)
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}

// ═══ PATCH: Обновить статус (админ) ═══
export async function PATCH(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  try {
    const body = await request.json()
    const { orderId, newStatus, adminWallet, note } = body

    const verified = await verifyWallet(body, 'adminWallet')
    if (!verified) {
      return NextResponse.json({ ok: false, error: 'Неверная подпись кошелька' }, { status: 401 })
    }

    if (!adminWallet || !/^0x[a-fA-F0-9]{40}$/.test(adminWallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
    }
    if (!orderId || !newStatus) {
      return NextResponse.json({ ok: false, error: 'Нет orderId или newStatus' }, { status: 400 })
    }

    const aLower = adminWallet.toLowerCase()

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

    const { data: order } = await supabase
      .from('dc_orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!order) {
      return NextResponse.json({ ok: false, error: 'Заказ не найден' }, { status: 404 })
    }

    const allowed = STATUS_TRANSITIONS[order.status] || []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { ok: false, error: `Нельзя: ${order.status} → ${newStatus}` },
        { status: 400 }
      )
    }

    if (admin.role === 'manager' && admin.max_amount > 0 && order.club_price > admin.max_amount) {
      return NextResponse.json(
        { ok: false, error: `Сумма $${order.club_price} > лимит $${admin.max_amount}` },
        { status: 403 }
      )
    }

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
