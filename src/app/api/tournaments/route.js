/**
 * API Route: /api/tournaments
 *
 * GET — лидерборд за текущий/указанный месяц
 * POST — обновить статистику (вызывается при тапах, покупках, продажах)
 *
 * ИЗМЕНЕНИЯ (25 апр 2026):
 *   • action='tap' — добавлен optimistic lock на dc_tournaments (тот же
 *     механизм что в /api/tap). Параллельные запросы из одного кошелька
 *     больше не задваивают taps_dct: второй UPDATE не пройдёт по WHERE
 *     last_total_nss=<прочитанное значение>, вернёт 0 строк → 429.
 *     Поддерживается случай когда last_total_nss = null (старые записи).
 *
 * ИЗМЕНЕНИЯ (17 апр 2026):
 *   • action='tap' — amount с клиента больше не используется. Сервер сам
 *     считает дельту: (текущий total_nss из dc_taps) − (last_total_nss
 *     из dc_tournaments, записанный при прошлом tap-запросе). Это
 *     защита от накрутки: сколько бы раз клиент ни дёрнул /tournaments,
 *     taps_dct прирастёт только если реально появились новые тапы.
 *     Требуется миграция: добавить колонку last_total_nss в dc_tournaments.
 *
 *   • Админские действия (invite, turnover, gem_sale, jewelry_sale) —
 *     TTL подписи 5 минут (раньше передача TTL была забыта, по факту
 *     админская подпись действовала сутки).
 *
 * Категории:
 *   invites     — кто больше пригласил
 *   turnover    — товарооборот (своя + команда)
 *   taps_dct    — кто натапал больше NSS
 *   max_gem     — самая большая продажа камня
 *   max_jewelry — самая большая продажа изделия
 *
 * Обнуление: 1-го числа каждого месяца (автоматически по month key)
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

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Действия, которые может вызвать только admin (или внутренний сервис)
const ADMIN_ONLY_ACTIONS = ['invite', 'turnover', 'gem_sale', 'jewelry_sale']

// GET: лидерборд
export async function GET(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })

  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || getCurrentMonth()
    const category = searchParams.get('category') || 'invites'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const orderColumn = {
      invites: 'invites',
      turnover: 'turnover',
      taps_dct: 'taps_dct',
      max_gem: 'max_gem_sale',
      max_jewelry: 'max_jewelry_sale',
    }[category] || 'invites'

    const { data, error } = await supabase
      .from('dc_tournaments')
      .select('*')
      .eq('month', month)
      .gt(orderColumn, 0)
      .order(orderColumn, { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({
      ok: true,
      month,
      category,
      leaderboard: data || [],
      currentMonth: getCurrentMonth(),
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка загрузки' }, { status: 500 })
  }
}

// POST: обновить статистику
export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { wallet, action, amount, adminWallet } = body

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
    }

    // Для admin-действий подписывает adminWallet (TTL 5 мин), для tap — wallet (дефолт 24ч)
    const isAdminAction = ADMIN_ONLY_ACTIONS.includes(action)
    const authField = isAdminAction ? 'adminWallet' : 'wallet'
    const verified = await verifyWallet(body, authField, isAdminAction ? ADMIN_TTL_SEC : undefined)
    if (!verified) {
      return NextResponse.json({
        ok: false,
        error: isAdminAction
          ? 'Неверная подпись или срок истёк (5 мин). Переподпишите кошелёк.'
          : 'Неверная подпись кошелька'
      }, { status: 401 })
    }

    const wLower = wallet.toLowerCase()
    const month = getCurrentMonth()

    // ═══ Проверка прав на действие ═══
    if (isAdminAction) {
      if (!adminWallet || !/^0x[a-fA-F0-9]{40}$/.test(adminWallet)) {
        return NextResponse.json({ ok: false, error: 'Требуется adminWallet' }, { status: 403 })
      }
      const aLower = adminWallet.toLowerCase()
      const { data: admin } = await supabase
        .from('dc_admins')
        .select('role, active')
        .eq('wallet', aLower)
        .single()
      if (!admin || !admin.active) {
        return NextResponse.json({ ok: false, error: 'Нет прав администратора' }, { status: 403 })
      }
    } else if (action === 'tap') {
      // ─── Логика: дельта вместо клиентского amount + optimistic lock ───
      // Читаем фактический total_nss из серверной тапалки.
      const { data: tapRecord } = await supabase
        .from('dc_taps')
        .select('total_nss')
        .eq('wallet', wLower)
        .single()
      if (!tapRecord) {
        return NextResponse.json({ ok: false, error: 'Нет записи тапов' }, { status: 400 })
      }
      const currentTotal = parseFloat(tapRecord.total_nss || 0)

      // Читаем запись турнира за текущий месяц
      const { data: record } = await supabase
        .from('dc_tournaments')
        .select('taps_dct, last_total_nss')
        .eq('wallet', wLower)
        .eq('month', month)
        .single()

      if (!record) {
        // Первый вход в турнир в этом месяце — ставим snapshot, дельту не засчитываем
        // (иначе вся накопленная за прошлые месяцы сумма "всплыла" бы в текущем)
        const { error } = await supabase
          .from('dc_tournaments')
          .insert({
            wallet: wLower,
            month,
            taps_dct: 0,
            last_total_nss: currentTotal,
          })
        if (error) {
          // Возможно, параллельный запрос успел вставить запись первым
          // (unique constraint на wallet+month). Возвращаем 429 — клиент перешлёт.
          return NextResponse.json({ ok: false, error: 'Concurrent insert, retry', retry: true }, { status: 429 })
        }
        return NextResponse.json({ ok: true, earned: 0, snapshot: currentTotal })
      }

      const lastSnapshot = parseFloat(record.last_total_nss || 0)
      const delta = Math.max(0, currentTotal - lastSnapshot)

      // Даже если delta=0 — обновляем last_total_nss на случай если total_nss уменьшился
      // (сгорание NSS после 180 дней неактивности). Просто не увеличиваем taps_dct.
      const newTapsDct = +(parseFloat(record.taps_dct || 0) + delta).toFixed(4)

      // ─── Optimistic lock ───
      // UPDATE сработает только если last_total_nss в БД ещё равен тому что мы прочитали.
      // При параллельном запросе второй получит count=0 и вернёт 429.
      // Поддерживаем случай null (старые записи до миграции last_total_nss).
      let updateQuery = supabase
        .from('dc_tournaments')
        .update({
          taps_dct: newTapsDct,
          last_total_nss: currentTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('wallet', wLower)
        .eq('month', month)

      if (record.last_total_nss === null || record.last_total_nss === undefined) {
        updateQuery = updateQuery.is('last_total_nss', null)
      } else {
        updateQuery = updateQuery.eq('last_total_nss', record.last_total_nss)
      }

      const { data: updated, error: updErr } = await updateQuery.select()

      if (updErr) throw updErr
      if (!updated || updated.length === 0) {
        // Параллельный запрос обновил last_total_nss до нас.
        // Возвращаем 429 — клиент может попробовать снова или просто пропустить.
        return NextResponse.json({
          ok: false,
          error: 'Concurrent tournament update rejected',
          retry: true,
        }, { status: 429 })
      }

      return NextResponse.json({ ok: true, earned: delta, total: newTapsDct })
    } else {
      return NextResponse.json({ ok: false, error: 'Неизвестное действие' }, { status: 400 })
    }

    // ─── Ниже — только admin actions (invite, turnover, gem_sale, jewelry_sale) ───

    // Получить или создать запись
    let { data: record } = await supabase
      .from('dc_tournaments')
      .select('*')
      .eq('wallet', wLower)
      .eq('month', month)
      .single()

    if (!record) {
      const { data: newRecord, error } = await supabase
        .from('dc_tournaments')
        .insert({ wallet: wLower, month })
        .select()
        .single()
      if (error) throw error
      record = newRecord
    }

    // Обновить по действию
    const updates = { updated_at: new Date().toISOString() }
    const val = parseFloat(amount) || 0

    switch (action) {
      case 'invite':
        updates.invites = (record.invites || 0) + 1
        break
      case 'turnover':
        updates.turnover = +(parseFloat(record.turnover || 0) + val).toFixed(2)
        break
      case 'gem_sale':
        if (val > parseFloat(record.max_gem_sale || 0)) updates.max_gem_sale = val
        break
      case 'jewelry_sale':
        if (val > parseFloat(record.max_jewelry_sale || 0)) updates.max_jewelry_sale = val
        break
      default:
        return NextResponse.json({ ok: false, error: 'Неизвестное действие' }, { status: 400 })
    }

    const { error } = await supabase
      .from('dc_tournaments')
      .update(updates)
      .eq('wallet', wLower)
      .eq('month', month)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
