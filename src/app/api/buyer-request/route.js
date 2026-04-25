/**
 * API Route: /api/buyer-request
 *
 * POST (без auth) — приём заявки с публичного лендинга /show/[id]
 *                  Защищён rate-limit по IP (3 заявки в минуту с одного IP)
 *                  + honeypot/timing защитой от ботов (тихий reject)
 *
 * POST {action: 'list'} (с auth) — партнёр читает свои заявки
 * POST {action: 'update_status'} (с auth) — партнёр меняет статус своей заявки
 *
 * ИЗМЕНЕНИЯ (25 апр 2026):
 *   • Anti-spam: honeypot поле "website" + timestamp formStartedAt.
 *     - Если honeypot заполнен → тихий reject (без записи в БД)
 *     - Если форма заполнена быстрее 3 сек → тихий reject
 *     - Если форма старше 24 часов (stale) → тихий reject
 *     При тихом reject возвращается 200 OK с фейковым requestId, чтобы
 *     бот не палил защиту. Все срабатывания логируются в console.
 *     Совместимо со старыми клиентами (поля опциональные).
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

const RATE_LIMIT_WINDOW_SEC = 60
const RATE_LIMIT_MAX = 3

// ═══ Anti-spam параметры ═══
const HONEYPOT_FIELD = 'website' // имя скрытого поля в форме
const MIN_FORM_AGE_SEC = 3       // минимум 3 секунды на заполнение (человек не успеет быстрее)
const MAX_FORM_AGE_SEC = 86400   // максимум 24 часа (защита от stale forms)

function normalizeGwId(raw) {
  if (!raw) return null
  const clean = String(raw).replace(/[^\w]/g, '').slice(0, 20).toUpperCase()
  const digits = clean.replace(/^GW/, '')
  if (!digits || !/^\d+$/.test(digits)) return null
  return 'GW' + digits
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex').slice(0, 32)
}

const clean = (s) => String(s || '').replace(/[<>"';]/g, '').trim().slice(0, 500)

const VALID_STATUSES = ['new', 'contacted', 'agreed', 'completed', 'cancelled']

/**
 * Сгенерировать фейковый requestId для тихого reject — выглядит как настоящий,
 * но в БД ничего не записано. Бот думает что прошло, не учится обходить.
 */
function fakeRequestId() {
  return 'r_' + crypto.randomBytes(4).toString('hex')
}

/**
 * Проверка anti-spam: honeypot + timing.
 * @returns {string|null} причина отклонения или null если OK
 */
function checkAntiSpam(body) {
  // 1. Honeypot — должен быть пустой или отсутствовать
  const hp = body[HONEYPOT_FIELD]
  if (hp !== undefined && hp !== null && String(hp).trim().length > 0) {
    return `honeypot filled: "${String(hp).slice(0, 30)}"`
  }

  // 2. Timing — если formStartedAt передан, проверяем разумные границы
  if (body.formStartedAt !== undefined && body.formStartedAt !== null) {
    const startedMs = parseInt(body.formStartedAt)
    if (isNaN(startedMs) || startedMs < 1) {
      return 'invalid formStartedAt'
    }
    const nowMs = Date.now()
    const ageSec = (nowMs - startedMs) / 1000
    // Будущее (clock-skew) — ОК если расхождение < 60 сек
    if (ageSec < -60) {
      return `formStartedAt in future: ${ageSec.toFixed(1)} sec`
    }
    if (ageSec < MIN_FORM_AGE_SEC) {
      return `form too fast: ${ageSec.toFixed(1)} sec`
    }
    if (ageSec > MAX_FORM_AGE_SEC) {
      return `form stale: ${ageSec.toFixed(1)} sec`
    }
  }

  return null
}

// ═══ POST — разные действия по полю action ═══
export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })

  try {
    const body = await request.json()
    const action = body?.action || 'submit'

    // ─── SUBMIT — публичная отправка заявки с лендинга ───
    if (action === 'submit') {
      // Origin check (не пропускаем запросы с чужих сайтов)
      if (!checkOrigin(request)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
      }

      // ─── Anti-spam: тихий reject ───
      const spamReason = checkAntiSpam(body)
      if (spamReason) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                   || request.headers.get('x-real-ip')
                   || 'unknown'
        const ua = (request.headers.get('user-agent') || '').slice(0, 100)
        console.warn(`[buyer-request anti-spam] reason="${spamReason}" ip=${hashIp(ip)} ua="${ua}"`)
        // Возвращаем 200 OK с фейковым ID — бот не учится обходить
        return NextResponse.json({ ok: true, requestId: fakeRequestId() })
      }

      const { itemId, partnerGwId, partnerWallet, listingId,
              name, messenger, contact, note, offeredPrice } = body

      // Обязательные поля
      if (!itemId || !name || !contact) {
        return NextResponse.json({ ok: false, error: 'Заполните имя и контакт' }, { status: 400 })
      }
      if (String(name).trim().length < 2) {
        return NextResponse.json({ ok: false, error: 'Имя слишком короткое' }, { status: 400 })
      }
      if (String(contact).trim().length < 3) {
        return NextResponse.json({ ok: false, error: 'Контакт слишком короткий' }, { status: 400 })
      }

      // Товар существует и активен
      const { data: item } = await supabase
        .from('dc_showcase')
        .select('id, status')
        .eq('id', parseInt(itemId))
        .single()

      if (!item || item.status !== 'active') {
        return NextResponse.json({ ok: false, error: 'Товар недоступен' }, { status: 404 })
      }

      // IP для rate-limit
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                 || request.headers.get('x-real-ip')
                 || 'unknown'
      const ipHash = hashIp(ip)

      // Rate-limit: 3 заявки в минуту с одного IP
      const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_SEC * 1000).toISOString()
      const { data: recent } = await supabase
        .from('dc_buyer_requests')
        .select('id')
        .eq('ip_hash', ipHash)
        .gte('created_at', cutoff)
        .limit(RATE_LIMIT_MAX + 1)

      if (recent && recent.length >= RATE_LIMIT_MAX) {
        return NextResponse.json({
          ok: false,
          error: 'Слишком много заявок. Подождите минуту.'
        }, { status: 429 })
      }

      // Нормализация партнёра
      const partnerGwIdNorm = normalizeGwId(partnerGwId)
      const partnerWalletNorm = (partnerWallet && /^0x[a-fA-F0-9]{40}$/.test(partnerWallet))
        ? partnerWallet.toLowerCase()
        : null

      const userAgent = (request.headers.get('user-agent') || '').slice(0, 200)

      const { data, error } = await supabase
        .from('dc_buyer_requests')
        .insert({
          item_id: parseInt(itemId),
          partner_gw_id: partnerGwIdNorm,
          partner_wallet: partnerWalletNorm,
          listing_id: listingId ? parseInt(listingId) : null,
          buyer_name: clean(name),
          buyer_messenger: clean(messenger).toLowerCase() || null,
          buyer_contact: clean(contact),
          offered_price: offeredPrice ? parseFloat(offeredPrice) : null,
          buyer_note: clean(note) || null,
          ip_hash: ipHash,
          user_agent: userAgent,
          status: 'new',
        })
        .select('id')
        .single()

      if (error) {
        console.error('buyer-request insert error:', error.message)
        return NextResponse.json({ ok: false, error: 'Ошибка сохранения' }, { status: 500 })
      }

      return NextResponse.json({ ok: true, requestId: data.id })
    }

    // ─── LIST — партнёр читает свои заявки ───
    if (action === 'list') {
      const verified = await verifyWallet(body)
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })

      const { wallet } = body
      if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
      }

      const status = body.statusFilter
      const limit = Math.min(parseInt(body.limit) || 50, 200)

      let query = supabase
        .from('dc_buyer_requests')
        .select('*')
        .eq('partner_wallet', wallet.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(limit)

      if (status && VALID_STATUSES.includes(status)) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error

      // Счётчики по статусам
      const { data: allForCounts } = await supabase
        .from('dc_buyer_requests')
        .select('status')
        .eq('partner_wallet', wallet.toLowerCase())

      const counts = { total: 0, new: 0, contacted: 0, agreed: 0, completed: 0, cancelled: 0 }
      for (const r of (allForCounts || [])) {
        counts.total++
        if (counts[r.status] !== undefined) counts[r.status]++
      }

      return NextResponse.json({ ok: true, requests: data || [], counts })
    }

    // ─── UPDATE_STATUS — партнёр меняет статус своей заявки ───
    if (action === 'update_status') {
      const verified = await verifyWallet(body)
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })

      const { wallet, requestId, newStatus } = body
      if (!wallet || !requestId || !newStatus) {
        return NextResponse.json({ ok: false, error: 'Нет wallet, requestId или newStatus' }, { status: 400 })
      }
      if (!VALID_STATUSES.includes(newStatus)) {
        return NextResponse.json({ ok: false, error: 'Неверный статус' }, { status: 400 })
      }

      // Проверка что заявка принадлежит этому партнёру
      const { data: req } = await supabase
        .from('dc_buyer_requests')
        .select('partner_wallet')
        .eq('id', parseInt(requestId))
        .single()

      if (!req || req.partner_wallet !== wallet.toLowerCase()) {
        return NextResponse.json({ ok: false, error: 'Заявка не ваша' }, { status: 403 })
      }

      const { error } = await supabase
        .from('dc_buyer_requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', parseInt(requestId))

      if (error) return NextResponse.json({ ok: false, error: 'Ошибка обновления' }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Неизвестное действие' }, { status: 400 })
  } catch (err) {
    console.error('buyer-request POST crash:', err)
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
