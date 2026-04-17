/**
 * API Route: /api/lots
 *
 * GET    — список лотов (публичный)
 * POST   — создать лот (только админ, TTL 5 мин)
 * PATCH  — record_purchase (юзер, TTL 1 час), reserve/gift/set_winner/cancel/link_contract (админ, TTL 5 мин)
 *
 * ИЗМЕНЕНИЯ (17 апр 2026):
 *   • record_purchase теперь проверяет транзакцию on-chain через verifyClubLotsPurchase
 *     (раньше принимал любой валидный по формату txHash на слово)
 *   • record_purchase использует атомарную SQL-функцию record_lot_purchase
 *     вместо двух раздельных INSERT + UPDATE (защита от race condition)
 *
 * ИЗМЕНЕНИЯ (Пакет 3):
 *   • Все админские действия требуют TTL подписи 5 минут
 *   • record_purchase (пользовательская покупка) — дефолт 1 час
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyWallet } from '@/lib/authHelper'
import { checkOrigin } from '@/lib/checkOrigin'
import { verifyClubLotsPurchase } from '@/lib/verifyPurchase'

const ADMIN_TTL_SEC = 300 // 5 минут для админских действий

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null


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
    const detail = searchParams.get('detail')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    let query = supabase
      .from('dc_lots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') query = query.eq('status', status)

    const { data: lots, error } = await query
    if (error) throw error

    let myShares = {}
    let myPurchases = []

    if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      const walletLower = wallet.toLowerCase()

      const { data: shares } = await supabase
        .from('dc_lot_shares')
        .select('lot_id, shares_count')
        .eq('wallet', walletLower)
        .eq('is_reserved', false)

      if (shares) {
        for (const s of shares) {
          myShares[s.lot_id] = (myShares[s.lot_id] || 0) + s.shares_count
        }
      }

      if (detail === 'purchases') {
        const { data: purchaseRecords } = await supabase
          .from('dc_lot_shares')
          .select('id, lot_id, shares_count, usdt_amount, tx_hash, is_gift, is_reserved, confirmed, created_at')
          .eq('wallet', walletLower)
          .eq('is_reserved', false)
          .order('created_at', { ascending: false })

        if (purchaseRecords && lots) {
          const lotsMap = {}
          for (const l of lots) lotsMap[l.id] = l

          myPurchases = purchaseRecords.map(p => {
            const lot = lotsMap[p.lot_id]
            return {
              purchaseId: p.id,
              lotId: p.lot_id,
              sharesCount: p.shares_count,
              usdtAmount: p.usdt_amount,
              txHash: p.tx_hash,
              isGift: p.is_gift,
              confirmed: p.confirmed,
              purchaseDate: p.created_at,
              lotTitle: lot?.title || `Лот #${p.lot_id}`,
              lotStatus: lot?.status || 'unknown',
              gemType: lot?.gem_type,
              shape: lot?.shape,
              clarity: lot?.clarity,
              color: lot?.color,
              carats: lot?.carats,
              hasCert: lot?.has_cert,
              sharePrice: lot?.share_price,
              totalShares: lot?.total_shares || 0,
              soldShares: lot?.sold_shares || 0,
              winnerWallet: lot?.winner_wallet,
              unlockAt: lot?.unlock_at,
              ownershipPct: lot?.total_shares
                ? +(p.shares_count / lot.total_shares * 100).toFixed(2)
                : 0,
              isWinner: lot?.winner_wallet
                ? lot.winner_wallet.toLowerCase() === walletLower
                : false,
            }
          })
        }
      }
    }

    return NextResponse.json({ ok: true, lots: lots || [], myShares, myPurchases })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка загрузки' }, { status: 500 })
  }
}

// ═══ POST: Создать лот (только админ, TTL 5 мин) ═══
export async function POST(request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'Сервер не настроен' }, { status: 503 })
  if (!checkOrigin(request)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    // Пакет 3: TTL 5 минут
    const verified = await verifyWallet(body, 'adminWallet', ADMIN_TTL_SEC)
    if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись или срок истёк (5 мин)' }, { status: 401 })

    const { adminWallet, title, description, photoUrl, gemType, shape, clarity, color,
      carats, hasCert, gemCost, sharePrice, minGwLevel, lockDays, adminCommit } = body

    if (!(await isAdmin(adminWallet))) {
      return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })
    }

    const gc = num(gemCost, 10, 10000000)
    const sp = num(sharePrice)
    if (![25, 50, 100].includes(sp)) {
      return NextResponse.json({ ok: false, error: 'Цена доли: $25, $50 или $100' }, { status: 400 })
    }
    if (!title) return NextResponse.json({ ok: false, error: 'Укажите название' }, { status: 400 })

    const lotPrice = Math.round(gc * 100 / 80 * 100) / 100
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

    // ═══ RECORD_PURCHASE — пользователь записывает свою покупку (TTL 1 час) ═══
    // Обновлено 17 апр 2026:
    //   1) проверка транзакции on-chain через verifyClubLotsPurchase
    //   2) атомарная запись через SQL-функцию record_lot_purchase
    if (action === 'record_purchase') {
      const verified = await verifyWallet(body)
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись' }, { status: 401 })

      const { wallet, lotId, sharesCount, usdtAmount, txHash } = body

      // Базовая валидация
      if (!lotId || !sharesCount) {
        return NextResponse.json({ ok: false, error: 'Нет данных' }, { status: 400 })
      }
      if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return NextResponse.json({ ok: false, error: 'Неверный кошелёк' }, { status: 400 })
      }
      if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return NextResponse.json({ ok: false, error: 'Неверный txHash' }, { status: 400 })
      }

      const wLower = wallet.toLowerCase()
      const cnt = Math.max(1, Math.min(100, parseInt(sharesCount) || 1))

      // Получаем contract_lot_id — нужен для проверки события в блокчейне
      const { data: lot } = await supabase
        .from('dc_lots')
        .select('contract_lot_id, status')
        .eq('id', lotId)
        .single()

      if (!lot) {
        return NextResponse.json({ ok: false, error: 'Лот не найден' }, { status: 404 })
      }
      if (lot.status !== 'active') {
        return NextResponse.json({ ok: false, error: 'Лот не активен' }, { status: 400 })
      }
      if (lot.contract_lot_id === null || lot.contract_lot_id === undefined) {
        return NextResponse.json({
          ok: false,
          error: 'Лот ещё не привязан к контракту — покупка невозможна'
        }, { status: 400 })
      }

      // ─── Проверка транзакции в блокчейне ───
      const check = await verifyClubLotsPurchase({
        txHash,
        buyerWallet: wLower,
        contractLotId: lot.contract_lot_id,
        expectedCount: cnt,
      })

      if (!check.ok) {
        return NextResponse.json({
          ok: false,
          error: check.error || 'Проверка транзакции не прошла'
        }, { status: 400 })
      }

      // ─── Атомарная запись через SQL-функцию ───
      // Защита от дубля tx_hash и от race condition — внутри функции.
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('record_lot_purchase', {
        p_lot_id:       parseInt(lotId),
        p_wallet:       wLower,
        p_shares_count: cnt,
        p_usdt_amount:  num(usdtAmount),
        p_tx_hash:      clean(txHash),
      })

      if (rpcErr) {
        console.error('record_lot_purchase RPC error:', rpcErr)
        return NextResponse.json({
          ok: false,
          error: 'Ошибка записи (функция БД не доступна — запустите миграцию)'
        }, { status: 500 })
      }

      if (!rpcResult || rpcResult.ok === false) {
        return NextResponse.json({
          ok: false,
          error: rpcResult?.error || 'Ошибка записи'
        }, { status: 400 })
      }

      await addLog(
        parseInt(lotId),
        'SHARE_BOUGHT',
        wLower,
        `${cnt} доля(ей) — $${num(usdtAmount)} tx:${clean(txHash).slice(0,10)} (verified on-chain)`
      )

      return NextResponse.json({
        ok: true,
        shareId: rpcResult.share_id,
        newStatus: rpcResult.new_status,
      })
    }

    // ═══ RESERVE — админ резервирует (TTL 5 мин) ═══
    if (action === 'reserve') {
      const verified = await verifyWallet(body, 'adminWallet', ADMIN_TTL_SEC)
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись или срок истёк (5 мин)' }, { status: 401 })

      const { adminWallet, lotId, count } = body
      if (!(await isAdmin(adminWallet))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })

      const cnt = Math.max(1, Math.min(20, parseInt(count) || 1))

      const { data: lot } = await supabase.from('dc_lots').select('*').eq('id', lotId).single()
      if (!lot || lot.status !== 'active') return NextResponse.json({ ok: false, error: 'Лот не активен' }, { status: 400 })

      const available = lot.total_shares - lot.sold_shares - lot.reserved_shares
      if (cnt > available) return NextResponse.json({ ok: false, error: `Доступно только ${available} долей` }, { status: 400 })

      await supabase.from('dc_lots').update({ reserved_shares: lot.reserved_shares + cnt }).eq('id', lotId)

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

    // ═══ GIFT — админ дарит (TTL 5 мин) ═══
    if (action === 'gift') {
      const verified = await verifyWallet(body, 'adminWallet', ADMIN_TTL_SEC)
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись или срок истёк (5 мин)' }, { status: 401 })

      const { adminWallet, lotId, recipientWallet, count } = body
      if (!(await isAdmin(adminWallet))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })
      if (!recipientWallet || !/^0x[a-fA-F0-9]{40}$/.test(recipientWallet)) {
        return NextResponse.json({ ok: false, error: 'Неверный кошелёк получателя' }, { status: 400 })
      }

      const cnt = Math.max(1, Math.min(10, parseInt(count) || 1))
      const rLower = recipientWallet.toLowerCase()

      const { data: lot } = await supabase.from('dc_lots').select('share_price').eq('id', lotId).single()
      await supabase.from('dc_lot_shares').insert({
        lot_id: lotId,
        wallet: rLower,
        shares_count: cnt,
        usdt_amount: (lot?.share_price || 0) * cnt,
        is_gift: true,
      })

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

    // ═══ SET_WINNER — админ назначает победителя (TTL 5 мин) ═══
    if (action === 'set_winner') {
      const verified = await verifyWallet(body, 'adminWallet', ADMIN_TTL_SEC)
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись или срок истёк (5 мин)' }, { status: 401 })

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

    // ═══ CANCEL — админ отменяет (TTL 5 мин) ═══
    if (action === 'cancel') {
      const verified = await verifyWallet(body, 'adminWallet', ADMIN_TTL_SEC)
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись или срок истёк (5 мин)' }, { status: 401 })

      const { adminWallet, lotId } = body
      if (!(await isAdmin(adminWallet))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })

      await supabase.from('dc_lots').update({ status: 'cancelled' }).eq('id', lotId)
      await addLog(lotId, 'CANCELLED', adminWallet)
      return NextResponse.json({ ok: true })
    }

    // ═══ LINK_CONTRACT — админ привязывает контракт (TTL 5 мин) ═══
    if (action === 'link_contract') {
      const verified = await verifyWallet(body, 'adminWallet', ADMIN_TTL_SEC)
      if (!verified) return NextResponse.json({ ok: false, error: 'Неверная подпись или срок истёк (5 мин)' }, { status: 401 })

      const { adminWallet, lotId, contractLotId, contractTxHash } = body
      if (!(await isAdmin(adminWallet))) return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 })

      if (contractLotId === undefined || contractLotId === null) {
        return NextResponse.json({ ok: false, error: 'Не указан ID лота в контракте' }, { status: 400 })
      }

      const { data: existing } = await supabase
        .from('dc_lots')
        .select('id')
        .eq('contract_lot_id', parseInt(contractLotId))
        .limit(1)
      if (existing && existing.length > 0 && existing[0].id !== lotId) {
        return NextResponse.json({ ok: false, error: `Contract lot #${contractLotId} уже привязан к лоту #${existing[0].id}` }, { status: 409 })
      }

      const updates = {
        contract_lot_id: parseInt(contractLotId),
      }
      if (contractTxHash) updates.contract_tx_hash = clean(contractTxHash)

      await supabase.from('dc_lots').update(updates).eq('id', lotId)
      await addLog(lotId, 'LINKED_CONTRACT', adminWallet, `contract_lot_id=${contractLotId} tx:${clean(contractTxHash || '').slice(0, 10)}`)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Неизвестное действие' }, { status: 400 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
