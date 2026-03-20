/**
 * API Route: /api/lots
 * 
 * GET    — список лотов (публичный)
 * POST   — создать лот (только админ)
 * PATCH  — обновить лот (резерв, статус, подарок, запись покупки)
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyWallet } from '@/lib/authHelper'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

function checkOrigin(request) {
  const origin = request.headers.get('origin') || request.headers.get('referer') || ''
  const allowed = process.env.NEXT_PUBLIC_SITE_URL || ''
  if (process.env.NODE_ENV === 'production' && allowed && !origin.startsWith(allowed)) return false
  if (process.env.NODE_ENV === 'production' && !allowed) return false
  return true
}

async function isAdmin(wallet) {
  if (!supabase || !wallet) return false
  const { data } = await supabase
    .from('dc_admins')
    .select('role, active')
    .eq('wallet', wallet.toLowerCase())
    .single()
  return data && data.active
}

async function addLog(lotId, action, actor, details = '') {
  if (!supabase) return
  try {
    await supabase.from('dc_lot_log').insert({
      lot_id: lotId, action, actor: actor?.toLowerCase(), details: details || null,
    })
  } catch {}
}

const clean = (s) => String(s || '').replace(/[<>"';]/g, '').slice(0, 500)
const num = (v, min = 0, max = 999999999) => Math.max(min, Math.min(max, parseFloat(v) || 0))

// ═══ GET: Список лотов ═══
export async function GET(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const wallet = searchParams.get('wallet')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    let query = supabase
      .from('dc_lots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') query = query.eq('status', status)

    const { data: lots, error } = await query
    if (error) throw error

    // Если запросили для конкретного кошелька — достать его доли
    let myShares = {}
    if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      const { data: shares } = await supabase
        .from('dc_lot_shares')
        .select('lot_id, shares_count')
        .eq('wallet', wallet.toLowerCase())
        .eq('is_reserved', false)

      if (shares) {
        for (const s of shares) {
          myShares[s.lot_id] = (myShares[s.lot_id] || 0) + s.shares_count
        }
      }
    }

    return NextResponse.json({ ok: true, lots: lots || [], myShares })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка загрузки' }, { status: 500 })
  }
}

// ═══ POST: Создать лот (только админ) ═══
export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const verified = await verifyWallet(body, 'adminWallet')
    if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })

    const { adminWallet, title, description, photoUrl, gemType, shape, clarity, color,
      carats, hasCert, gemCost, sharePrice, minGwLevel, lockDays, adminCommit } = body

    if (!(await isAdmin(adminWallet))) {
      return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })
    }

    // Валидация
    const gc = num(gemCost, 10, 10000000)
    const sp = num(sharePrice)
    if (![25, 50, 100].includes(sp)) {
      return NextResponse.json({ ok: false, error: 'Цена доли: $25, $50 или $100' }, { status: 400 })
    }
    if (!title) return NextResponse.json({ ok: false, error: 'Укажите название' }, { status: 400 })

    const lotPrice = Math.round(gc * 100 / 80 * 100) / 100 // gemCost * 1.25
    const totalShares = Math.floor(lotPrice / sp)
    if (totalShares < 2) return NextResponse.json({ ok: false, error: 'Мало долей (мин. 2)' }, { status: 400 })

    const { data, error } = await supabase
      .from('dc_lots')
      .insert({
        title: clean(title),
        description: clean(description),
        photo_url: clean(photoUrl) || null,
        gem_type: clean(gemType) || 'diamond',
        shape: clean(shape) || null,
        clarity: clean(clarity) || null,
        color: clean(color) || null,
        carats: num(carats, 0, 100) || null,
        has_cert: !!hasCert,
        gem_cost: gc,
        share_price: sp,
        lot_price: lotPrice,
        total_shares: totalShares,
        min_gw_level: Math.max(1, Math.min(12, parseInt(minGwLevel) || 4)),
        lock_days: Math.max(30, Math.min(730, parseInt(lockDays) || 180)),
        admin_commit: clean(adminCommit) || null,
        created_by: adminWallet.toLowerCase(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ ok: false, error: 'Ошибка создания' }, { status: 500 })

    await addLog(data.id, 'CREATED', adminWallet, `${clean(title)} — $${gc} → лот $${lotPrice} (${totalShares} долей × $${sp})`)
    return NextResponse.json({ ok: true, lot: data })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}

// ═══ PATCH: Обновить лот ═══
export async function PATCH(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { action } = body

    // ═══ RECORD_PURCHASE — записать покупку в Supabase (после блокчейн-транзакции) ═══
    if (action === 'record_purchase') {
      const verified = await verifyWallet(body)
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })

      const { wallet, lotId, sharesCount, usdtAmount, txHash } = body
      if (!lotId || !sharesCount) return NextResponse.json({ ok: false, error: 'Нет данных' }, { status: 400 })

      // FIX #4: Валидация txHash (должен быть 66-символьный hex)
      if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return NextResponse.json({ ok: false, error: 'Неверный txHash' }, { status: 400 })
      }

      // FIX #4: Проверка на дубликат txHash (защита от повторной отправки)
      const { data: existing } = await supabase
        .from('dc_lot_shares')
        .select('id')
        .eq('tx_hash', clean(txHash))
        .limit(1)
      if (existing && existing.length > 0) {
        return NextResponse.json({ ok: false, error: 'Транзакция уже записана' }, { status: 409 })
      }

      const wLower = wallet.toLowerCase()
      const cnt = Math.max(1, Math.min(100, parseInt(sharesCount) || 1))

      // FIX #3: Проверяем лот и считаем доступные доли ДО записи
      const { data: lot } = await supabase.from('dc_lots').select('sold_shares, total_shares, reserved_shares, status').eq('id', lotId).single()
      if (!lot || lot.status !== 'active') {
        return NextResponse.json({ ok: false, error: 'Лот не активен' }, { status: 400 })
      }
      const available = lot.total_shares - lot.sold_shares
      if (cnt > available) {
        return NextResponse.json({ ok: false, error: `Доступно только ${available} долей` }, { status: 400 })
      }

      // Записать долю
      const { error: shareErr } = await supabase
        .from('dc_lot_shares')
        .insert({
          lot_id: lotId,
          wallet: wLower,
          shares_count: cnt,
          usdt_amount: num(usdtAmount),
          tx_hash: clean(txHash) || null,
        })
      if (shareErr) return NextResponse.json({ ok: false, error: 'Ошибка записи' }, { status: 500 })

      // FIX #3: Атомарный инкремент через SQL (избегает race condition)
      const newSold = lot.sold_shares + cnt
      const newReserved = Math.max(0, (lot.reserved_shares || 0) - cnt)
      const updates = { sold_shares: newSold, reserved_shares: newReserved }
      if (newSold >= lot.total_shares) {
        updates.status = 'filled'
      }
      await supabase.from('dc_lots').update(updates).eq('id', lotId).eq('sold_shares', lot.sold_shares) // optimistic lock

      await addLog(lotId, 'SHARE_BOUGHT', wLower, `${cnt} доля(ей) — $${num(usdtAmount)} tx:${clean(txHash).slice(0,10)}`)
      return NextResponse.json({ ok: true })
    }

    // ═══ RESERVE — зарезервировать доли (админ, стартовый толчок) ═══
    if (action === 'reserve') {
      const verified = await verifyWallet(body, 'adminWallet')
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })

      const { adminWallet, lotId, count } = body
      if (!(await isAdmin(adminWallet))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })

      const cnt = Math.max(1, Math.min(20, parseInt(count) || 1))

      const { data: lot } = await supabase.from('dc_lots').select('*').eq('id', lotId).single()
      if (!lot || lot.status !== 'active') return NextResponse.json({ ok: false, error: 'Лот не активен' }, { status: 400 })

      const available = lot.total_shares - lot.sold_shares - lot.reserved_shares
      if (cnt > available) return NextResponse.json({ ok: false, error: `Доступно только ${available} долей` }, { status: 400 })

      await supabase.from('dc_lots').update({ reserved_shares: lot.reserved_shares + cnt }).eq('id', lotId)

      // Записать как зарезервированную (без оплаты)
      await supabase.from('dc_lot_shares').insert({
        lot_id: lotId,
        wallet: adminWallet.toLowerCase(),
        shares_count: cnt,
        usdt_amount: 0,
        is_reserved: true,
      })

      await addLog(lotId, 'RESERVED', adminWallet, `${cnt} доля(ей) зарезервировано`)
      return NextResponse.json({ ok: true })
    }

    // ═══ GIFT — подарить зарезервированную долю (админ) ═══
    if (action === 'gift') {
      const verified = await verifyWallet(body, 'adminWallet')
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })

      const { adminWallet, lotId, recipientWallet, count } = body
      if (!(await isAdmin(adminWallet))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })
      if (!recipientWallet || !/^0x[a-fA-F0-9]{40}$/.test(recipientWallet)) {
        return NextResponse.json({ ok: false, error: 'Неверный кошелёк получателя' }, { status: 400 })
      }

      const cnt = Math.max(1, Math.min(10, parseInt(count) || 1))
      const rLower = recipientWallet.toLowerCase()

      // Записать подарок
      const { data: lot } = await supabase.from('dc_lots').select('share_price').eq('id', lotId).single()
      await supabase.from('dc_lot_shares').insert({
        lot_id: lotId,
        wallet: rLower,
        shares_count: cnt,
        usdt_amount: (lot?.share_price || 0) * cnt,
        is_gift: true,
      })

      // FIX #8: Обновить счётчики: sold +cnt, reserved -cnt (надёжно)
      const { data: lotState } = await supabase.from('dc_lots').select('sold_shares, reserved_shares, total_shares').eq('id', lotId).single()
      if (lotState) {
        const newSold = lotState.sold_shares + cnt
        const updates = {
          sold_shares: newSold,
          reserved_shares: Math.max(0, lotState.reserved_shares - cnt),
        }
        if (newSold >= lotState.total_shares) updates.status = 'filled'
        await supabase.from('dc_lots').update(updates).eq('id', lotId)
      }

      await addLog(lotId, 'GIFTED', adminWallet, `${cnt} доля(ей) → ${rLower}`)
      return NextResponse.json({ ok: true })
    }

    // ═══ SET_WINNER — записать победителя (после revealWinner на контракте) ═══
    if (action === 'set_winner') {
      const verified = await verifyWallet(body, 'adminWallet')
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })

      const { adminWallet, lotId, winnerWallet } = body
      if (!(await isAdmin(adminWallet))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })

      const now = new Date().toISOString()
      const { data: lot } = await supabase.from('dc_lots').select('lock_days').eq('id', lotId).single()
      const lockMs = (lot?.lock_days || 180) * 86400 * 1000
      const unlockAt = new Date(Date.now() + lockMs).toISOString()

      await supabase.from('dc_lots').update({
        status: 'completed',
        winner_wallet: winnerWallet.toLowerCase(),
        winner_at: now,
        unlock_at: unlockAt,
      }).eq('id', lotId)

      await addLog(lotId, 'WINNER', adminWallet, `Получатель: ${winnerWallet}`)
      return NextResponse.json({ ok: true })
    }

    // ═══ CANCEL — отменить лот ═══
    if (action === 'cancel') {
      const verified = await verifyWallet(body, 'adminWallet')
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })

      const { adminWallet, lotId } = body
      if (!(await isAdmin(adminWallet))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })

      await supabase.from('dc_lots').update({ status: 'cancelled' }).eq('id', lotId)
      await addLog(lotId, 'CANCELLED', adminWallet)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Неизвестное действие' }, { status: 400 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
