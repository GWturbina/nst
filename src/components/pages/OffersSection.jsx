'use client'
/**
 * OffersSection — раздел "Эксклюзивные предложения" в Сейфе (под Золотым пулом).
 * Виден вкладчикам фонда от $100 и админу.
 * Цена — "от $X" или "по запросу" (без автосчёта). Реальную цену клуб даёт после заявки.
 * Фото — загрузка с устройства (несколько) + запасная вставка ссылкой. Видео — ссылки.
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import * as Offers from '@/lib/offers'
import * as Gold from '@/lib/goldReserve'
import MediaLightbox, { ytId } from '@/components/ui/MediaLightbox'

export default function OffersSection() {
  const { wallet, isAdmin } = useGameStore()
  const [lightbox, setLightbox] = useState(null) // { items, startIndex }

  const [offers, setOffers] = useState([])
  const [myDeposit, setMyDeposit] = useState(0)
  const [requests, setRequests] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  // форма
  const [form, setForm] = useState({ title: '', carat: '', color: '', clarity: '', priceFrom: '', description: '' })
  const [photos, setPhotos] = useState([])   // [{url, path}]
  const [videos, setVideos] = useState([])   // [url]
  const [photoLink, setPhotoLink] = useState('')
  const [videoLink, setVideoLink] = useState('')

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

  // загрузка фото с устройства
  const handleFiles = async (e) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true); setMsg(null)
    const r = await Offers.uploadPhotos(files)
    if (r.photos?.length) setPhotos(prev => [...prev, ...r.photos])
    if (r.errors?.length) flash('err', r.errors.join('; '))
    setUploading(false)
    e.target.value = ''
  }
  const addPhotoLink = () => { if (photoLink.trim()) { setPhotos(prev => [...prev, { url: photoLink.trim(), path: null }]); setPhotoLink('') } }
  const removePhoto = (i) => setPhotos(prev => prev.filter((_, idx) => idx !== i))
  const addVideo = () => { if (videoLink.trim()) { setVideos(prev => [...prev, videoLink.trim()]); setVideoLink('') } }
  const removeVideo = (i) => setVideos(prev => prev.filter((_, idx) => idx !== i))

  const handleRequest = (offer) => run(() => Offers.sendRequest(offer.id, myDeposit), 'Заявка отправлена! Клуб свяжется с вами')

  const handleCreate = () => {
    if (!form.title) return flash('err', 'Укажи название')
    run(() => Offers.adminCreateOffer({
      ...form,
      photos: photos.map(p => p.url),
      photoPaths: photos.filter(p => p.path).map(p => p.path),
      videos,
    }), 'Предложение создано').then(ok => {
      if (ok) {
        setForm({ title: '', carat: '', color: '', clarity: '', priceFrom: '', description: '' })
        setPhotos([]); setVideos([]); setShowCreate(false)
      }
    })
  }
  const handleClose = (id) => run(() => Offers.adminCloseOffer(id), 'Предложение закрыто')
  const handleProcess = (id) => run(() => Offers.adminProcessRequest(id), 'Заявка обработана')

  const card = { background: 'var(--bg-card)', borderColor: 'rgba(56,189,248,0.18)' }
  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm bg-black/40 border border-sky-400/20 text-white outline-none focus:border-sky-400/50'

  // Собрать медиа предложения в единый список для лайтбокса
  const buildMedia = (offer) => {
    const media = []
    if (Array.isArray(offer.photos)) offer.photos.forEach(url => media.push({ type: 'photo', url }))
    if (Array.isArray(offer.videos)) offer.videos.forEach(url => media.push({ type: 'video', url }))
    return media
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
          Камни по внутренней клубной цене. Оставь заявку — клуб свяжется и назовёт точную цену для тебя.
          {tier?.note && <> Твой уровень: <b className="text-sky-400">{tier.note}</b>.</>}
        </div>
      </div>

      {msg && (
        <div className={`p-2.5 rounded-lg text-[11px] font-bold text-center ${msg.type === 'ok' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{msg.text}</div>
      )}

      {/* Админ: кнопка создания */}
      {isAdmin && (
        <button onClick={() => setShowCreate(v => !v)} className="w-full py-2.5 rounded-xl text-[12px] font-bold bg-purple-500/20 text-purple-400">
          {showCreate ? '✕ Скрыть форму' : '➕ Создать предложение'}
        </button>
      )}

      {/* Админ: форма */}
      {isAdmin && showCreate && (
        <div className="p-4 rounded-2xl border-2 space-y-2" style={{ background: 'var(--bg-card)', borderColor: 'rgba(168,85,247,0.4)' }}>
          <div className="text-[11px] font-black text-purple-400 mb-1">Новое предложение</div>
          <input placeholder="Название (напр. Бриллиант Fancy Intense Yellow 1.8ct)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} />
          <div className="flex gap-2">
            <input placeholder="караты" value={form.carat} onChange={e => setForm({ ...form, carat: e.target.value })} className={inputCls} />
            <input placeholder="цвет" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className={inputCls} />
            <input placeholder="чистота" value={form.clarity} onChange={e => setForm({ ...form, clarity: e.target.value })} className={inputCls} />
          </div>
          <input placeholder="Цена от $ (необязательно — оставь пустым для «по запросу»)" value={form.priceFrom} onChange={e => setForm({ ...form, priceFrom: e.target.value })} className={inputCls} />

          {/* Фото: загрузка + ссылка */}
          <div className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-[10px] font-bold text-slate-300 mb-1">Фото ({photos.length})</div>
            <label className="block w-full py-2 rounded-lg text-[12px] font-bold text-center text-sky-400 bg-sky-500/10 cursor-pointer">
              {uploading ? 'Загрузка...' : '📷 Загрузить фото с устройства'}
              <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} className="hidden" />
            </label>
            <div className="flex gap-2 mt-1.5">
              <input placeholder="или вставь ссылку на фото" value={photoLink} onChange={e => setPhotoLink(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg text-[11px] bg-black/40 border border-sky-400/20 text-white outline-none" />
              <button onClick={addPhotoLink} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-sky-500/20 text-sky-400">+</button>
            </div>
            {photos.length > 0 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto">
                {photos.map((p, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={p.url} alt="" className="rounded-lg object-cover" style={{ width: 64, height: 64 }} />
                    <button onClick={() => removePhoto(i)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Видео: ссылки */}
          <div className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-[10px] font-bold text-slate-300 mb-1">Видео ({videos.length})</div>
            <div className="flex gap-2">
              <input placeholder="ссылка YouTube / TikTok" value={videoLink} onChange={e => setVideoLink(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg text-[11px] bg-black/40 border border-sky-400/20 text-white outline-none" />
              <button onClick={addVideo} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-sky-500/20 text-sky-400">+</button>
            </div>
            {videos.map((v, i) => (
              <div key={i} className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span className="truncate">{v}</span>
                <button onClick={() => removeVideo(i)} className="text-red-400 ml-2">удалить</button>
              </div>
            ))}
          </div>

          <textarea placeholder="Описание" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls} />
          <button onClick={handleCreate} disabled={busy || uploading} className="w-full py-2.5 rounded-lg text-[13px] font-black disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff' }}>
            {busy ? '...' : '✅ Опубликовать (подпишите в кошельке)'}
          </button>
        </div>
      )}

      {/* Список предложений */}
      {offers.length === 0 ? (
        <div className="p-4 rounded-2xl border text-center text-[11px] text-slate-500" style={card}>Сейчас активных предложений нет</div>
      ) : (
        offers.map(offer => (
          <div key={offer.id} className="p-4 rounded-2xl border" style={card}>
            <div className="flex items-start justify-between">
              <div className="text-[14px] font-black text-white">{offer.title}</div>
              {isAdmin && (
                <button onClick={() => handleClose(offer.id)} disabled={busy} className="text-[10px] font-bold text-red-400 px-2 py-1 rounded bg-red-500/10">закрыть</button>
              )}
            </div>
            {(offer.carat || offer.color || offer.clarity) && (
              <div className="text-[10px] text-slate-400 mt-0.5">
                {offer.carat && `${offer.carat} ct`}{offer.color && ` • ${offer.color}`}{offer.clarity && ` • ${offer.clarity}`}
              </div>
            )}

            {/* Медиа: миниатюры (фото + видео), тап → полноэкранная галерея */}
            {(() => {
              const media = buildMedia(offer)
              if (!media.length) return null
              return (
                <div className="flex gap-2 overflow-x-auto mt-2">
                  {media.map((m, i) => (
                    <button key={i} onClick={() => setLightbox({ items: media, startIndex: i })}
                      className="relative shrink-0 rounded-lg overflow-hidden" style={{ height: 110, width: 110 }}>
                      {m.type === 'photo' ? (
                        <img src={m.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <img
                            src={ytId(m.url) ? `https://img.youtube.com/vi/${ytId(m.url)}/hqdefault.jpg` : ''}
                            alt="" className="w-full h-full object-cover"
                            style={{ background: '#000' }} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                              style={{ background: 'rgba(0,0,0,0.6)' }}>▶</div>
                          </div>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )
            })()}

            {offer.description && <div className="text-[11px] text-slate-300 leading-relaxed mt-2">{offer.description}</div>}

            {/* Цена */}
            <div className="mt-3 p-2.5 rounded-lg text-center bg-sky-500/10">
              <div className="text-[14px] font-black text-sky-400">
                {offer.price_from ? `для участников: от $${parseFloat(offer.price_from).toFixed(0)}` : 'Цена по запросу'}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">точную цену клуб назовёт после заявки</div>
            </div>

            {tier && (
              <button onClick={() => handleRequest(offer)} disabled={busy}
                className="w-full mt-2 py-2.5 rounded-lg text-[13px] font-black text-black disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)' }}>
                {busy ? '...' : '💎 Хочу — оставить заявку'}
              </button>
            )}
          </div>
        ))
      )}

      {/* Админ: заявки */}
      {isAdmin && requests.length > 0 && (
        <div className="p-4 rounded-2xl border-2" style={{ background: 'var(--bg-card)', borderColor: 'rgba(168,85,247,0.4)' }}>
          <div className="text-[11px] font-black text-purple-400 mb-2">📥 Заявки ({requests.filter(r => r.status === 'new').length} новых)</div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {requests.map(r => (
              <div key={r.id} className="p-2 rounded-lg bg-black/30 text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">{r.dc_offers?.title || `#${r.offer_id}`}</span>
                  <span className={r.status === 'new' ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{r.status === 'new' ? '🟢 новая' : '⚪ обработана'}</span>
                </div>
                <div className="text-slate-400 mt-0.5">{r.wallet?.slice(0, 6)}...{r.wallet?.slice(-4)} • вложил ${parseFloat(r.deposit_usdt || 0).toFixed(0)} (уровень)</div>
                {r.status === 'new' && (
                  <button onClick={() => handleProcess(r.id)} disabled={busy} className="mt-1 text-[9px] font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-500/10">отметить обработанной</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {lightbox && (
        <MediaLightbox items={lightbox.items} startIndex={lightbox.startIndex} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
