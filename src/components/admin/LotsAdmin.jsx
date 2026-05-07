'use client'
/**
 * LotsAdmin.jsx — Админка клубных лотов (адаптировано под v2.3)
 * 
 * Создание лотов в Supabase, привязка к контракту ClubPools.
 * 
 * АДАПТАЦИЯ под v2.3:
 * - Импорт: clubLotsContracts → clubV23
 * - createLotOnChain теперь маппит на ClubPools.createPool
 * - Убрана commit-reveal схема (секрет/секретное число) — в v2.3 не используется
 * - Параметр lockDays теперь — fundraisingDays (период сбора в пуле)
 * - Параметр totalShares вычисляется из gem_cost / share_price
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import { authFetch } from '@/lib/authClient'
import * as Club from '@/lib/clubV23'
import { safeCall } from '@/lib/contracts'

export default function LotsAdmin() {
  const { wallet, addNotification } = useGameStore()
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [txPending, setTxPending] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  // Форма создания
  const [form, setForm] = useState({
    title: '', description: '', photoUrl: '', gemType: 'diamond',
    shape: '', clarity: '', color: '', carats: '',
    hasCert: false, gemCost: '', sharePrice: '50', minGwLevel: '4',
    fundraisingDays: '90',  // вместо lockDays — на сколько открыт сбор
  })

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lots?status=all')
      const data = await res.json()
      if (data.ok) setLots(data.lots || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  // ═══ Задеплоить лот в контракт ClubPools и привязать ═══
  const handleDeployToContract = async (lot) => {
    if (!wallet) return
    setTxPending(true)
    try {
      addNotification(`⏳ Создаю пул «${lot.title}» в контракте...`)

      // 1. Создать пул в контракте ClubPools (createLotOnChain → createPool)
      //
      // ВАЖНО: передаём lot.lot_price (= gem_cost / 0.85), а не gem_cost!
      // Контракт автоматически делит каждый платёж 85/5/10, поэтому чтобы
      // в котёл попал gem_cost = $5600 — собрать нужно ВСЕГО $6588.24.
      // Эта сумма и есть target в контракте.
      const targetUSDT = lot.lot_price || lot.gem_cost  // fallback если lot_price не задан
      const result = await safeCall(() =>
        Club.createLotOnChain(
          targetUSDT,             // targetUSDT = lot_price (с учётом 15% маркетинг+реклама)
          lot.share_price,        // декоративная цена доли
          lot.min_gw_level || 7,
          0,
          {
            name: lot.title || `Lot ${lot.id}`,
            fundraisingDays: lot.fundraising_days || lot.lock_days || 90,
          }
        )
      )

      if (!result.ok) {
        addNotification(`❌ Контракт: ${result.error}`)
        setTxPending(false)
        return
      }

      const contractLotId = result.data?.poolId ?? result.data?.lotId
      const txHash = result.data?.receipt?.hash || ''

      if (contractLotId === null || contractLotId === undefined) {
        addNotification(`⚠️ TX прошла (${txHash.slice(0, 10)}...) но poolId не считан. Привяжите вручную.`)
        setTxPending(false)
        return
      }

      // 2. Привязать в Supabase
      const res = await authFetch('/api/lots', {
        method: 'PATCH',
        body: {
          action: 'link_contract',
          adminWallet: wallet,
          lotId: lot.id,
          contractLotId,
          contractTxHash: txHash,
        }
      })
      const data = await res.json()

      if (data.ok) {
        addNotification(`✅ Пул «${lot.title}» задеплоен! Pool #${contractLotId}`)
        reload()
      } else {
        addNotification(`⚠️ Контракт создан (pool #${contractLotId}), но привязка не удалась: ${data.error}`)
      }
    } catch (err) {
      addNotification(`❌ ${err.message || 'Ошибка деплоя'}`)
    }
    setTxPending(false)
  }

  // ═══ Создать лот в Supabase ═══
  const handleCreate = async () => {
    if (!form.title || !form.gemCost) return addNotification('❌ Укажите название и цену камня')

    setTxPending(true)
    try {
      const res = await authFetch('/api/lots', {
        method: 'POST',
        body: {
          adminWallet: wallet,
          ...form,
          gemCost: parseFloat(form.gemCost),
          sharePrice: parseInt(form.sharePrice),
          minGwLevel: parseInt(form.minGwLevel),
          fundraisingDays: parseInt(form.fundraisingDays),
          lockDays: parseInt(form.fundraisingDays),  // совместимость со старым API
        }
      })
      const data = await res.json()
      if (data.ok) {
        addNotification(`✅ Лот «${form.title}» создан! ID: ${data.lot.id}`)
        setShowCreate(false)
        setForm({ title: '', description: '', photoUrl: '', gemType: 'diamond', shape: '', clarity: '', color: '', carats: '', hasCert: false, gemCost: '', sharePrice: '50', minGwLevel: '4', fundraisingDays: '90' })
        reload()
      } else addNotification(`❌ ${data.error}`)
    } catch { addNotification('❌ Ошибка сети') }
    setTxPending(false)
  }

  // ═══ Зарезервировать доли ═══
  const handleReserve = async (lotId, count) => {
    setTxPending(true)
    try {
      const res = await authFetch('/api/lots', {
        method: 'PATCH',
        body: { action: 'reserve', adminWallet: wallet, lotId, count }
      })
      const data = await res.json()
      if (data.ok) { addNotification(`✅ ${count} доля(ей) зарезервировано`); reload() }
      else addNotification(`❌ ${data.error}`)
    } catch { addNotification('❌ Ошибка сети') }
    setTxPending(false)
  }

  // ═══ Подарить долю ═══
  const [giftModal, setGiftModal] = useState(null)
  const [giftWallet, setGiftWallet] = useState('')
  const [giftCount, setGiftCount] = useState(1)

  const handleGift = async () => {
    if (!giftWallet) return
    setTxPending(true)
    try {
      const res = await authFetch('/api/lots', {
        method: 'PATCH',
        body: { action: 'gift', adminWallet: wallet, lotId: giftModal.id, recipientWallet: giftWallet, count: giftCount }
      })
      const data = await res.json()
      if (data.ok) { addNotification(`✅ Подарок отправлен → ${shortAddress(giftWallet)}`); setGiftModal(null); reload() }
      else addNotification(`❌ ${data.error}`)
    } catch { addNotification('❌ Ошибка сети') }
    setTxPending(false)
  }

  // ═══ Отменить лот ═══
  const handleCancel = async (lotId) => {
    setTxPending(true)
    try {
      const res = await authFetch('/api/lots', {
        method: 'PATCH',
        body: { action: 'cancel', adminWallet: wallet, lotId }
      })
      const data = await res.json()
      if (data.ok) { addNotification('✅ Лот отменён'); reload() }
      else addNotification(`❌ ${data.error}`)
    } catch { addNotification('❌ Ошибка сети') }
    setTxPending(false)
  }

  if (loading) return <div className="px-3 mt-2 text-center py-8"><div className="text-2xl animate-spin">🎟</div></div>

  return (
    <div className="space-y-3">
      <div className="text-[12px] font-bold text-gold-400 px-3 mb-1">🎟 Управление лотами (v2.3)</div>

      {/* Кнопка создания */}
      <div className="px-3">
        <button onClick={() => setShowCreate(!showCreate)}
          className="w-full py-3 rounded-2xl text-[12px] font-bold gold-btn">
          {showCreate ? '✕ Закрыть форму' : '✨ Создать новый лот'}
        </button>
      </div>

      {/* Форма создания */}
      {showCreate && (
        <div className="mx-3 p-3 rounded-2xl glass space-y-2">
          <div className="text-[12px] font-bold text-white mb-2">📝 Новый лот</div>

          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Название (Бриллиант 1.5ct)" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[12px] text-white outline-none" />

          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Описание" rows={2} className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />

          <input value={form.photoUrl} onChange={e => setForm({ ...form, photoUrl: e.target.value })}
            placeholder="URL фото" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />

          <div className="grid grid-cols-2 gap-2">
            <input value={form.carats} onChange={e => setForm({ ...form, carats: e.target.value })}
              placeholder="Караты (1.5)" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            <select value={form.shape} onChange={e => setForm({ ...form, shape: e.target.value })}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none">
              <option value="">— Огранка —</option>
              <option value="round">Round</option>
              <option value="princess">Princess</option>
              <option value="cushion">Cushion</option>
              <option value="oval">Oval</option>
              <option value="emerald">Emerald</option>
            </select>
            <input value={form.clarity} onChange={e => setForm({ ...form, clarity: e.target.value })}
              placeholder="Чистота (VS1)" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            <input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
              placeholder="Цвет (D)" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
          </div>

          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={form.hasCert} onChange={e => setForm({ ...form, hasCert: e.target.checked })} />
            Есть сертификат
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-slate-500 mb-1">Стоимость камня (USDT)</div>
              <input type="number" value={form.gemCost} onChange={e => setForm({ ...form, gemCost: e.target.value })}
                placeholder="10000" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 mb-1">Цена доли (USDT)</div>
              <input type="number" value={form.sharePrice} onChange={e => setForm({ ...form, sharePrice: e.target.value })}
                placeholder="50" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 mb-1">Мин. уровень GW</div>
              <input type="number" value={form.minGwLevel} onChange={e => setForm({ ...form, minGwLevel: e.target.value })}
                placeholder="4" min="1" max="12" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 mb-1">Период сбора (дней)</div>
              <input type="number" value={form.fundraisingDays} onChange={e => setForm({ ...form, fundraisingDays: e.target.value })}
                placeholder="90" min="1" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
          </div>

          {form.gemCost && form.sharePrice && (
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300">
              📊 Будет {Math.floor(parseFloat(form.gemCost) / parseFloat(form.sharePrice))} долей по ${form.sharePrice}
            </div>
          )}

          <button onClick={handleCreate} disabled={txPending}
            className="w-full py-3 rounded-2xl text-[12px] font-black gold-btn disabled:opacity-50">
            {txPending ? '⏳...' : '✨ Создать лот'}
          </button>
        </div>
      )}

      {/* Список лотов для управления */}
      <div className="space-y-2">
        {lots.map(lot => (
          <div key={lot.id} className="p-3 rounded-2xl glass">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-bold text-white">#{lot.id} {lot.title}</div>
              <div className="text-[10px] text-slate-500">{lot.status}</div>
            </div>
            <div className="text-[10px] text-slate-400 mb-1">
              ${parseFloat(lot.gem_cost).toLocaleString()} камень | ${lot.share_price} доля | {lot.sold_shares}/{lot.total_shares} продано | Резерв: {lot.reserved_shares || 0}
            </div>

            {/* Статус привязки к контракту */}
            {lot.contract_lot_id !== null && lot.contract_lot_id !== undefined ? (
              <div className="text-[10px] text-emerald-400 font-bold mb-2">
                ✅ Контракт: pool #{lot.contract_lot_id}
                {lot.contract_tx_hash && (
                  <a href={`https://opbnb.bscscan.com/tx/${lot.contract_tx_hash}`} target="_blank" rel="noopener noreferrer"
                    className="ml-1 text-blue-400 underline">tx↗</a>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-amber-400 font-bold mb-2">
                ⚠️ Не привязан к контракту — покупка долей невозможна
              </div>
            )}

            {lot.status === 'active' && (
              <div className="flex gap-1 flex-wrap">
                {/* Деплой в контракт (если ещё не привязан) */}
                {(lot.contract_lot_id === null || lot.contract_lot_id === undefined) && (
                  <button onClick={() => handleDeployToContract(lot)} disabled={txPending}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-gold-400/15 border border-gold-400/25 text-gold-400">
                    🔗 Задеплоить в контракт
                  </button>
                )}
                <button onClick={() => handleReserve(lot.id, 3)} disabled={txPending}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-500/15 border border-blue-500/25 text-blue-400">
                  +3 резерв
                </button>
                <button onClick={() => handleReserve(lot.id, 5)} disabled={txPending}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-500/15 border border-blue-500/25 text-blue-400">
                  +5 резерв
                </button>
                <button onClick={() => { setGiftModal(lot); setGiftWallet(''); setGiftCount(1) }}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                  🎁 Подарить
                </button>
                <button onClick={() => handleCancel(lot.id)} disabled={txPending}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/15 border border-red-500/25 text-red-400">
                  ✕ Отмена
                </button>
              </div>
            )}

            {lot.winner_wallet && (
              <div className="text-[10px] text-emerald-400 mt-1">🏆 {shortAddress(lot.winner_wallet)}</div>
            )}
          </div>
        ))}
      </div>

      {/* Модал подарка */}
      {giftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="max-w-[360px] w-full p-5 rounded-3xl" style={{ background: '#151530', border: '1px solid rgba(212,168,67,0.2)' }}>
            <div className="text-[13px] font-black text-gold-400 mb-3">🎁 Подарить долю — {giftModal.title}</div>
            <input value={giftWallet} onChange={e => setGiftWallet(e.target.value)}
              placeholder="Кошелёк получателя (0x...)" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none font-mono mb-2" />
            <input type="number" value={giftCount} onChange={e => setGiftCount(Math.max(1, parseInt(e.target.value) || 1))}
              min="1" max="10" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none mb-3" />
            <button onClick={handleGift} disabled={txPending || !giftWallet}
              className="w-full py-2.5 rounded-xl text-[12px] font-black gold-btn disabled:opacity-50 mb-2">
              {txPending ? '⏳...' : '🎁 Подарить'}
            </button>
            <button onClick={() => setGiftModal(null)} className="w-full text-[11px] text-slate-500 py-1">Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}
