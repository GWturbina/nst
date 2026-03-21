/**
 * API Route: /api/level-content
 * GET  — получить тексты всех уровней (публичное)
 * POST — обновить тексты уровня (только админ)
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyWallet } from '@/lib/authHelper'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// GET: вернуть тексты всех уровней
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ ok: true, levels: [], source: 'none' })
  }

  try {
    const { data, error } = await supabase
      .from('dc_level_texts')
      .select('level, thoughts, description')
      .order('level', { ascending: true })

    if (error) throw error

    return NextResponse.json({ ok: true, levels: data || [] })
  } catch {
    return NextResponse.json({ ok: true, levels: [] })
  }
}

// POST: обновить тексты уровня (только админ)
export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })

  try {
    const body = await request.json()
    const { wallet, level, thoughts, description } = body

    // Проверка подписи
    const verified = await verifyWallet(body)
    if (!verified) {
      return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })
    }

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
    }

    if (level === undefined || level < 0 || level > 12) {
      return NextResponse.json({ ok: false, error: 'Неверный уровень (0-12)' }, { status: 400 })
    }

    // Проверка прав админа
    const { data: admin } = await supabase
      .from('dc_admins')
      .select('role, active')
      .eq('wallet', wallet.toLowerCase())
      .single()

    if (!admin || !admin.active || admin.role === 'operator') {
      return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })
    }

    // Валидация thoughts
    if (!Array.isArray(thoughts)) {
      return NextResponse.json({ ok: false, error: 'thoughts должен быть массивом' }, { status: 400 })
    }

    const cleanThoughts = thoughts
      .map(t => String(t).trim().slice(0, 200))
      .filter(t => t.length > 0)
      .slice(0, 20) // макс 20 текстов на уровень

    const { error } = await supabase
      .from('dc_level_texts')
      .upsert({
        level,
        thoughts: cleanThoughts,
        description: String(description || '').trim().slice(0, 500),
        updated_by: wallet.toLowerCase(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'level' })

    if (error) {
      return NextResponse.json({ ok: false, error: 'Ошибка сохранения' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, count: cleanThoughts.length })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
