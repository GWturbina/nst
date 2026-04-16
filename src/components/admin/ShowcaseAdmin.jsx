'use client'
/**
 * ShowcaseAdmin.jsx — Управление витриной из админки
 * Все товары, создание корпоративных, модерация, продажи
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import { authFetch } from '@/lib/authClient'
import { uploadShowcaseFile, compressImage } from '@/lib/showcaseStorage'
import { formatUSD } from '@/lib/gemCatalog'

const STATUS_MAP = {
  active: { label: 'Активен', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  hidden: { label: 'Скрыт', color: 'text-slate-400', bg: 'bg-white/5' },
  sold:   { label: 'Продан', color: 'text-purple-400', bg: 'bg-purple-500/10' },
}

export default function ShowcaseAdmin() {
  const { wallet, addNotification } = useGameStore()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [txPending, setTxPending] = useState(false)
  const [filter, setFilter] = useState('active') // active | hidden | sold | all
  const [showCreate, setShowCreate] = useState(false)
  const [expandedItem, setExpandedItem] = useState(null)

  // Форма создания
  const [form, setForm] = useState({
    category: 'diamond', title: '', description: '',
    retailPrice: '', clubPrice: '', carat: '', shape: '',
    clarity: '', color: '', certUrl: '', photos: [], videoUrl: '',
  })
  const resetForm = () => setForm({ category: 'diamond', title: '', description: '', retailPrice: '', clubPrice: '', carat: '', shape: '', clarity: '', color: '', certUrl: '', photos: [], videoUrl: '' })

  // Модалка продажи
  const [sellId, setSellId] = useState(null)
  const [buyerAddress, setBuyerAddress] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  // Загрузка
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: filter === 'all' ? 'active' : filter })
      const res = await fetch(`/api/showcase?${params}`)
      const data = await res.json()
      if (data.ok) setItems(data.items || [])

      // Если фильтр "all" — дополнительно подгружаем hidden и sold
      if (filter === 'all') {
        const [h, s] = await Promise.all([
          fetch('/api/showcase?status=hidden').then(r => r.json()).catch(() => ({ items: [] })),
          fetch('/api/showcase?status=sold').then(r => r.json()).catch(() => ({ items: [] })),
        ])
        setItems(prev => [...prev, ...(h.items || []), ...(s.items || [])])
      }
    } catch {}
    setLoading(false)
  }, [filter])

  useEffect(() => { reload() }, [reload])

  // ═══ Создать корпоративный товар ═══
  const handleCreate = async () => {
    if (!form.title || !form.clubPrice) return addNotification('❌ Заполните название и клубную цену')
    setTxPending(true)
    try {
      const res = await authFetch('/api/showcase', {
        method: 'POST',
        body: {
          wallet, type: 'corporate', ...form,
          retailPrice: parseFloat(form.retailPrice) || parseFloat(form.clubPrice) * 2,
        }
      })
      const data = await res.json()
      if (data.ok) {
        addNotification(`✅ «${form.title}» добавлено на витрину!`)
        setShowCreate(false); resetForm(); reload()
      } else addNotification(`❌ ${data.error}`)
    } catch { addNotification('❌ Ошибка сети') }
    setTxPending(false)
  }

  // ═══ Сменить статус ═══
  const handleStatus = async (id, newStatus) => {
    setTxPending(true)
    try {
      const res = await authFetch('/api/showcase', {
        method: 'PATCH',
        body: { id, wallet, newStatus }
      })
      const data = await res.json()
      if (data.ok) { addNotification(`✅ Статус → ${STATUS_MAP[newStatus]?.label || newStatus}`); reload() }
      else addNotification(`❌ ${data.error}`)
    } catch { addNotification('❌ Ошибка сети') }
    setTxPending(false)
  }

  // ═══ Продажа ═══
  const handleSell = async () => {
    if (!sellId || !buyerAddress) return
    setTxPending(true)
    try {
      const res = await authFetch('/api/showcase', {
        method: 'PATCH',
        body: { id: sellId, wallet, action: 'sell', buyerWallet: buyerAddress, deliveryAddress }
      })
      const data = await res.json()
      if (data.ok) {
        addNotification('✅ Продажа оформлена!')
        if (data.marketing) addNotification(`💰 Маржа: ${formatUSD(data.marketing.margin)}`)
        setSellId(null); setBuyerAddress(''); setDeliveryAddress(''); reload()
      } else addNotification(`❌ ${data.error}`)
    } catch { addNotification('❌ Ошибка сети') }
    setTxPending(false)
  }

  const sel = (active) => active
    ? 'bg-gold-400/15 border-gold-400/30 text-gold-400'
    : 'border-white/8 text-slate-500'

  if (loading) return (
    <div className="text-center py-8">
      <div className="text-2xl animate-spin">🏪</div>
      <div className="text-[10px] text-slate-500 mt-2">Загрузка витрины...</div>
    </div>
  )

  return (
    <div className="space-y-3">

      {/* Фильтр по статусу */}
      <div className="flex gap-1">
        {[
          { id: 'active', label: '✅ Активные' },
          { id: 'hidden', label: '👁 Скрытые' },
          { id: 'sold', label: '💜 Проданные' },
          { id: 'all', label: '📋 Все' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex-1 py-1.5 rounded-xl text-[9px] font-bold border transition-all ${sel(filter === f.id)}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Счётчик */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-slate-400">
          Товаров: <span className="text-white font-bold">{items.length}</span>
        </div>
        <button onClick={reload} className="text-[10px] text-gold-400 font-bold">🔄</button>
      </div>

      {/* Кнопка создания */}
      <button onClick={() => setShowCreate(!showCreate)}
        className="w-full py-3 rounded-2xl text-[12px] font-black gold-btn">
        {showCreate ? '✕ Закрыть' : '+ Добавить на витрину'}
      </button>

      {/* ═══ ФОРМА СОЗДАНИЯ ═══ */}
      {showCreate && (
        <div className="p-4 rounded-2xl glass space-y-2" style={{ border: '1px solid rgba(212,168,67,0.2)' }}>
          <div className="text-[13px] font-black text-gold-400 mb-1">🏪 Новый корпоративный товар</div>

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
            placeholder="Название"
            className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />

          <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
            placeholder="Описание" rows={2}
            className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none resize-none" />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-slate-500">Розничная ($)</label>
              <input type="number" value={form.retailPrice} onChange={e => setForm(f => ({...f, retailPrice: e.target.value}))}
                placeholder="1400" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-slate-500">Клубная ($) ≤50%</label>
              <input type="number" value={form.clubPrice} onChange={e => setForm(f => ({...f, clubPrice: e.target.value}))}
                placeholder="700" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input value={form.carat} onChange={e => setForm(f => ({...f, carat: e.target.value}))}
              placeholder="Караты" type="number" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            <input value={form.shape} onChange={e => setForm(f => ({...f, shape: e.target.value}))}
              placeholder="Форма" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            <input value={form.clarity} onChange={e => setForm(f => ({...f, clarity: e.target.value}))}
              placeholder="Чистота" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
          </div>

          <input value={form.certUrl} onChange={e => setForm(f => ({...f, certUrl: e.target.value}))}
            placeholder="Ссылка на сертификат"
            className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />

          {/* Фото */}
          <div>
            <div className="flex gap-2">
              <label className="flex-1 py-2 rounded-xl text-[10px] font-bold text-center cursor-pointer bg-blue-500/10 text-blue-400 border border-blue-500/20">
                📷 Фото
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || [])
                    if (form.photos.length + files.length > 10) { addNotification('❌ Макс 10 фото'); return }
                    for (const file of files) {
                      const compressed = await compressImage(file)
                      const result = await uploadShowcaseFile(compressed, wallet)
                      if (result.ok) setForm(f => ({...f, photos: [...f.photos, result.url]}))
                      else addNotification(`❌ ${result.error}`)
                    }
                    e.target.value = ''
                  }} />
              </label>
              <label className="py-2 px-4 rounded-xl text-[10px] font-bold text-center cursor-pointer bg-purple-500/10 text-purple-400 border border-purple-500/20">
                🎥 Видео
                <input type="file" accept="video/mp4,video/webm" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const result = await uploadShowcaseFile(file, wallet)
                    if (result.ok) setForm(f => ({...f, videoUrl: result.url}))
                    else addNotification(`❌ ${result.error}`)
                    e.target.value = ''
                  }} />
              </label>
            </div>
            {form.photos.length > 0 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto">
                {form.photos.map((url, i) => (
                  <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setForm(f => ({...f, photos: f.photos.filter((_, idx) => idx !== i)}))}
                      className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[7px] flex items-center justify-center rounded-bl">✕</button>
                  </div>
                ))}
              </div>
            )}
            {form.videoUrl && (
              <div className="mt-1 flex items-center gap-2 p-1.5 rounded-lg bg-purple-500/8 border border-purple-500/15">
                <span className="text-[9px] text-purple-400">🎥 Видео</span>
                <button onClick={() => setForm(f => ({...f, videoUrl: ''}))} className="text-[8px] text-red-400">✕</button>
              </div>
            )}
          </div>

          {/* Маржа */}
          {form.clubPrice && form.retailPrice && parseFloat(form.retailPrice) > parseFloat(form.clubPrice) && (
            <div className="p-2 rounded-xl bg-blue-500/8 text-[9px] text-slate-400">
              Маржа: <span className="text-emerald-400 font-bold">{formatUSD(parseFloat(form.retailPrice) - parseFloat(form.clubPrice))}</span> → 15% маркетинг → 9 уровней
            </div>
          )}

          <button onClick={handleCreate} disabled={txPending || !form.title || !form.clubPrice}
            className="w-full py-3 rounded-2xl text-[12px] font-black gold-btn disabled:opacity-40">
            {txPending ? '⏳...' : '🏪 Опубликовать'}
          </button>
        </div>
      )}

      {/* ═══ СПИСОК ТОВАРОВ ═══ */}
      {items.length === 0 ? (
        <div className="p-6 rounded-2xl glass text-center">
          <div className="text-3xl mb-2">🏪</div>
          <div className="text-[11px] text-slate-400">Нет товаров</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const st = STATUS_MAP[item.status] || STATUS_MAP.active
            const isExpanded = expandedItem === item.id
            return (
              <div key={item.id} className="rounded-2xl glass overflow-hidden">
                <button onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                  className="w-full p-3 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]">{item.category === 'jewelry' ? '💍' : '💎'}</span>
                      <span className="text-[11px] font-bold text-white truncate max-w-[200px]">{item.title}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${st.bg} ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] text-slate-500">
                    <span>{item.type === 'corporate' ? '🏢' : '👤'} {shortAddress(item.seller_wallet)}</span>
                    {item.club_price > 0 && <span className="text-gold-400 font-bold">${item.club_price}</span>}
                    {item.retail_price > 0 && <span className="line-through">${item.retail_price}</span>}
                    {item.carat && <span>{item.carat}ct</span>}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-white/5 pt-2 space-y-2">
                    {/* Фото */}
                    {item.photos && item.photos.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto">
                        {item.photos.map((url, i) => (
                          <div key={i} className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Описание */}
                    {item.description && (
                      <div className="text-[10px] text-slate-400">{item.description}</div>
                    )}

                    {/* Детали */}
                    <div className="grid grid-cols-2 gap-1 text-[9px]">
                      {item.shape && <div className="p-1 rounded bg-white/5"><span className="text-slate-500">Форма: </span><span className="text-white">{item.shape}</span></div>}
                      {item.clarity && <div className="p-1 rounded bg-white/5"><span className="text-slate-500">Чистота: </span><span className="text-white">{item.clarity}</span></div>}
                      {item.color && <div className="p-1 rounded bg-white/5"><span className="text-slate-500">Цвет: </span><span className="text-white">{item.color}</span></div>}
                      {item.cert_url && <div className="p-1 rounded bg-white/5"><a href={item.cert_url} target="_blank" rel="noreferrer" className="text-blue-400">📜 Сертификат</a></div>}
                    </div>

                    {item.buyer_wallet && (
                      <div className="text-[9px] text-purple-400">
                        🛒 Покупатель: {shortAddress(item.buyer_wallet)}
                        {item.sold_at && <span className="text-slate-500 ml-2">{new Date(item.sold_at).toLocaleDateString()}</span>}
                      </div>
                    )}

                    {/* Кнопки */}
                    <div className="flex flex-wrap gap-1">
                      {item.status === 'active' && (
                        <>
                          <button onClick={() => handleStatus(item.id, 'hidden')} disabled={txPending}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-500/15 border border-slate-500/25 text-slate-400 disabled:opacity-50">
                            👁 Скрыть
                          </button>
                          <button onClick={() => { setSellId(item.id); setBuyerAddress(''); setDeliveryAddress('') }}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                            ✅ Продажа
                          </button>
                        </>
                      )}
                      {item.status === 'hidden' && (
                        <button onClick={() => handleStatus(item.id, 'active')} disabled={txPending}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 disabled:opacity-50">
                          ✅ Активировать
                        </button>
                      )}
                    </div>

                    {/* Инлайн-форма продажи */}
                    {sellId === item.id && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15 space-y-2">
                        <div className="text-[11px] font-bold text-emerald-400">✅ Оформить продажу</div>
                        <input value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)}
                          placeholder="Кошелёк покупателя (0x...)"
                          className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none font-mono" />
                        <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                          placeholder="Адрес доставки (необязательно)"
                          className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
                        <div className="flex gap-2">
                          <button onClick={handleSell} disabled={txPending || !buyerAddress}
                            className="flex-1 py-2 rounded-lg text-[10px] font-bold gold-btn disabled:opacity-50">
                            {txPending ? '⏳' : '✅ Подтвердить'}
                          </button>
                          <button onClick={() => setSellId(null)}
                            className="px-3 py-2 rounded-lg text-[10px] text-slate-500 border border-white/8">✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
