/**
 * API Route: /api/admin
 * FIX #5: Серверный API для админских операций
 * 
 * Все операции требуют adminWallet + проверку через dc_admins (service_role)
 * 
 * PATCH /api/admin — действия:
 *   link_blockchain — привязать gem_id/purchase_id к заказу
 *   link_lot        — привязать lot_id к заказу
 *   add_note        — добавить заметку к заказу
 *   add_admin       — добавить сотрудника (только owner)
 *   remove_admin    — деактивировать сотрудника (только owner)
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// ═══ Проверка Origin ═══
function checkOrigin(request) {
  const origin = request.headers.get('origin') || request.headers.get('referer') || ''
  const allowed = process.env.NEXT_PUBLIC_SITE_URL || ''
  if (process.env.NODE_ENV === 'production' && allowed && !origin.startsWith(allowed)) {
    return false
  }
  if (process.env.NODE_ENV === 'production' && !allowed) {
    return false
  }
  return true
}

// Добавить запись в лог
async function addOrderLog(orderId, action, actor, details = '') {
  if (!supabase) return
  try {
    await supabase.from('dc_order_log').insert({
      order_id: orderId,
      action,
      actor: actor.toLowerCase(),
      details: details || null,
    })
  } catch {}
}

export async function PATCH(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { action, adminWallet } = body

    // Валидация админа
    if (!adminWallet || !/^0x[a-fA-F0-9]{40}$/.test(adminWallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк админа' }, { status: 400 })
    }
    const aLower = adminWallet.toLowerCase()

    // Проверка роли
    const { data: admin } = await supabase
      .from('dc_admins')
      .select('role, active')
      .eq('wallet', aLower)
      .single()

    if (!admin || !admin.active) {
      return NextResponse.json({ ok: false, error: 'Нет прав администратора' }, { status: 403 })
    }

    const clean = (s) => String(s || '').replace(/[<>"';]/g, '').slice(0, 500)

    // ═══ LINK BLOCKCHAIN ═══
    if (action === 'link_blockchain') {
      const { orderId, gemId, purchaseId } = body
      if (!orderId) return NextResponse.json({ ok: false, error: 'Нет orderId' }, { status: 400 })

      const { error } = await supabase
        .from('dc_orders')
        .update({ gem_id: parseInt(gemId) || null, purchase_id: parseInt(purchaseId) || null })
        .eq('id', orderId)

      if (error) return NextResponse.json({ ok: false, error: 'Ошибка обновления' }, { status: 500 })

      await addOrderLog(orderId, 'BLOCKCHAIN', aLower, `gemId=${gemId}, purchaseId=${purchaseId}`)
      return NextResponse.json({ ok: true })
    }

    // ═══ LINK LOT ═══
    if (action === 'link_lot') {
      const { orderId, lotId } = body
      if (!orderId) return NextResponse.json({ ok: false, error: 'Нет orderId' }, { status: 400 })

      const { error } = await supabase
        .from('dc_orders')
        .update({ lot_id: parseInt(lotId) || null })
        .eq('id', orderId)

      if (error) return NextResponse.json({ ok: false, error: 'Ошибка обновления' }, { status: 500 })

      await addOrderLog(orderId, 'LOT_LINKED', aLower, `Лот #${lotId}`)
      return NextResponse.json({ ok: true })
    }

    // ═══ ADD NOTE ═══
    if (action === 'add_note') {
      const { orderId, note } = body
      if (!orderId || !note) return NextResponse.json({ ok: false, error: 'Нет orderId или note' }, { status: 400 })

      const { error } = await supabase
        .from('dc_orders')
        .update({ admin_note: clean(note) })
        .eq('id', orderId)

      if (error) return NextResponse.json({ ok: false, error: 'Ошибка обновления' }, { status: 500 })

      await addOrderLog(orderId, 'NOTE', aLower, clean(note))
      return NextResponse.json({ ok: true })
    }

    // ═══ ADD ADMIN (только owner) ═══
    if (action === 'add_admin') {
      if (admin.role !== 'owner') {
        return NextResponse.json({ ok: false, error: 'Только owner может добавлять сотрудников' }, { status: 403 })
      }
      const { wallet, role, name, maxAmount } = body
      if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return NextResponse.json({ ok: false, error: 'Неверный кошелёк сотрудника' }, { status: 400 })
      }
      if (!['owner', 'manager', 'operator'].includes(role)) {
        return NextResponse.json({ ok: false, error: 'Неверная роль' }, { status: 400 })
      }

      const { error } = await supabase
        .from('dc_admins')
        .upsert({
          wallet: wallet.toLowerCase(),
          role,
          name: clean(name) || '',
          max_amount: Math.max(0, parseFloat(maxAmount) || 0),
          active: true,
        }, { onConflict: 'wallet' })

      if (error) return NextResponse.json({ ok: false, error: 'Ошибка добавления' }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ═══ REMOVE ADMIN (только owner) ═══
    if (action === 'remove_admin') {
      if (admin.role !== 'owner') {
        return NextResponse.json({ ok: false, error: 'Только owner может удалять сотрудников' }, { status: 403 })
      }
      const { wallet } = body
      if (!wallet) return NextResponse.json({ ok: false, error: 'Нет wallet' }, { status: 400 })

      const { error } = await supabase
        .from('dc_admins')
        .update({ active: false })
        .eq('wallet', wallet.toLowerCase())

      if (error) return NextResponse.json({ ok: false, error: 'Ошибка' }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Неизвестное действие' }, { status: 400 })

  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
