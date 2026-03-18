'use client'
/**
 * ShowcaseNew.jsx — Витрина Diamond Club
 * 
 * Два раздела:
 *   1. Корпоративная — выставляет Админ (бриллианты + ювелирка)
 *   2. Общая — партнёры выставляют свои камни/изделия
 * 
 * Маркетинг при продаже: 15% от маржи
 *   5% продавцу, 2% авторские, 3% тех, 5% токеномика
 *   90% маржи → 9 уровней GlobalWay (20/15/10/10/9/8/7/6/5)
 * 
 * Ограничения: мин 4 уровня GW для продажи/покупки (настраивается)
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import { getUserLevel } from '@/lib/contracts'
import { getAdminRole } from '@/lib/dcOrders'
import { formatUSD } from '@/lib/gemCatalog'
import { uploadShowcaseFile, compressImage } from '@/lib/showcaseStorage'

const CATEGORIES = [
  { id: 'all',     label: 'Все' },
  { id: 'diamond', label: '💎 Бриллианты' },
  { id: 'jewelry', label: '💍 Ювелирка' },
]

const MIN_GW_LEVEL = 4

export default function ShowcaseNew() {
  const { wallet, addNotification, txPending, setTxPending } = useGameStore()

  const [tab, setTab] = useState('corporate')      // 'corporate' | 'partner'
  const [category, setCategory] = useState('all')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [userLevel, setUserLevel] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [marketing, setMarketing] = useState(null)

  // Форма создания
  const [form, setForm] = useState({
    category: 'diamond', title: '', description: '',
    retailPrice: '', clubPrice: '', carat: '', shape: '',
    clarity: '', color: '', certUrl: '', photos: [], videoUrl: '',
  })

  // Модалка продажи
  const [sellModal, setSellModal] = useState(null)
  const [buyerAddress, setBuyerAddress] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  // Загрузка данных
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: tab, status: 'active' })
      if (category !== 'all') params.set('category', category)
      const res = await fetch(`/api/showcase?${params}`)
      const data = await res.json()
      if (data.ok) {
        setItems(data.items || [])
        setMarketing(data.marketing || null)
      }
    } catch {}

    if (wallet) {
      const level = await getUserLevel(wallet).catch(() => 0)
      setUserLevel(level)
      const role = await getAdminRole(wallet).catch(() => null)
      setIsAdmin(!!role)
    }
    setLoading(false)
  }, [tab, category, wallet])

  useEffect(() => { reload() }, [reload])

  const canSell = isAdmin || userLevel >= MIN_GW_LEVEL
  const canBuy = userLevel >= MIN_GW_LEVEL

  // Создание объявления
  const handleCreate = async () => {
    if (!form.title || !form.clubPrice) return addNotification('❌ Заполните название и цену')
    setTxPending(true)

    try {
      const res = await fetch('/api/showcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet, type: tab, ...form,
          retailPrice: parseFloat(form.retailPrice) || parseFloat(form.clubPrice) * 2,
        })
      })
      const data = await res.json()
      if (data.ok) {
        addNotification(`✅ «${form.title}» опубликовано!`)
        setShowCreate(false)
        setForm({ category: 'diamond', title: '', description: '', retailPrice: '', clubPrice: '', carat: '', shape: '', clarity: '', color: '', certUrl: '', photos: [], videoUrl: '' })
        reload()
      } else addNotification(`❌ ${data.error}`)
    } catch { addNotification('❌ Ошибка сети') }
    setTxPending(false)
  }

  // Продажа
  const handleSell = async () => {
    if (!sellModal || !buyerAddress) return
    setTxPending(true)
    try {
      const res = await fetch('/api/showcase', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sellModal.id, wallet, action: 'sell',
          buyerWallet: buyerAddress, deliveryAddress,
        })
      })
      const data = await res.json()
      if (data.ok) {
        addNotification('✅ Продажа оформлена!')
        if (data.marketing) {
          addNotification(`💰 Маржа: ${formatUSD(data.marketing.margin)} → маркетинг: ${formatUSD(data.marketing.marketingPool)}`)
        }
        setSellModal(null); setBuyerAddress(''); setDeliveryAddress(''); reload()
      } else addNotification(`❌ ${data.error}`)
    } catch { addNotification('❌ Ошибка сети') }
    setTxPending(false)
  }

  // Снять с витрины
  const handleHide = async (id) => {
    setTxPending(true)
    try {
      const res = await fetch('/api/showcase', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, wallet, newStatus: 'hidden' })
      })
      const data = await res.json()
      if (data.ok) { addNotification('✅ Снято с витрины'); reload() }
      else addNotification(`❌ ${data.error}`)
    } catch {}
    setTxPending(false)
  }

  const sel = (active) => active
    ? 'bg-gold-400/15 border-gold-400/30 text-gold-400'
    : 'border-white/8 text-slate-500'

  if (loading) return <div className="flex items-center justify-center py-12"><div className="text-2xl animate-spin">💎</div></div>

  return (
    <div className="px-3 mt-2 space-y-3">

      {/* ── Табы: Корпоративная / Общая ── */}
      <div className="flex gap-1">
        <button onClick={() => setTab('corporate')}
          className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold border transition-all ${sel(tab==='corporate')}`}>
          🏢 Корпоративная
        </button>
        <button onClick={() => setTab('partner')}
          className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold border transition-all ${sel(tab==='partner')}`}>
          👥 Общая
        </button>
      </div>

      {/* ── Категории ── */}
      <div className="flex gap-1.5">
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            className={`flex-1 px-2 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${sel(category===c.id)}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* ── Кнопка создания ── */}
      {wallet && canSell && (
        <button onClick={() => setShowCreate(!showCreate)}
          className={`w-full py-2.5 rounded-xl text-[11px] font-bold border transition-all ${
            showCreate ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-gold-400/10 border-gold-400/20 text-gold-400'
          }`}>
          {showCreate ? '✕ Закрыть' : '+ Разместить на витрине'}
        </button>
      )}

      {wallet && !canSell && (
        <div className="p-3 rounded-2xl bg-orange-500/8 border border-orange-500/15 text-center">
          <div className="text-[11px] text-orange-400 font-bold">⚠️ Нужно минимум {MIN_GW_LEVEL} уровня в GlobalWay для продажи</div>
          <div className="text-[9px] text-slate-500 mt-1">Ваш уровень: {userLevel}</div>
        </div>
      )}

      {/* ── Форма создания ── */}
      {showCreate && (
        <div className="p-3 rounded-2xl space-y-2.5" style={{background:'rgba(255,215,0,0.04)', border:'1px solid rgba(255,215,0,0.15)'}}>
          <div className="text-[12px] font-black text-gold-400">📝 Новое объявление ({tab==='corporate'?'корпоративное':'партнёрское'})</div>

          {/* Категория */}
          <div className="flex gap-1.5">
            <button onClick={() => setForm(f => ({...f, category:'diamond'}))}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold border ${sel(form.category==='diamond')}`}>
              💎 Бриллиант
            </button>
            <button onClick={() => setForm(f => ({...f, category:'jewelry'}))}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold border ${sel(form.category==='jewelry')}`}>
              💍 Ювелирка
            </button>
          </div>

          <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
            placeholder="Название (напр. Бриллиант 1.5ct Круглый VS1)"
            className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none placeholder-slate-600" />

          <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
            placeholder="Описание — огранка, происхождение, особенности..."
            rows={2} className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none resize-none placeholder-slate-600" />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] text-slate-500 mb-1">Розничная цена ($)</div>
              <input type="number" value={form.retailPrice} onChange={e => setForm(f => ({...f, retailPrice: e.target.value}))}
                placeholder="1400" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
            <div>
              <div className="text-[9px] text-slate-500 mb-1">Клубная цена ($) (до 50%)</div>
              <input type="number" value={form.clubPrice} onChange={e => setForm(f => ({...f, clubPrice: e.target.value}))}
                placeholder="700" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
          </div>

          {form.retailPrice && form.clubPrice && parseFloat(form.clubPrice) > parseFloat(form.retailPrice) * 0.5 && (
            <div className="text-[9px] text-red-400 text-center">⚠️ Клубная цена не может быть выше 50% от розничной!</div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <input value={form.carat} onChange={e => setForm(f => ({...f, carat: e.target.value}))}
              placeholder="Караты" type="number" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            <input value={form.shape} onChange={e => setForm(f => ({...f, shape: e.target.value}))}
              placeholder="Форма" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            <input value={form.clarity} onChange={e => setForm(f => ({...f, clarity: e.target.value}))}
              placeholder="Чистота" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
          </div>

          <input value={form.certUrl} onChange={e => setForm(f => ({...f, certUrl: e.target.value}))}
            placeholder="Ссылка на сертификат (URL)" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none placeholder-slate-600" />

          {/* Загрузка фото */}
          <div>
            <div className="text-[9px] text-slate-500 mb-1">📷 Фото (до 10 шт, макс 10 МБ каждое)</div>
            <div className="flex gap-2 items-center">
              <label className="flex-1 py-2.5 rounded-xl text-[10px] font-bold text-center cursor-pointer bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all">
                📷 Загрузить фото
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || [])
                    if (files.length === 0) return
                    if (form.photos.length + files.length > 10) {
                      addNotification('❌ Максимум 10 фото'); return
                    }
                    for (const file of files) {
                      const compressed = await compressImage(file)
                      const result = await uploadShowcaseFile(compressed, wallet)
                      if (result.ok) {
                        setForm(f => ({...f, photos: [...f.photos, result.url]}))
                        addNotification('✅ Фото загружено')
                      } else addNotification(`❌ ${result.error}`)
                    }
                    e.target.value = ''
                  }} />
              </label>
              <label className="py-2.5 px-4 rounded-xl text-[10px] font-bold text-center cursor-pointer bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all">
                🎥 Видео
                <input type="file" accept="video/mp4,video/webm" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const result = await uploadShowcaseFile(file, wallet)
                    if (result.ok) {
                      setForm(f => ({...f, videoUrl: result.url}))
                      addNotification('✅ Видео загружено')
                    } else addNotification(`❌ ${result.error}`)
                    e.target.value = ''
                  }} />
              </label>
            </div>
            {/* Превью загруженных фото */}
            {form.photos.length > 0 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto">
                {form.photos.map((url, i) => (
                  <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setForm(f => ({...f, photos: f.photos.filter((_, idx) => idx !== i)}))}
                      className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-bl">✕</button>
                  </div>
                ))}
              </div>
            )}
            {form.videoUrl && (
              <div className="mt-1.5 flex items-center gap-2 p-1.5 rounded-lg bg-purple-500/8 border border-purple-500/15">
                <span className="text-[10px] text-purple-400">🎥 Видео загружено</span>
                <button onClick={() => setForm(f => ({...f, videoUrl: ''}))} className="text-[9px] text-red-400 font-bold">✕</button>
              </div>
            )}
          </div>

          {/* Маркетинг-инфо */}
          {form.clubPrice && form.retailPrice && parseFloat(form.retailPrice) > parseFloat(form.clubPrice) && (
            <div className="p-2 rounded-xl bg-blue-500/8 border border-blue-500/15">
              <div className="text-[9px] text-blue-300 font-bold mb-1">💰 При продаже за клубную цену:</div>
              <div className="text-[8px] text-slate-400 space-y-0.5">
                <div>Маржа: <span className="text-emerald-400 font-bold">{formatUSD(parseFloat(form.retailPrice) - parseFloat(form.clubPrice))}</span> → 15% на маркетинг</div>
                <div>90% маржи → 9 уровней партнёрки (20/15/10/10/9/8/7/6/5%)</div>
              </div>
            </div>
          )}

          <button onClick={handleCreate} disabled={txPending || !form.title || !form.clubPrice}
            className="w-full py-3 rounded-xl text-[12px] font-black gold-btn disabled:opacity-40">
            {txPending ? '⏳ ...' : '🏪 Опубликовать'}
          </button>
        </div>
      )}

      {/* ── Карточки товаров ── */}
      {items.length === 0 ? (
        <div className="py-12 text-center rounded-2xl" style={{background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.08)'}}>
          <div className="text-4xl mb-3">🏪</div>
          <div className="text-[13px] font-bold text-slate-400">
            {tab==='corporate' ? 'Корпоративная витрина пуста' : 'Общая витрина пуста'}
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            {canSell ? 'Разместите первый товар' : `Нужно минимум ${MIN_GW_LEVEL} уровней GW`}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map(item => {
            const isMine = wallet && item.seller_wallet === wallet.toLowerCase()
            const hasPhotos = item.photos && item.photos.length > 0
            const firstPhoto = hasPhotos ? item.photos[0] : null

            return (
              <div key={item.id} onClick={() => setSelectedItem(item)}
                className="rounded-2xl overflow-hidden cursor-pointer transition-all active:scale-[0.97]"
                style={{background:'rgba(255,255,255,0.04)', border: isMine ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.07)'}}>

                {/* Фото */}
                <div className="relative w-full aspect-square overflow-hidden" style={{background:'rgba(0,0,0,0.4)'}}>
                  {firstPhoto ? (
                    <img src={firstPhoto} alt={item.title} className="w-full h-full object-cover" 
                      onError={e => { e.target.style.display='none' }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {item.category === 'jewelry' ? '💍' : '💎'}
                    </div>
                  )}

                  {/* Бейджи */}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-lg text-[8px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/20 backdrop-blur-sm">
                    {item.category === 'jewelry' ? '💍 Ювелирка' : '💎 Бриллиант'}
                  </div>
                  {isMine && (
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-lg text-[8px] font-bold bg-gold-400/20 text-gold-400 border border-gold-400/30 backdrop-blur-sm">МОЙ</div>
                  )}
                  {item.type === 'corporate' && (
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-lg text-[7px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/20 backdrop-blur-sm">🏢 КЛУБ</div>
                  )}
                </div>

                {/* Инфо */}
                <div className="p-2.5">
                  <div className="text-[11px] font-bold text-white leading-tight line-clamp-1">{item.title}</div>
                  {item.carat && <div className="text-[9px] text-slate-500 mt-0.5">{item.carat}ct {item.shape || ''} {item.clarity || ''}</div>}
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      {item.retail_price > 0 && (
                        <div className="text-[9px] text-slate-500 line-through">{formatUSD(item.retail_price)}</div>
                      )}
                      <div className="text-[14px] font-black text-gold-400">{formatUSD(item.club_price)}</div>
                    </div>
                  </div>
                  {item.cert_url && <div className="mt-1 text-[9px] text-emerald-400">✅ Сертификат</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Детальный просмотр ── */}
      {selectedItem && (() => {
        const item = selectedItem
        const isMine = wallet && item.seller_wallet === wallet.toLowerCase()
        const hasPhotos = item.photos && item.photos.length > 0
        const margin = item.retail_price - item.club_price
        const marketingAmt = margin > 0 ? +(margin * 0.15).toFixed(2) : 0

        return (
          <div className="fixed inset-0 bg-black/85 z-50 flex items-end justify-center" onClick={() => setSelectedItem(null)}>
            <div className="w-full max-w-sm rounded-t-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
              style={{background:'#12122a', border:'1px solid rgba(255,255,255,0.1)'}}
              onClick={e => e.stopPropagation()}>

              {/* Фото / Видео */}
              <div className="relative w-full" style={{aspectRatio:'16/10', background:'rgba(0,0,0,0.6)'}}>
                {hasPhotos ? (
                  <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl opacity-50">
                    {item.category === 'jewelry' ? '💍' : '💎'}
                  </div>
                )}
                <button onClick={() => setSelectedItem(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white text-lg flex items-center justify-center backdrop-blur-sm">✕</button>
              </div>

              {/* Миниатюры фото + видео */}
              {(item.photos?.length > 1 || item.video_url) && (
                <div className="flex gap-1.5 px-4 pt-2 overflow-x-auto">
                  {item.photos?.slice(1).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer"
                      className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                  {item.video_url && (
                    <a href={item.video_url} target="_blank" rel="noreferrer"
                      className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-purple-500/30 bg-purple-500/10 flex items-center justify-center">
                      <span className="text-2xl">🎥</span>
                    </a>
                  )}
                </div>
              )}

              <div className="p-4 space-y-3">
                <div>
                  <div className="text-[16px] font-black text-white">{item.title}</div>
                  {item.description && <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.description}</div>}
                  {item.gem_id && <div className="text-[10px] text-purple-400 mt-1 font-mono">ID: {item.gem_id}</div>}
                </div>

                {/* Характеристики */}
                {(item.carat || item.shape || item.clarity) && (
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    {item.carat && <div className="p-1.5 rounded-lg bg-white/5 text-center"><span className="text-gold-400 font-bold">{item.carat}ct</span></div>}
                    {item.shape && <div className="p-1.5 rounded-lg bg-white/5 text-center"><span className="text-white font-bold">{item.shape}</span></div>}
                    {item.clarity && <div className="p-1.5 rounded-lg bg-white/5 text-center"><span className="text-white font-bold">{item.clarity}</span></div>}
                  </div>
                )}

                {/* Цены */}
                <div className="flex items-center justify-between py-2 border-t border-white/8">
                  <div>
                    {item.retail_price > 0 && (
                      <div className="text-[10px] text-slate-500 line-through">{formatUSD(item.retail_price)} розничная</div>
                    )}
                    <div className="text-[22px] font-black text-gold-400">{formatUSD(item.club_price)}</div>
                    <div className="text-[9px] text-slate-500">клубная цена</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Продавец</div>
                    <div className="text-[11px] text-slate-300 font-mono">{shortAddress(item.seller_wallet)}</div>
                    {isMine && <div className="text-[9px] text-gold-400 font-bold">— это вы</div>}
                  </div>
                </div>

                {/* Маркетинг при продаже */}
                {margin > 0 && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                    <div className="text-[10px] text-emerald-400 font-bold mb-1">💰 Маркетинг при продаже</div>
                    <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-400">
                      <div>Маржа: <span className="text-emerald-400 font-bold">{formatUSD(margin)}</span></div>
                      <div>15% маркетинг: <span className="text-gold-400 font-bold">{formatUSD(marketingAmt)}</span></div>
                      <div>5% продавцу: {formatUSD(margin * 0.05)}</div>
                      <div>2% авторские: {formatUSD(margin * 0.02)}</div>
                      <div>3% тех: {formatUSD(margin * 0.03)}</div>
                      <div>5% токеномика: {formatUSD(margin * 0.05)}</div>
                    </div>
                    <div className="text-[8px] text-slate-500 mt-1">90% маржи → 9 уровней партнёрки (20/15/10/10/9/8/7/6/5%)</div>
                  </div>
                )}

                {item.cert_url && (
                  <a href={item.cert_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                    ✅ Просмотреть сертификат ↗
                  </a>
                )}

                {/* Кнопки */}
                {isMine ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setSelectedItem(null); setSellModal(item); setBuyerAddress(''); setDeliveryAddress('') }}
                      className="py-3 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      ✅ Оформить продажу
                    </button>
                    <button onClick={() => { setSelectedItem(null); handleHide(item.id) }} disabled={txPending}
                      className="py-3 rounded-xl text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 disabled:opacity-50">
                      ✕ Снять
                    </button>
                  </div>
                ) : canBuy ? (
                  <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/15 text-[10px] text-slate-400 text-center leading-relaxed">
                    📩 Для покупки свяжитесь с продавцом. При оформлении укажите адрес доставки — он будет зашифрован.
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-orange-500/8 border border-orange-500/15 text-[10px] text-orange-400 text-center">
                    ⚠️ Нужно минимум {MIN_GW_LEVEL} уровней GW для покупки
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Модалка продажи ── */}
      {sellModal && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={() => setSellModal(null)}>
          <div className="w-full max-w-sm p-5 rounded-3xl space-y-3"
            style={{background:'#12122a', border:'1px solid rgba(255,215,0,0.2)'}}
            onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-[15px] font-black text-white">Оформление продажи</div>
              <div className="text-[11px] text-slate-500 mt-1">«{sellModal.title}» — <span className="text-gold-400">{formatUSD(sellModal.club_price)}</span></div>
            </div>

            <input value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)}
              placeholder="Кошелёк покупателя (0x...)"
              className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none font-mono placeholder-slate-600" />

            <div>
              <div className="text-[9px] text-slate-500 mb-1">📦 Адрес доставки (шифруется)</div>
              <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                placeholder="Город, улица, дом, квартира, почтовый индекс, ФИО получателя"
                rows={3} className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none resize-none placeholder-slate-600" />
              <div className="text-[8px] text-slate-600 mt-1">🔐 Адрес будет зашифрован. Только Админ сможет его расшифровать для отправки.</div>
            </div>

            <button onClick={handleSell} disabled={txPending || !buyerAddress}
              className="w-full py-3 rounded-xl text-[12px] font-black gold-btn disabled:opacity-40">
              {txPending ? '⏳ ...' : '✅ Подтвердить продажу'}
            </button>
            <button onClick={() => setSellModal(null)}
              className="w-full py-2.5 rounded-xl text-[11px] font-bold text-slate-500 border border-white/8">Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}
