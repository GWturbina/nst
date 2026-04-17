/**
 * API Route: /api/partner-listing
 *
 * GET    — получить листинги партнёра (по gwId или wallet)
 * POST   — сохранить/обновить цену партнёра на товар (с подписью)
 * DELETE — деактивировать свой листинг (с подписью)
 *
 * Логика цены:
 *   • Партнёр должен быть зарегистрирован в GlobalWay
 *   • Цена >= clubPrice ИЛИ isNegotiable = true ("договорная")
 *   • Нельзя ниже клубной цены (из dc_showcase.club_price)
 *
 * ИЗМЕНЕНИЯ (17 апр 2026):
 *   • POST теперь серверно проверяет через RPC opBNB, что присланный gwId
 *     действительно принадлежит подписавшему кошельку. Раньше wallet и gwId
 *     принимались по отдельности — партнёр А мог создать листинг с чужим
 *     GW ID партнёра Б (подделка авторства).
 *   • Добавлен checkOrigin в POST и DELETE — общий барьер для CSRF.
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyWallet } from '@/lib/authHelper'
import { checkOrigin } from '@/lib/checkOrigin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// ═══ Проверка gwId ↔ wallet через контракт GlobalWay (как в /api/showcase) ═══
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'
const NSS_PLATFORM_ADDR = '0xFb1ddFa8A7EAB0081EAe24ec3d24B0ED4Dd84f2B'

const BRIDGE_ABI_FRAGMENT = [
  'function getUserStatus(address user) external view returns (tuple(bool isRegistered, uint256 odixId, uint8 maxPackage, uint8 rank, bool quarterlyActive, address sponsor, bool[12] activeLevels))',
]
const NSS_ABI_FRAGMENT = [
  'function bridge() external view returns (address)',
]

async function getGWStatus(walletAddress) {
  try {
    const { ethers } = await import('ethers')
    const provider = new ethers.JsonRpcProvider(RPC_URL)

    const nss = new ethers.Contract(NSS_PLATFORM_ADDR, NSS_ABI_FRAGMENT, provider)
    const bridgeAddr = await nss.bridge()

    const bridge = new ethers.Contract(bridgeAddr, BRIDGE_ABI_FRAGMENT, provider)
    const status = await bridge.getUserStatus(walletAddress)

    return {
      isRegistered: Boolean(status.isRegistered),
      odixId: Number(status.odixId),
      maxPackage: Number(status.maxPackage),
    }
  } catch (err) {
    console.error('getGWStatus failed:', err?.message || err)
    return null
  }
}

// Нормализация GW ID к формату "GW9729645"
function normalizeGwId(raw) {
  if (!raw) return null
  const clean = String(raw).replace(/[^\w]/g, '').slice(0, 20).toUpperCase()
  const digits = clean.replace(/^GW/, '')
  if (!digits || !/^\d+$/.test(digits)) return null
  return 'GW' + digits
}

// ═══ GET: мои листинги или по товару ═══
export async function GET(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })

  try {
    const { searchParams } = new URL(request.url)
    const gwId = searchParams.get('gwId')
    const itemId = searchParams.get('itemId')
    const wallet = searchParams.get('wallet')
    const activeOnly = searchParams.get('active') !== 'false'

    let query = supabase.from('dc_partner_listings').select('*')

    if (activeOnly) query = query.eq('is_active', true)
    if (gwId) {
      const normalized = normalizeGwId(gwId)
      if (normalized) query = query.eq('gw_id', normalized)
    }
    if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      query = query.eq('wallet', wallet.toLowerCase())
    }
    if (itemId) query = query.eq('item_id', parseInt(itemId))

    const { data, error } = await query.order('updated_at', { ascending: false }).limit(100)
    if (error) throw error

    return NextResponse.json({ ok: true, listings: data || [] })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка загрузки' }, { status: 500 })
  }
}

// ═══ POST: сохранить/обновить цену (партнёр) ═══
export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()

    // Подпись пользователя — дефолт 1 час (по факту 24ч пока дефолт таков)
    const verified = await verifyWallet(body)
    if (!verified) {
      return NextResponse.json({ ok: false, error: 'Неверная подпись кошелька' }, { status: 401 })
    }

    const { wallet, gwId, itemId, price, isNegotiable, isActive } = body

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
    }

    const wLower = wallet.toLowerCase()

    const gwIdNorm = normalizeGwId(gwId)
    if (!gwIdNorm) {
      return NextResponse.json({ ok: false, error: 'Неверный GW ID' }, { status: 400 })
    }

    if (!itemId) {
      return NextResponse.json({ ok: false, error: 'Нет itemId' }, { status: 400 })
    }

    // ─── Серверная проверка: gwId действительно принадлежит wallet ───
    const gwStatus = await getGWStatus(wLower)
    if (!gwStatus) {
      return NextResponse.json({
        ok: false,
        error: 'Не удалось проверить регистрацию в GlobalWay (RPC недоступен)'
      }, { status: 503 })
    }
    if (!gwStatus.isRegistered || !gwStatus.odixId) {
      return NextResponse.json({
        ok: false,
        error: 'Кошелёк не зарегистрирован в GlobalWay'
      }, { status: 403 })
    }
    const realGwId = 'GW' + String(gwStatus.odixId)
    if (realGwId !== gwIdNorm) {
      return NextResponse.json({
        ok: false,
        error: `Указанный GW ID (${gwIdNorm}) не совпадает с вашим реальным (${realGwId})`
      }, { status: 403 })
    }

    // Проверка что товар существует и активен
    const { data: item } = await supabase
      .from('dc_showcase')
      .select('id, club_price, retail_price, status')
      .eq('id', parseInt(itemId))
      .single()

    if (!item) {
      return NextResponse.json({ ok: false, error: 'Товар не найден' }, { status: 404 })
    }
    if (item.status !== 'active') {
      return NextResponse.json({ ok: false, error: 'Товар не активен' }, { status: 400 })
    }

    // Валидация цены
    let finalPrice = null
    const negotiable = !!isNegotiable

    if (!negotiable) {
      const p = parseFloat(price)
      if (isNaN(p) || p <= 0) {
        return NextResponse.json({ ok: false, error: 'Укажите цену или выберите "Договорная"' }, { status: 400 })
      }
      // Цена не может быть ниже клубной
      if (p < parseFloat(item.club_price || 0)) {
        return NextResponse.json({
          ok: false,
          error: `Цена не может быть ниже клубной ($${item.club_price})`
        }, { status: 400 })
      }
      finalPrice = p
    }

    // Upsert
    const { data, error } = await supabase
      .from('dc_partner_listings')
      .upsert({
        gw_id: gwIdNorm,
        wallet: wLower,
        item_id: parseInt(itemId),
        price: finalPrice,
        is_negotiable: negotiable,
        is_active: isActive !== false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'gw_id,item_id' })
      .select()
      .single()

    if (error) {
      console.error('partner-listing upsert error:', error.message)
      return NextResponse.json({ ok: false, error: 'Ошибка сохранения' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, listing: data })
  } catch (err) {
    console.error('partner-listing POST crash:', err)
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}

// ═══ DELETE: деактивировать свой листинг ═══
export async function DELETE(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const verified = await verifyWallet(body)
    if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })

    const { wallet, listingId } = body
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
    }
    if (!listingId) {
      return NextResponse.json({ ok: false, error: 'Нет listingId' }, { status: 400 })
    }

    const wLower = wallet.toLowerCase()

    // Проверка что листинг принадлежит этому кошельку
    const { data: listing } = await supabase
      .from('dc_partner_listings')
      .select('wallet')
      .eq('id', parseInt(listingId))
      .single()

    if (!listing || listing.wallet !== wLower) {
      return NextResponse.json({ ok: false, error: 'Листинг не ваш' }, { status: 403 })
    }

    const { error } = await supabase
      .from('dc_partner_listings')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', parseInt(listingId))

    if (error) return NextResponse.json({ ok: false, error: 'Ошибка' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
