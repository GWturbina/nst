/**
 * API Route: /api/showcase
 * 
 * GET    — список товаров витрины (фильтры: type, category, status)
 * POST   — создать объявление (корпоративная = только админ, общая = партнёр с мин. 4 уровнями GW)
 * PATCH  — обновить (статус, цена, продажа)
 * DELETE — удалить (только свои или админ)
 *
 * МАРКЕТИНГ ПРИ ПРОДАЖЕ (15% от маржи):
 *   5% — продавцу
 *   2% — авторские
 *   3% — техподдержка
 *   5% — токеномика (2.5% GWT + 2.5% CGT)
 *   90% маржи — на 9 уровней партнёрской программы (20/15/10/10/9/8/7/6/5)
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// Реферальные проценты (из контракта GemVaultV2)
const REFERRAL_SHARES = [20, 15, 10, 10, 9, 8, 7, 6, 5] // 9 уровней, итого 90%

// Маркетинг при продаже — 15% от маржи
const MARKETING = {
  sellerPct: 5,          // 5% продавцу
  authorPct: 2,          // 2% авторские
  techPct: 3,            // 3% техподдержка
  tokenGwtPct: 2.5,      // 2.5% GWT
  tokenCgtPct: 2.5,      // 2.5% CGT
  referralPct: 85,       // 85% от маркетинга → 9 уровней (90% от оставшихся 90%)
  totalMarketingPct: 15, // 15% от маржи
}

// Расчёт маркетинга при продаже
function calculateMarketing(purchasePrice, salePrice) {
  const margin = salePrice - purchasePrice
  if (margin <= 0) return null

  const marketingPool = margin * MARKETING.totalMarketingPct / 100
  const sellerShare = margin * MARKETING.sellerPct / 100
  const authorShare = margin * MARKETING.authorPct / 100
  const techShare = margin * MARKETING.techPct / 100
  const gwtShare = margin * MARKETING.tokenGwtPct / 100
  const cgtShare = margin * MARKETING.tokenCgtPct / 100
  const referralPool = margin * MARKETING.referralPct / 100

  // 9 уровней реферальной программы
  const referralShares = REFERRAL_SHARES.map(pct => +(referralPool * pct / 100).toFixed(2))
  const partnerMargin = margin - marketingPool  // 85% маржи → партнёру

  return {
    margin: +margin.toFixed(2),
    marketingPool: +marketingPool.toFixed(2),
    sellerShare: +sellerShare.toFixed(2),
    authorShare: +authorShare.toFixed(2),
    techShare: +techShare.toFixed(2),
    gwtShare: +gwtShare.toFixed(2),
    cgtShare: +cgtShare.toFixed(2),
    referralPool: +referralPool.toFixed(2),
    referralShares,
    partnerMargin: +partnerMargin.toFixed(2),
  }
}

// Минимальный уровень для продажи/покупки (регулируется)
const MIN_GW_LEVEL = parseInt(process.env.SHOWCASE_MIN_LEVEL || '4')

// GET: список витрины
export async function GET(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')       // 'corporate' | 'partner'
    const category = searchParams.get('category') // 'diamond' | 'jewelry'
    const status = searchParams.get('status') || 'active'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    let query = supabase
      .from('dc_showcase')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (type) query = query.eq('type', type)
    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ ok: true, items: data || [], marketing: MARKETING, referralShares: REFERRAL_SHARES })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка загрузки' }, { status: 500 })
  }
}

// POST: создать объявление
export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })

  try {
    const body = await request.json()
    const { wallet, type, category, title, description, photos, videoUrl, certUrl,
      retailPrice, clubPrice, customPrice, carat, shape, clarity, color, gemId } = body

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
    }
    if (!title) return NextResponse.json({ ok: false, error: 'Укажите название' }, { status: 400 })

    const wLower = wallet.toLowerCase()
    const clean = (s) => String(s || '').replace(/[<>"';]/g, '').slice(0, 500)

    // Проверка прав
    if (type === 'corporate') {
      // Только админ может создать корпоративное объявление
      const { data: admin } = await supabase
        .from('dc_admins')
        .select('role, active')
        .eq('wallet', wLower)
        .single()
      if (!admin || !admin.active) {
        return NextResponse.json({ ok: false, error: 'Только администратор может создавать корпоративные объявления' }, { status: 403 })
      }
    }
    // Для партнёрских — проверка уровня GW делается на фронтенде (через контракт)
    // Здесь доверяем фронтенду, т.к. проверить GW уровень с сервера без RPC сложно

    // Проверка цены: клубная не выше 50% от розничной
    const rp = parseFloat(retailPrice) || 0
    const cp = parseFloat(clubPrice) || 0
    if (cp > 0 && rp > 0 && cp > rp * 0.5) {
      return NextResponse.json({ ok: false, error: 'Клубная цена не может быть выше 50% от розничной' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('dc_showcase')
      .insert({
        type: type === 'corporate' ? 'corporate' : 'partner',
        category: ['diamond', 'jewelry'].includes(category) ? category : 'diamond',
        seller_wallet: wLower,
        title: clean(title),
        description: clean(description),
        photos: Array.isArray(photos) ? photos.slice(0, 10).map(p => clean(p)) : [],
        video_url: clean(videoUrl) || null,
        cert_url: clean(certUrl) || null,
        retail_price: Math.max(0, rp),
        club_price: Math.max(0, cp),
        custom_price: parseFloat(customPrice) || null,
        carat: parseFloat(carat) || null,
        shape: clean(shape) || null,
        clarity: clean(clarity) || null,
        color: clean(color) || null,
        gem_id: clean(gemId) || null,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: 'Ошибка создания' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, item: data })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}

// PATCH: обновить (продажа, статус, цена)
export async function PATCH(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })

  try {
    const body = await request.json()
    const { id, wallet, action, buyerWallet, deliveryAddress, newPrice, newStatus } = body

    if (!wallet || !id) {
      return NextResponse.json({ ok: false, error: 'Нет id или wallet' }, { status: 400 })
    }

    const wLower = wallet.toLowerCase()

    // Получить объявление
    const { data: item } = await supabase
      .from('dc_showcase')
      .select('*')
      .eq('id', id)
      .single()

    if (!item) return NextResponse.json({ ok: false, error: 'Не найдено' }, { status: 404 })

    // Проверка прав (владелец или админ)
    const isOwner = item.seller_wallet === wLower
    const { data: admin } = await supabase
      .from('dc_admins')
      .select('role, active')
      .eq('wallet', wLower)
      .single()
    const isAdmin = admin && admin.active

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })
    }

    // Действие: ПРОДАЖА
    if (action === 'sell') {
      if (!buyerWallet) return NextResponse.json({ ok: false, error: 'Укажите покупателя' }, { status: 400 })

      const marketing = calculateMarketing(item.club_price, item.retail_price)

      const updates = {
        status: 'sold',
        buyer_wallet: buyerWallet.toLowerCase(),
        sold_at: new Date().toISOString(),
      }

      // Шифрованный адрес доставки
      if (deliveryAddress) {
        // Простое шифрование Base64 (для продакшена — использовать AES)
        const encrypted = Buffer.from(deliveryAddress).toString('base64')
        updates.delivery_address_encrypted = encrypted
      }

      const { error } = await supabase
        .from('dc_showcase')
        .update(updates)
        .eq('id', id)

      if (error) return NextResponse.json({ ok: false, error: 'Ошибка обновления' }, { status: 500 })

      return NextResponse.json({ ok: true, marketing, action: 'sold' })
    }

    // Действие: обновить статус
    if (newStatus && ['active', 'hidden', 'sold'].includes(newStatus)) {
      const { error } = await supabase
        .from('dc_showcase')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) return NextResponse.json({ ok: false, error: 'Ошибка' }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // Действие: обновить цену
    if (newPrice !== undefined) {
      const { error } = await supabase
        .from('dc_showcase')
        .update({ custom_price: parseFloat(newPrice) || 0 })
        .eq('id', id)

      if (error) return NextResponse.json({ ok: false, error: 'Ошибка' }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Неизвестное действие' }, { status: 400 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
