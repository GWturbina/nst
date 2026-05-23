'use client'
/**
 * OffersSection — раздел "Эксклюзивные предложения" в Сейфе (под Золотым пулом).
 *
 * Виден только вкладчикам фонда от $100 (привилегия из условий).
 * Партнёр: список предложений с фото/видео, СВОЯ персональная цена, кнопка «Хочу».
 * Owner (isAdmin): форма создания предложения + список заявок.
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import * as Offers from '@/lib/offers'
import * as Gold from '@/lib/goldReserve'

export default function OffersSection() {
  const { wallet, isAdmin } = useGameStore()

  const [offers, setOffers] = useState([])
  const [myDeposit, setMyDeposit] = useState(0)
  const [requests, setRequests] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  // форма создания
  const [form, setForm] = useState({ title: '', carat: '', color: '', clarity: '', marketPrice: '', description: '', photoUrl: '', videoUrl: '' })

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 6000) }

  const load = useCallback(async () => {
    if (!wallet) return
    const list = await Offers.getOffers()
    setOffers(list)
    const staker = await Gold.getStaker(wallet).catch(() => null)
    setMyDeposit(staker ? parseFloat(staker.shares) : 0)
    if (isAdmin) {
      const r = await Offers.adminListRequests().catch(() => null)
      if (r?.ok) setRequests(r.requests || [])
    }
  }, [wallet, isAdmin])

  useEffect(() => { load() }, [load])

  const tier = Offers.getTier(myDeposit)

  // Партнёр не вкладчик от $100 и не админ → раздел не показываем вообще
  if (!isAdmin && !tier) return null

  const run = async (fn, okText) => {
    setBusy(true); setMsg(null)
    try {
      const r = await fn()
      if (r?.ok) { flash('ok', okText); await load(); return true }
      flash('err', r?.error || 'Ошибка'); return false
    } catch (e) { flash('err', e?.message?.slice(0, 120) || 'Ошибка'); return false }
    finally { setBusy(false) }
  }

  const handleRequest = (offer) => {
    const price = Offers.personalPrice(offer.market_price, myDeposit)
    run(() => Offers.sendRequest(offer.id, myDeposit, price), 'Заявка отправлена! Клуб свяжется с вами')
  }

  const handleCreate = () => {
    if (!form.title || !form.marketPrice) return flash('err', 'Заполни название и рыночную цену')
    run(() => Offers.adminCreateOffer(form), 'Предложение создано')
      .then(ok => { if (ok) { setForm({ title: '', carat: '', color: '', clarity: '', marketPrice: '', description: '', photoUrl: '', videoUrl: '' }); setShowCreate(false) } })
  }
  const handleClose = (id) => run(() => Offers.adminCloseOffer(id), 'Предложение закрыто')
  const handleProcess = (id) => run(() => Offers.adminProcessRequest(id), 'Заявка обработана')

  const card = { background: 'var(--bg-card)', borderColor: 'rgba(56,189,248,0.18)' }
  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm bg-black/40 border border-sky-400/20 text-white outline-none focus:border-sky-400/50'

  // Встраивание видео
  const renderVideo = (url, type) => {
    if (!url) return null
    if (type === 'youtube') {
      const id = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1]
      if (!id) return null
      return (
        <div className="rounded-lg overflow-hidden mt-2" style={{ aspectRatio: '16/9' }}>
          <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${id}`}
            title="video" frameBorder="0" allowFullScreen />
        </div>
      )
    }
    // TikTok и прочее — ссылкой (надёжнее в WebView чем их embed)
    return (
      <a href={url} target="_blank" rel="noreferrer"
        className="inline-block mt-2 text-[11px] font-bold text-sky-400 underline">
        ▶️ Смотреть видео
      </a>
    )
  }

  return (
    <div className="space-y-3">
      {/* Заголовок */}
      <div className="p-4 rounded-2xl border" style={card}>
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-black text-sky-400">💎 Эксклюзивные предложения</div>
          {tier && <div className="text-[10px] text-slate-400">ваш уровень: <b className="text-sky-400">{tier.label}</b></div>}
        </div>
        <div className="text-[10px] text-slate-400 leading-relaxed mt-1">
          Камни по вашей внутренней цене. Заявка ни к чему не обязывает — клуб свяжется с вами.
        </div>
      </div>

      {msg && (
        <div className={`p-2.5 rounded-lg text-[11px] font-bold text-center ${
          msg.type === 'ok' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
        }`}>{msg.text}</div>
      )}

      {/* Админ: кнопка создания */}
      {isAdmin && (
        <button onClick={() => setShowCreate(v => !v)}
          className="w-full py-2.5 rounded-xl text-[12px] font-bold bg-purple-500/20 text-purple-400">
          {showCreate ? '✕ Скрыть форму' : '➕ Создать предложение'}
        </button>
      )}

      {/* Админ: форма создания */}
      {isAdmin && showCreate && (
        <div className="p-4 rounded-2xl border-2 space-y-2" style={{ background: 'var(--bg-card)', borderColor: 'rgba(168,85,247,0.4)' }}>
          <div className="text-[11px] font-black text-purple-400 mb-1">Новое предложение</div>
          <input placeholder="Название (напр. Round Brilliant 1.5ct)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} />
          <div className="flex gap-2">
            <input placeholder="караты" value={form.carat} onChange={e => setForm({ ...form, carat: e.target.value })} className={inputCls} />
            <input placeholder="цвет (D)" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className={inputCls} />
            <input placeholder="чистота (VVS1)" value={form.clarity} onChange={e => setForm({ ...form, clarity: e.target.value })} className={inputCls} />
          </div>
          <input type="number" placeholder="Рыночная цена $ (от неё считается цена для вкладчика)" value={form.marketPrice} onChange={e => setForm({ ...form, marketPrice: e.target.value })} className={inputCls} />
          <input placeholder="Ссылка на фото" value={form.photoUrl} onChange={e => setForm({ ...form, photoUrl: e.target.value })} className={inputCls} />
          <input placeholder="Ссылка на видео (YouTube / TikTok)" value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} className={inputCls} />
          <textarea placeholder="Описание" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls} />
          <button onClick={handleCreate} disabled={busy} className="w-full py-2.5 rounded-lg text-[13px] font-black text-black disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff' }}>
            {busy ? '...' : '✅ Опубликовать (подпишите в кошельке)'}
          </button>
        </div>
      )}

      {/* Список предложений */}
      {offers.length === 0 ? (
        <div className="p-4 rounded-2xl border text-center text-[11px] text-slate-500" style={card}>
          Сейчас активных предложений нет
        </div>
      ) : (
        offers.map(offer => {
          const price = Offers.personalPrice(offer.market_price, myDeposit)
          return (
            <div key={offer.id} className="p-4 rounded-2xl border" style={card}>
              <div className="flex items-start justify-between">
                <div className="text-[14px] font-black text-white">{offer.title}</div>
                {isAdmin && (
                  <button onClick={() => handleClose(offer.id)} disabled={busy}
                    className="text-[10px] font-bold text-red-400 px-2 py-1 rounded bg-red-500/10">закрыть</button>
                )}
              </div>
              {(offer.carat || offer.color || offer.clarity) && (
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {offer.carat && `${offer.carat} ct`}{offer.color && ` • ${offer.color}`}{offer.clarity && ` • ${offer.clarity}`}
                </div>
              )}
              {offer.photo_url && (
                <img src={offer.photo_url} alt={offer.title} className="w-full rounded-lg mt-2 object-cover" style={{ maxHeight: 220 }} />
              )}
              {renderVideo(offer.video_url, offer.video_type)}
              {offer.description && <div className="text-[11px] text-slate-300 leading-relaxed mt-2">{offer.description}</div>}

              {/* Цены */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="text-center p-2 rounded-lg bg-black/20">
                  <div className="text-[13px] font-bold text-slate-400 line-through">${parseFloat(offer.market_price).toFixed(0)}</div>
                  <div className="text-[8px] text-slate-500">рынок</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-sky-500/10">
                  <div className="text-[15px] font-black text-sky-400">{price !== null ? `$${price.toFixed(0)}` : '—'}</div>
                  <div className="text-[8px] text-slate-500">ваша цена{tier ? ` (${tier.pct}%)` : ''}</div>
                </div>
              </div>
              {tier?.note && <div className="text-[9px] text-slate-500 text-center mt-1">{tier.note}</div>}

              {tier && (
                <button onClick={() => handleRequest(offer)} disabled={busy}
                  className="w-full mt-3 py-2.5 rounded-lg text-[13px] font-black text-black disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)' }}>
                  {busy ? '...' : '💎 Хочу — отправить заявку'}
                </button>
              )}
            </div>
          )
        })
      )}

      {/* Админ: список заявок */}
      {isAdmin && requests.length > 0 && (
        <div className="p-4 rounded-2xl border-2" style={{ background: 'var(--bg-card)', borderColor: 'rgba(168,85,247,0.4)' }}>
          <div className="text-[11px] font-black text-purple-400 mb-2">📥 Заявки ({requests.filter(r => r.status === 'new').length} новых)</div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {requests.map(r => (
              <div key={r.id} className="p-2 rounded-lg bg-black/30 text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">{r.dc_offers?.title || `#${r.offer_id}`}</span>
                  <span className={r.status === 'new' ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {r.status === 'new' ? '🟢 новая' : '⚪ обработана'}
                  </span>
                </div>
                <div className="text-slate-400 mt-0.5">
                  {r.wallet?.slice(0, 6)}...{r.wallet?.slice(-4)} • вложил ${parseFloat(r.deposit_usdt || 0).toFixed(0)} • его цена ${parseFloat(r.personal_price || 0).toFixed(0)}
                </div>
                {r.status === 'new' && (
                  <button onClick={() => handleProcess(r.id)} disabled={busy}
                    className="mt-1 text-[9px] font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-500/10">
                    отметить обработанной
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
