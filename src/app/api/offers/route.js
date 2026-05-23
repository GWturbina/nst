/**
 * API Route: /api/offers
 *
 * GET  — список активных предложений (публичный)
 * POST — action: 'create' | 'close' | 'request' | 'list_requests' | 'process_request'
 *
 * Поддержка: несколько фото/видео (массивы), цена опциональна (price_from / по запросу).
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyWallet } from '@/lib/authHelper'
import { checkOrigin } from '@/lib/checkOrigin'

const ADMIN_TTL_SEC = 86400 // 24ч — используем сохранённую подпись (authFetch), как в заказах

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

async function isAdmin(wallet) {
  if (!supabase || !wallet) return false
  const { data } = await supabase.from('dc_admins').select('role, active').eq('wallet', wallet.toLowerCase()).single()
  return data && data.active
}

const clean = (s) => String(s || '').replace(/[<>"';]/g, '').slice(0, 2000)
const num = (v, min = 0, max = 999999999) => Math.max(min, Math.min(max, parseFloat(v) || 0))
const arr = (v) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.length < 600).slice(0, 12) : []

export async function GET() {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  const { data, error } = await supabase.from('dc_offers').select('*').eq('status', 'active').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  const now = Date.now()
  const active = (data || []).filter(o => !o.expires_at || new Date(o.expires_at).getTime() > now)
  return NextResponse.json({ ok: true, offers: active })
}

export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const action = body?.action

    // ─── СОЗДАТЬ (админ) ───
    if (action === 'create') {
      const admin = await verifyWallet(body, 'adminWallet', ADMIN_TTL_SEC)
      if (!admin) return NextResponse.json({ ok: false, error: 'Неверная подпись или срок истёк (5 мин)' }, { status: 401 })
      if (!(await isAdmin(admin))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })

      const title = clean(body.title)
      if (!title) return NextResponse.json({ ok: false, error: 'Укажите название' }, { status: 400 })

      const row = {
        title,
        carat: body.carat ? num(body.carat, 0, 10000) : null,
        color: body.color ? clean(body.color) : null,
        clarity: body.clarity ? clean(body.clarity) : null,
        price_from: body.priceFrom ? num(body.priceFrom, 0, 100000000) : null,
        description: body.description ? clean(body.description) : null,
        photos: arr(body.photos),
        photo_paths: arr(body.photoPaths),
        videos: arr(body.videos),
        expires_at: body.expiresAt || null,
        status: 'active',
      }
      const { data, error } = await supabase.from('dc_offers').insert(row).select().single()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, offer: data })
    }

    // ─── ЗАКРЫТЬ (админ) ───
    if (action === 'close') {
      const admin = await verifyWallet(body, 'adminWallet', ADMIN_TTL_SEC)
      if (!admin) return NextResponse.json({ ok: false, error: 'Неверная подпись или срок истёк (5 мин)' }, { status: 401 })
      if (!(await isAdmin(admin))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })
      const offerId = parseInt(body.offerId)
      if (!offerId) return NextResponse.json({ ok: false, error: 'Не указан ID' }, { status: 400 })
      const { error } = await supabase.from('dc_offers').update({ status: 'closed' }).eq('id', offerId)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ─── ЗАЯВКА «ХОЧУ» (вкладчик) ───
    if (action === 'request') {
      const wallet = await verifyWallet(body)
      if (!wallet) return NextResponse.json({ ok: false, error: 'Подключите кошелёк' }, { status: 401 })
      const offerId = parseInt(body.offerId)
      if (!offerId) return NextResponse.json({ ok: false, error: 'Не указано предложение' }, { status: 400 })

      const { data: offer } = await supabase.from('dc_offers').select('id, status').eq('id', offerId).single()
      if (!offer || offer.status !== 'active') return NextResponse.json({ ok: false, error: 'Предложение недоступно' }, { status: 400 })

      const { data: existing } = await supabase.from('dc_offer_requests').select('id')
        .eq('offer_id', offerId).eq('wallet', wallet.toLowerCase()).eq('status', 'new').maybeSingle()
      if (existing) return NextResponse.json({ ok: false, error: 'Заявка уже отправлена' }, { status: 400 })

      const row = {
        offer_id: offerId,
        wallet: wallet.toLowerCase(),
        deposit_usdt: body.depositUsdt ? num(body.depositUsdt, 0) : null,
        status: 'new',
      }
      const { error } = await supabase.from('dc_offer_requests').insert(row)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ─── СПИСОК ЗАЯВОК (админ) ───
    if (action === 'list_requests') {
      const admin = await verifyWallet(body, 'adminWallet', ADMIN_TTL_SEC)
      if (!admin) return NextResponse.json({ ok: false, error: 'Неверная подпись или срок истёк (5 мин)' }, { status: 401 })
      if (!(await isAdmin(admin))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })
      const { data, error } = await supabase.from('dc_offer_requests')
        .select('*, dc_offers(title, price_from)').order('created_at', { ascending: false }).limit(200)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, requests: data || [] })
    }

    // ─── ОБРАБОТАТЬ ЗАЯВКУ (админ) ───
    if (action === 'process_request') {
      const admin = await verifyWallet(body, 'adminWallet', ADMIN_TTL_SEC)
      if (!admin) return NextResponse.json({ ok: false, error: 'Неверная подпись или срок истёк (5 мин)' }, { status: 401 })
      if (!(await isAdmin(admin))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })
      const reqId = parseInt(body.requestId)
      if (!reqId) return NextResponse.json({ ok: false, error: 'Не указан ID заявки' }, { status: 400 })
      const { error } = await supabase.from('dc_offer_requests').update({ status: 'processed' }).eq('id', reqId)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Неизвестное действие' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200) }, { status: 500 })
  }
}
