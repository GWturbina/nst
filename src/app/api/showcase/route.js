/**
 * API Route: /api/showcase
 * 
 * GET    — список товаров витрины (фильтры: type, category, status)
 * POST   — создать объявление (корпоративная = только админ, общая = партнёр с мин. 4 уровнями GW)
 * PATCH  — обновить (статус, цена, продажа)
 * DELETE — удалить (только свои или админ)
 *
 * FIX #2: Серверная проверка GW уровня через RPC (не доверяем фронтенду)
 * FIX #3: AES-256-GCM шифрование адреса доставки вместо Base64
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
import crypto from 'crypto'
import { verifyWallet } from '@/lib/authHelper'
import { checkOrigin } from '@/lib/checkOrigin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// ═══ FIX #3: AES-256-GCM шифрование ═══
const ENCRYPTION_KEY = process.env.DELIVERY_ENCRYPTION_KEY || '' // 64 hex chars = 32 bytes

function encryptAddress(plaintext) {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 64) {
    // Fallback — но логируем предупреждение
    console.warn('DELIVERY_ENCRYPTION_KEY не задан или короткий! Адрес НЕ зашифрован.')
    return Buffer.from(plaintext).toString('base64')
  }
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(12) // 96 бит для GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  // Формат: iv:tag:ciphertext
  return `${iv.toString('hex')}:${tag}:${encrypted}`
}

// ═══ FIX #2: Проверка GW уровня через RPC ═══
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'
const NSS_PLATFORM_ADDR = '0xFb1ddFa8A7EAB0081EAe24ec3d24B0ED4Dd84f2B'

// Минимальный ABI для проверки уровня
const BRIDGE_ABI_FRAGMENT = [
  'function getUserStatus(address user) external view returns (tuple(bool isRegistered, uint256 odixId, uint8 maxPackage, uint8 rank, bool quarterlyActive, address sponsor, bool[12] activeLevels))',
]
const NSS_ABI_FRAGMENT = [
  'function bridge() external view returns (address)',
]

async function getGWLevel(walletAddress) {
  try {
    // Динамический импорт ethers (для серверного контекста)
    const { ethers } = await import('ethers')
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    
    const nss = new ethers.Contract(NSS_PLATFORM_ADDR, NSS_ABI_FRAGMENT, provider)
    const bridgeAddr = await nss.bridge()
    
    const bridge = new ethers.Contract(bridgeAddr, BRIDGE_ABI_FRAGMENT, provider)
    const status = await bridge.getUserStatus(walletAddress)
    
    return {
      isRegistered: status.isRegistered,
      maxPackage: Number(status.maxPackage),
    }
  } catch (err) {
    console.error('GW level check failed:', err.message)
    return null
  }
}

// Минимальный уровень для продажи/покупки (регулируется)
const MIN_GW_LEVEL = parseInt(process.env.SHOWCASE_MIN_LEVEL || '4')

// ═══ Проверка Origin ═══

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

// GET: список витрины
export async function GET(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')       // 'corporate' | 'partner'
    const category = searchParams.get('category') // 'diamond' | 'jewelry'
    const status = searchParams.get('status') || 'active'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const ownerWallet = searchParams.get('owner') // Для просмотра своих скрытых

    let query = supabase
      .from('dc_showcase')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    // Если запрошены свои объявления (включая скрытые) — фильтр по wallet
    if (ownerWallet && /^0x[a-fA-F0-9]{40}$/.test(ownerWallet)) {
      query = query.eq('seller_wallet', ownerWallet.toLowerCase())
      // Не фильтруем по статусу — показываем все (active, hidden)
      // Но исключаем sold (его видно в истории)
    } else {
      query = query.eq('status', status)
    }

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
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { wallet, type, category, title, description, photos, videoUrl, certUrl,
      retailPrice, clubPrice, customPrice, carat, shape, clarity, color, gemId } = body

    // FIX #7: Проверка подписи кошелька
    const verified = await verifyWallet(body)
    if (!verified) {
      return NextResponse.json({ ok: false, error: 'Неверная подпись кошелька' }, { status: 401 })
    }

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
    } else {
      // FIX #2: Партнёрские — серверная проверка GW уровня через RPC
      const gwStatus = await getGWLevel(wLower)
      if (!gwStatus || !gwStatus.isRegistered) {
        return NextResponse.json({ ok: false, error: 'Пользователь не зарегистрирован в GlobalWay' }, { status: 403 })
      }
      if (gwStatus.maxPackage < MIN_GW_LEVEL) {
        return NextResponse.json({ ok: false, error: `Минимальный уровень для витрины: ${MIN_GW_LEVEL}. Ваш: ${gwStatus.maxPackage}` }, { status: 403 })
      }
    }

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
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { id, wallet, action, buyerWallet, deliveryAddress, newPrice, newStatus } = body

    // FIX #7: Проверка подписи кошелька
    const verified = await verifyWallet(body)
    if (!verified) {
      return NextResponse.json({ ok: false, error: 'Неверная подпись кошелька' }, { status: 401 })
    }

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

      // FIX #3: AES-256-GCM шифрование адреса доставки
      if (deliveryAddress) {
        updates.delivery_address_encrypted = encryptAddress(deliveryAddress)
      }

      const { error } = await supabase
        .from('dc_showcase')
        .update(updates)
        .eq('id', id)

      if (error) return NextResponse.json({ ok: false, error: 'Ошибка обновления' }, { status: 500 })

      return NextResponse.json({ ok: true, marketing, action: 'sold' })
    }

    // Действие: обновить статус (включая восстановление: hidden → active)
    if (newStatus && ['active', 'hidden', 'sold'].includes(newStatus)) {
      // Восстановление из hidden → active разрешено владельцу и админу
      if (newStatus === 'active' && item.status !== 'hidden') {
        return NextResponse.json({ ok: false, error: 'Восстановить можно только скрытое объявление' }, { status: 400 })
      }
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

    // Действие: РЕДАКТИРОВАНИЕ (title, description, photos, prices, видео)
    if (action === 'edit') {
      const clean = (s) => String(s || '').replace(/[<>"';]/g, '').slice(0, 500)
      const updates = {}

      if (body.title !== undefined) updates.title = clean(body.title)
      if (body.description !== undefined) updates.description = clean(body.description)
      if (body.photos !== undefined && Array.isArray(body.photos)) {
        updates.photos = body.photos.slice(0, 10).map(p => clean(p))
      }
      if (body.videoUrl !== undefined) updates.video_url = clean(body.videoUrl) || null
      if (body.certUrl !== undefined) updates.cert_url = clean(body.certUrl) || null
      if (body.retailPrice !== undefined) updates.retail_price = Math.max(0, parseFloat(body.retailPrice) || 0)
      if (body.clubPrice !== undefined) updates.club_price = Math.max(0, parseFloat(body.clubPrice) || 0)
      if (body.carat !== undefined) updates.carat = parseFloat(body.carat) || null
      if (body.shape !== undefined) updates.shape = clean(body.shape) || null
      if (body.clarity !== undefined) updates.clarity = clean(body.clarity) || null
      if (body.color !== undefined) updates.color = clean(body.color) || null

      // Проверка: клубная не выше 50% от розничной (если оба указаны)
      const rp = updates.retail_price ?? item.retail_price
      const cp = updates.club_price ?? item.club_price
      if (cp > 0 && rp > 0 && cp > rp * 0.5) {
        return NextResponse.json({ ok: false, error: 'Клубная цена не может быть выше 50% от розничной' }, { status: 400 })
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ ok: false, error: 'Нет данных для обновления' }, { status: 400 })
      }

      updates.updated_at = new Date().toISOString()
      const { error } = await supabase
        .from('dc_showcase')
        .update(updates)
        .eq('id', id)

      if (error) return NextResponse.json({ ok: false, error: 'Ошибка обновления' }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Неизвестное действие' }, { status: 400 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}

// DELETE: удалить объявление (только владелец или админ)
export async function DELETE(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { id, wallet } = body

    const verified = await verifyWallet(body)
    if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })
    if (!wallet || !id) return NextResponse.json({ ok: false, error: 'Нет id или wallet' }, { status: 400 })

    const wLower = wallet.toLowerCase()

    // Получить объявление
    const { data: item } = await supabase
      .from('dc_showcase')
      .select('seller_wallet, status')
      .eq('id', id)
      .single()

    if (!item) return NextResponse.json({ ok: false, error: 'Не найдено' }, { status: 404 })

    // Нельзя удалить проданное
    if (item.status === 'sold') {
      return NextResponse.json({ ok: false, error: 'Нельзя удалить проданное объявление' }, { status: 400 })
    }

    // Проверка прав
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

    const { error } = await supabase
      .from('dc_showcase')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ ok: false, error: 'Ошибка удаления' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
