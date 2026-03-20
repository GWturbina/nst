'use client'
/**
 * LotsAdmin.jsx — Админка клубных лотов
 * Создание лотов, резервирование, подарки, определение получателя
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import { authFetch } from '@/lib/authClient'
import * as CL from '@/lib/clubLotsContracts'
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
    hasCert: false, gemCost: '', sharePrice: '50', minGwLevel: '4', lockDays: '180',
  })

  // Секретное число (для commit-reveal)
  const [secret, setSecret] = useState('')

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

  // Генерация секрета
  const generateSecret = () => {
    const arr = new Uint8Array(32)
    crypto.getRandomValues(arr)
    const num = BigInt('0x' + [...arr].map(b => b.toString(16).padStart(2, '0')).join(''))
    setSecret(num.toString())
  }

  // ═══ Создать лот ═══
  const handleCreate = async () => {
    if (!form.title || !form.gemCost) return addNotification('❌ Укажите название и цену камня')
    if (!secret) return addNotification('❌ Сгенерируйте секрет для розыгрыша')

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
          lockDays: parseInt(form.lockDays),
          adminCommit: secret, // Сохраняем секрет в Supabase (зашифрованный в будущем)
        }
      })
      const data = await res.json()
      if (data.ok) {
        addNotification(`✅ Лот «${form.title}» создан! ID: ${data.lot.id}`)
        addNotification(`📋 СОХРАНИ СЕКРЕТ: ${secret}`)
        setShowCreate(false)
        setForm({ title: '', description: '', photoUrl: '', gemType: 'diamond', shape: '', clarity: '', color: '', carats: '', hasCert: false, gemCost: '', sharePrice: '50', minGwLevel: '4', lockDays: '180' })
        setSecret('')
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
      {/* Кнопка создания */}
      <button onClick={() => { setShowCreate(!showCreate); if (!secret) generateSecret() }}
        className="w-full py-3 rounded-2xl text-[12px] font-black gold-btn">
        {showCreate ? '✕ Закрыть' : '+ Создать новый лот'}
      </button>

      {/* Форма создания */}
      {showCreate && (
        <div className="p-4 rounded-2xl glass space-y-2">
          <div className="text-[13px] font-black text-gold-400 mb-2">✨ Новый клубный лот</div>

          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Название (напр. Бриллиант 1.5ct VS1 D)" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />

          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Описание" rows={2} className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none resize-none" />

          <div className="grid grid-cols-3 gap-2">
            <input value={form.carats} onChange={e => setForm(f => ({ ...f, carats: e.target.value }))}
              placeholder="Караты" type="number" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            <input value={form.clarity} onChange={e => setForm(f => ({ ...f, clarity: e.target.value }))}
              placeholder="Чистота" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              placeholder="Цвет" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">Клубная цена камня ($)</label>
              <input value={form.gemCost} onChange={e => setForm(f => ({ ...f, gemCost: e.target.value }))}
                type="number" placeholder="4000" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Цена доли ($)</label>
              <select value={form.sharePrice} onChange={e => setForm(f => ({ ...f, sharePrice: e.target.value }))}
                className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none">
                <option value="25">$25</option>
                <option value="50">$50</option>
                <option value="100">$100</option>
              </select>
            </div>
          </div>

          {/* Расчёт */}
          {form.gemCost && (
            <div className="p-2 rounded-xl bg-gold-400/8 text-[11px]">
              <span className="text-slate-400">Цена лота: </span>
              <span className="text-gold-400 font-bold">${(parseFloat(form.gemCost) * 1.25).toFixed(0)}</span>
              <span className="text-slate-400"> | Долей: </span>
              <span className="text-white font-bold">{Math.floor(parseFloat(form.gemCost) * 1.25 / parseInt(form.sharePrice || 50))}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">Мин. уровень GW</label>
              <input value={form.minGwLevel} onChange={e => setForm(f => ({ ...f, minGwLevel: e.target.value }))}
                type="number" min="1" max="12" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Заморозка (дней)</label>
              <input value={form.lockDays} onChange={e => setForm(f => ({ ...f, lockDays: e.target.value }))}
                type="number" min="30" max="730" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
          </div>

          {/* Секрет */}
          <div className="p-2 rounded-xl bg-red-500/8 border border-red-500/15">
            <div className="text-[10px] text-red-400 font-bold mb-1">🔐 Секрет для розыгрыша (СОХРАНИ!)</div>
            <div className="text-[9px] text-slate-300 font-mono break-all">{secret || '...'}</div>
            <button onClick={generateSecret} className="mt-1 text-[10px] text-red-400 hover:text-red-300">🔄 Новый секрет</button>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.hasCert} onChange={e => setForm(f => ({ ...f, hasCert: e.target.checked }))} className="accent-yellow-500" />
            <span className="text-[11px] text-slate-300">Есть сертификат</span>
          </label>

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
            <div className="text-[10px] text-slate-400 mb-2">
              ${parseFloat(lot.gem_cost).toLocaleString()} камень | ${lot.share_price} доля | {lot.sold_shares}/{lot.total_shares} продано | Резерв: {lot.reserved_shares || 0}
            </div>

            {lot.status === 'active' && (
              <div className="flex gap-1 flex-wrap">
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
