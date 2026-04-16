/**
 * API Route: /api/prices
 * GET  — получить все цены (публичное)
 * POST — обновить цены (только админ, TTL подписи 5 минут)
 *
 * ИЗМЕНЕНИЯ (Пакет 3):
 *   • POST — TTL подписи админа 5 минут
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyWallet } from '@/lib/authHelper'
import { checkOrigin } from '@/lib/checkOrigin'

const ADMIN_TTL_SEC = 300 // 5 минут для админских действий

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// ═══ Фиксированные клубные цены (defaults) ═══
const DEFAULT_PRICES = {
  club_standard: {
    '0.30': { noCert: 300,  cert: 600 },
    '0.50': { noCert: 500,  cert: 1100 },
    '1.00': { noCert: 1000, cert: 1900 },
    '1.50': { noCert: 1600, cert: 3600 },
    '2.00': { noCert: 2800, cert: 4900 },
    '2.50': { noCert: 4500, cert: 8500 },
    '3.00': { noCert: 8500, cert: 15000 },
  },
  club_premium: {
    '0.30': { noCert: 325,  cert: 650 },
    '0.50': { noCert: 550,  cert: 1200 },
    '1.00': { noCert: 1100, cert: 2000 },
    '1.50': { noCert: 1800, cert: 3900 },
    '2.00': { noCert: 3100, cert: 5400 },
    '2.50': { noCert: 5000, cert: 9000 },
    '3.00': { noCert: 9000, cert: 16000 },
  },
}

// GET: вернуть цены
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ ok: true, prices: DEFAULT_PRICES, source: 'defaults' })
  }

  try {
    const { data, error } = await supabase
      .from('dc_prices')
      .select('key, data, updated_at')

    if (error || !data || data.length === 0) {
      return NextResponse.json({ ok: true, prices: DEFAULT_PRICES, source: 'defaults' })
    }

    const prices = { ...DEFAULT_PRICES }
    for (const row of data) {
      prices[row.key] = row.data
    }

    return NextResponse.json({ ok: true, prices, source: 'supabase' })
  } catch {
    return NextResponse.json({ ok: true, prices: DEFAULT_PRICES, source: 'defaults' })
  }
}

// POST: обновить цены (только админ, TTL 5 мин)
export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { key, data, adminWallet } = body

    // Пакет 3: TTL 5 минут для админа
    const verified = await verifyWallet(body, 'adminWallet', ADMIN_TTL_SEC)
    if (!verified) {
      return NextResponse.json({ ok: false, error: 'Неверная подпись или срок истёк (5 мин). Переподпишите кошелёк.' }, { status: 401 })
    }

    if (!adminWallet || !/^0x[a-fA-F0-9]{40}$/.test(adminWallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
    }
    if (!key || !data) {
      return NextResponse.json({ ok: false, error: 'Нет key или data' }, { status: 400 })
    }

    // Проверка что это админ
    const { data: admin } = await supabase
      .from('dc_admins')
      .select('role, active')
      .eq('wallet', adminWallet.toLowerCase())
      .single()

    if (!admin || !admin.active || admin.role === 'operator') {
      return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })
    }

    // Upsert цены
    const { error } = await supabase
      .from('dc_prices')
      .upsert({
        key,
        data,
        updated_by: adminWallet.toLowerCase(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    if (error) {
      return NextResponse.json({ ok: false, error: 'Ошибка сохранения' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
