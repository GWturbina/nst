'use client'
/**
 * ShowcaseNew.jsx — Витрина Diamond Club
 * 
 * FIX: Полная переработка:
 *   - Галерея фото: стрелки, свайп, переключение внутри карточки
 *   - Кнопка "назад" в детальном просмотре
 *   - Кнопка "Купить" для покупателей
 *   - YouTube iframe для видео
 *   - Редактирование объявлений (фото, описание, цена)
 *   - Восстановление скрытых ("Скрыть" → "Восстановить")
 *   - Удаление объявлений
 *   - Вкладка "Мои" для управления своими объявлениями
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import { getUserLevel } from '@/lib/contracts'
import { getAdminRole } from '@/lib/dcOrders'
import { formatUSD } from '@/lib/gemCatalog'
import { uploadShowcaseFile, compressImage } from '@/lib/showcaseStorage'
import { authFetch } from '@/lib/authClient'

const CATEGORIES = [
  { id: 'all',     label: 'Все' },
  { id: 'diamond', label: '💎 Бриллианты' },
  { id: 'jewelry', label: '💍 Ювелирка' },
]

const MIN_GW_LEVEL = 4

// ═══ Хелпер: YouTube URL → embed URL ═══
function getYouTubeEmbedUrl(url) {
  if (!url) return null
  let videoId = null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) {
      videoId = u.searchParams.get('v')
    } else if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1)
    }
  } catch {}
  if (!videoId) return null
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`
}

export default function ShowcaseNew() {
  const { wallet, addNotification, txPending, setTxPending } = useGameStore()

  const [tab, setTab] = useState('corporate')      // 'corporate' | 'partner' | 'my'
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

  // Модалка редактирования
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Загрузка данных
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      let url
      if (tab === 'my' && wallet) {
        // Свои объявления (включая скрытые)
        url = `/api/showcase?owner=${wallet}`
      } else {
        const params = new URLSearchParams({ type: tab === 'my' ? '' : tab, status: 'active' })
        if (category !== 'all') params.set('category', category)
        url = `/api/showcase?${params}`
      }
      const res = await fetch(url)
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

  // ═══ Создание объявления ═══
  const handleCreate = async () => {
    if (!form.title || !form.clubPrice) return addNotification('❌ Заполните название и цену')
    setTxPending(true)
    try {
      const res = await authFetch('/api/showcase', {
        method: 'POST',
        body: {
          wallet, type: tab === 'my' ? 'partner' : tab, ...form,
          retailPrice: parseFloat(form.retailPrice) || parseFloat(form.clubPrice) * 2,
        }
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

  // ═══ Продажа ═══
  const handleSell = async () => {
    if (!sellModal || !buyerAddress) return
    setTxPending(true)
    try {
      const res = await authFetch('/api/showcase', {
        method: 'PATCH',
        body: {
          id: sellModal.id, wallet, action: 'sell',
          buyerWallet: buyerAddress, deliveryAddress,
        }
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

  // ═══ Скрыть / Восстановить ═══
  const handleToggleVisibility = async (item) => {
    const newStatus = item.status === 'hidden' ? 'active' : 'hidden'
    setTxPending(true)
    try {
      const res = await authFetch('/api/showcase', {
        method: 'PATCH',
        body: { id: item.id, wallet, newStatus }
      })
      const data = await res.json()
      if (data.ok) {
        addNotification(newStatus === 'active' ? '✅ Восстановлено на витрину' : '✅ Снято с витрины')
        setSelectedItem(null)
        reload()
      } else addNotification(`❌ ${data.error}`)
    } catch {}
    setTxPending(false)
  }

  // ═══ Удалить ═══
  const handleDelete = async (item) => {
    if (!confirm('Удалить объявление навсегда? Это действие нельзя отменить.')) return
    setTxPending(true)
    try {
      const res = await authFetch('/api/showcase', {
        method: 'DELETE',
        body: { id: item.id, wallet }
      })
      const data = await res.json()
      if (data.ok) {
        addNotification('✅ Объявление удалено')
        setSelectedItem(null)
        reload()
      } else addNotification(`❌ ${data.error}`)
    } catch {}
    setTxPending(false)
  }

  // ═══ Редактирование ═══
  const openEdit = (item) => {
    setEditModal(item)
    setEditForm({
      title: item.title, description: item.description || '',
      retailPrice: item.retail_price || '', clubPrice: item.club_price || '',
      carat: item.carat || '', shape: item.shape || '', clarity: item.clarity || '',
      certUrl: item.cert_url || '', photos: item.photos || [], videoUrl: item.video_url || '',
    })
    setSelectedItem(null)
  }

  const handleSaveEdit = async () => {
    if (!editModal) return
    setTxPending(true)
    try {
      const res = await authFetch('/api/showcase', {
        method: 'PATCH',
        body: { id: editModal.id, wallet, action: 'edit', ...editForm }
      })
      const data = await res.json()
      if (data.ok) {
        addNotification('✅ Объявление обновлено')
        setEditModal(null)
        reload()
      } else addNotification(`❌ ${data.error}`)
    } catch { addNotification('❌ Ошибка сети') }
    setTxPending(false)
  }

  const sel = (active) => active
    ? 'bg-gold-400/15 border-gold-400/30 text-gold-400'
    : 'border-white/8 text-slate-500'

  if (loading) return <div className="flex items-center justify-center py-12"><div className="text-2xl animate-spin">💎</div></div>

  return (
    <div className="px-3 mt-2 space-y-3">

      {/* ── Табы: Корпоративная / Общая / Мои ── */}
      <div className="flex gap-1">
        {[
          { id: 'corporate', label: '🏢 Корпоративная' },
          { id: 'partner',   label: '👥 Общая' },
          ...(wallet ? [{ id: 'my', label: '📦 Мои' }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold border transition-all ${sel(tab===t.id)}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Категории (не показываем на вкладке "Мои") ── */}
      {tab !== 'my' && (
        <div className="flex gap-1.5">
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCategory(c.id)}
              className={`flex-1 px-2 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${sel(category===c.id)}`}>
              {c.label}
            </button>
          ))}
        </div>
      )}

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
      {showCreate && <CreateForm form={form} setForm={setForm} tab={tab} wallet={wallet}
        addNotification={addNotification} txPending={txPending} onSubmit={handleCreate} sel={sel} />}

      {/* ── Карточки товаров ── */}
      {items.length === 0 ? (
        <div className="py-12 text-center rounded-2xl" style={{background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.08)'}}>
          <div className="text-4xl mb-3">🏪</div>
          <div className="text-[13px] font-bold text-slate-400">
            {tab === 'my' ? 'У вас нет объявлений' : tab==='corporate' ? 'Корпоративная витрина пуста' : 'Общая витрина пуста'}
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            {canSell ? 'Разместите первый товар' : `Нужно минимум ${MIN_GW_LEVEL} уровней GW`}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map(item => {
            const isMine = wallet && item.seller_wallet === wallet.toLowerCase()
            const firstPhoto = item.photos?.[0] || null
            const isHidden = item.status === 'hidden'

            return (
              <div key={item.id} onClick={() => setSelectedItem(item)}
                className={`rounded-2xl overflow-hidden cursor-pointer transition-all active:scale-[0.97] ${isHidden ? 'opacity-60' : ''}`}
                style={{background:'rgba(255,255,255,0.04)', border: isMine ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.07)'}}>

                <div className="relative w-full aspect-square overflow-hidden" style={{background:'rgba(0,0,0,0.4)'}}>
                  {firstPhoto ? (
                    <img src={firstPhoto} alt={item.title} className="w-full h-full object-cover"
                      onError={e => { e.target.style.display='none' }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {item.category === 'jewelry' ? '💍' : '💎'}
                    </div>
                  )}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-lg text-[8px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/20 backdrop-blur-sm">
                    {item.category === 'jewelry' ? '💍 Ювелирка' : '💎 Бриллиант'}
                  </div>
                  {isMine && (
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-lg text-[8px] font-bold bg-gold-400/20 text-gold-400 border border-gold-400/30 backdrop-blur-sm">МОЙ</div>
                  )}
                  {isHidden && (
                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-lg text-[7px] font-bold bg-red-500/20 text-red-400 border border-red-500/20 backdrop-blur-sm">СКРЫТ</div>
                  )}
                </div>

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
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Детальный просмотр ── */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          wallet={wallet}
          isAdmin={isAdmin}
          canBuy={canBuy}
          txPending={txPending}
          onClose={() => setSelectedItem(null)}
          onSell={(item) => { setSelectedItem(null); setSellModal(item); setBuyerAddress(''); setDeliveryAddress('') }}
          onToggleVisibility={handleToggleVisibility}
          onDelete={handleDelete}
          onEdit={openEdit}
        />
      )}

      {/* ── Модалка продажи ── */}
      {sellModal && (
        <SellModal
          item={sellModal}
          buyerAddress={buyerAddress}
          setBuyerAddress={setBuyerAddress}
          deliveryAddress={deliveryAddress}
          setDeliveryAddress={setDeliveryAddress}
          txPending={txPending}
          onSell={handleSell}
          onClose={() => setSellModal(null)}
        />
      )}

      {/* ── Модалка редактирования ── */}
      {editModal && (
        <EditModal
          item={editModal}
          form={editForm}
          setForm={setEditForm}
          wallet={wallet}
          addNotification={addNotification}
          txPending={txPending}
          onSave={handleSaveEdit}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// PHOTO GALLERY с навигацией стрелками
// ═══════════════════════════════════════════════════
function PhotoGallery({ photos, videoUrl }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const touchStart = useRef(0)

  const allMedia = [...(photos || [])]
  const ytEmbed = getYouTubeEmbedUrl(videoUrl)
  // Если видео — файл из Storage (не YouTube), добавляем как медиа
  const isFileVideo = videoUrl && !ytEmbed
  const total = allMedia.length + (ytEmbed ? 1 : 0) + (isFileVideo ? 1 : 0)

  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIdx < total - 1) setCurrentIdx(c => c + 1)
      if (diff < 0 && currentIdx > 0) setCurrentIdx(c => c - 1)
    }
  }

  return (
    <div className="relative w-full" style={{aspectRatio:'16/10', background:'rgba(0,0,0,0.6)'}}>
      {/* Основное изображение / видео */}
      <div className="w-full h-full" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {currentIdx < allMedia.length ? (
          <img src={allMedia[currentIdx]} alt="" className="w-full h-full object-contain bg-black/50" />
        ) : ytEmbed && currentIdx === allMedia.length ? (
          <iframe src={ytEmbed} className="w-full h-full" frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen title="Video" />
        ) : isFileVideo ? (
          <video src={videoUrl} controls className="w-full h-full object-contain bg-black" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl opacity-50">💎</div>
        )}
      </div>

      {/* Стрелки */}
      {total > 1 && (
        <>
          {currentIdx > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setCurrentIdx(c => c - 1) }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white text-lg flex items-center justify-center backdrop-blur-sm z-10">‹</button>
          )}
          {currentIdx < total - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setCurrentIdx(c => c + 1) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white text-lg flex items-center justify-center backdrop-blur-sm z-10">›</button>
          )}
        </>
      )}

      {/* Точки навигации */}
      {total > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentIdx(i) }}
              className={`w-2 h-2 rounded-full transition-all ${i === currentIdx ? 'bg-white scale-125' : 'bg-white/40'}`} />
          ))}
        </div>
      )}

      {/* Миниатюры */}
      {total > 1 && (
        <div className="absolute bottom-8 left-0 right-0 flex gap-1 px-3 justify-center z-10">
          {allMedia.map((url, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentIdx(i) }}
              className={`w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${i === currentIdx ? 'border-gold-400 scale-110' : 'border-white/20 opacity-60'}`}>
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          {ytEmbed && (
            <button onClick={(e) => { e.stopPropagation(); setCurrentIdx(allMedia.length) }}
              className={`w-10 h-10 rounded-lg flex-shrink-0 border-2 flex items-center justify-center bg-purple-500/20 ${currentIdx === allMedia.length ? 'border-purple-400 scale-110' : 'border-white/20 opacity-60'}`}>
              <span className="text-lg">🎥</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// DETAIL MODAL — карточка товара
// ═══════════════════════════════════════════════════
function ItemDetailModal({ item, wallet, isAdmin, canBuy, txPending, onClose, onSell, onToggleVisibility, onDelete, onEdit }) {
  const isMine = wallet && item.seller_wallet === wallet.toLowerCase()
  const hasPhotos = item.photos && item.photos.length > 0
  const margin = item.retail_price - item.club_price
  const marketingAmt = margin > 0 ? +(margin * 0.15).toFixed(2) : 0
  const isHidden = item.status === 'hidden'

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl overflow-hidden max-h-[92vh] overflow-y-auto pb-safe"
        style={{background:'#12122a', border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e => e.stopPropagation()}>

        {/* Шапка с кнопкой назад */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3" style={{background:'rgba(18,18,42,0.95)', backdropFilter:'blur(8px)'}}>
          <button onClick={onClose} className="flex items-center gap-1.5 text-[12px] text-slate-400 font-bold hover:text-white transition-colors">
            ← Назад
          </button>
          {isHidden && (
            <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/20">СКРЫТ</span>
          )}
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 text-white text-lg flex items-center justify-center">✕</button>
        </div>

        {/* Фото / Видео — галерея с навигацией */}
        <PhotoGallery photos={item.photos} videoUrl={item.video_url} />

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
              </div>
              <div className="text-[8px] text-slate-500 mt-1">90% маржи → 9 уровней партнёрки</div>
            </div>
          )}

          {item.cert_url && (
            <a href={item.cert_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold">
              ✅ Просмотреть сертификат ↗
            </a>
          )}

          {/* ═══ КНОПКИ УПРАВЛЕНИЯ ═══ */}
          {isMine || isAdmin ? (
            <div className="space-y-2">
              {/* Оформить продажу */}
              {item.status === 'active' && (
                <button onClick={() => onSell(item)}
                  className="w-full py-3 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  ✅ Оформить продажу
                </button>
              )}

              <div className="grid grid-cols-3 gap-2">
                {/* Редактировать */}
                <button onClick={() => onEdit(item)}
                  className="py-2.5 rounded-xl text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  ✏️ Редакт.
                </button>

                {/* Скрыть / Восстановить */}
                <button onClick={() => onToggleVisibility(item)} disabled={txPending}
                  className={`py-2.5 rounded-xl text-[10px] font-bold border disabled:opacity-50 ${
                    isHidden
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                  }`}>
                  {isHidden ? '👁 Восстан.' : '👁‍🗨 Скрыть'}
                </button>

                {/* Удалить */}
                <button onClick={() => onDelete(item)} disabled={txPending}
                  className="py-2.5 rounded-xl text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 disabled:opacity-50">
                  🗑 Удалить
                </button>
              </div>
            </div>
          ) : canBuy ? (
            // ═══ КНОПКА КУПИТЬ для покупателей ═══
            <div className="space-y-2">
              <button className="w-full py-3 rounded-xl text-[12px] font-black gold-btn">
                💎 Хочу купить — ${item.club_price}
              </button>
              <div className="p-2 rounded-xl bg-blue-500/8 border border-blue-500/15 text-[9px] text-slate-400 text-center leading-relaxed">
                📩 Нажмите кнопку — данные продавца будут отправлены. При оформлении адрес доставки шифруется AES-256.
              </div>
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
}

// ═══════════════════════════════════════════════════
// SELL MODAL
// ═══════════════════════════════════════════════════
function SellModal({ item, buyerAddress, setBuyerAddress, deliveryAddress, setDeliveryAddress, txPending, onSell, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm p-5 rounded-3xl space-y-3"
        style={{background:'#12122a', border:'1px solid rgba(255,215,0,0.2)'}}
        onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-4xl mb-2">✅</div>
          <div className="text-[15px] font-black text-white">Оформление продажи</div>
          <div className="text-[11px] text-slate-500 mt-1">«{item.title}» — <span className="text-gold-400">{formatUSD(item.club_price)}</span></div>
        </div>
        <input value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)}
          placeholder="Кошелёк покупателя (0x...)"
          className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none font-mono placeholder-slate-600" />
        <div>
          <div className="text-[9px] text-slate-500 mb-1">📦 Адрес доставки (шифруется)</div>
          <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
            placeholder="Город, улица, дом, квартира, почтовый индекс, ФИО получателя"
            rows={3} className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none resize-none placeholder-slate-600" />
          <div className="text-[8px] text-slate-600 mt-1">🔐 Адрес будет зашифрован AES-256-GCM</div>
        </div>
        <button onClick={onSell} disabled={txPending || !buyerAddress}
          className="w-full py-3 rounded-xl text-[12px] font-black gold-btn disabled:opacity-40">
          {txPending ? '⏳ ...' : '✅ Подтвердить продажу'}
        </button>
        <button onClick={onClose}
          className="w-full py-2.5 rounded-xl text-[11px] font-bold text-slate-500 border border-white/8">Отмена</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// EDIT MODAL — редактирование объявления
// ═══════════════════════════════════════════════════
function EditModal({ item, form, setForm, wallet, addNotification, txPending, onSave, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl max-h-[90vh] overflow-y-auto p-5 space-y-3"
        style={{background:'#12122a', border:'1px solid rgba(255,215,0,0.2)'}}
        onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-2xl mb-1">✏️</div>
          <div className="text-[14px] font-black text-white">Редактировать объявление</div>
        </div>

        <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
          placeholder="Название"
          className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none placeholder-slate-600" />

        <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
          placeholder="Описание" rows={2}
          className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none resize-none placeholder-slate-600" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[9px] text-slate-500 mb-1">Розничная цена ($)</div>
            <input type="number" value={form.retailPrice} onChange={e => setForm(f => ({...f, retailPrice: e.target.value}))}
              className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
          </div>
          <div>
            <div className="text-[9px] text-slate-500 mb-1">Клубная цена ($)</div>
            <input type="number" value={form.clubPrice} onChange={e => setForm(f => ({...f, clubPrice: e.target.value}))}
              className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
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
          className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none placeholder-slate-600" />

        <input value={form.videoUrl} onChange={e => setForm(f => ({...f, videoUrl: e.target.value}))}
          placeholder="Ссылка на видео (YouTube или файл)"
          className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none placeholder-slate-600" />

        {/* Фото — управление */}
        <div>
          <div className="text-[9px] text-slate-500 mb-1">📷 Фото ({form.photos?.length || 0}/10)</div>
          {form.photos?.length > 0 && (
            <div className="flex gap-1.5 mb-2 overflow-x-auto">
              {form.photos.map((url, i) => (
                <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setForm(f => ({...f, photos: f.photos.filter((_, idx) => idx !== i)}))}
                    className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-bl">✕</button>
                </div>
              ))}
            </div>
          )}
          <label className="w-full py-2 rounded-xl text-[10px] font-bold text-center cursor-pointer bg-blue-500/10 text-blue-400 border border-blue-500/20 block">
            📷 Добавить фото
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || [])
                if (files.length === 0) return
                if ((form.photos?.length || 0) + files.length > 10) {
                  addNotification('❌ Максимум 10 фото'); return
                }
                for (const file of files) {
                  const compressed = await compressImage(file)
                  const result = await uploadShowcaseFile(compressed, wallet)
                  if (result.ok) {
                    setForm(f => ({...f, photos: [...(f.photos || []), result.url]}))
                  } else addNotification(`❌ ${result.error}`)
                }
                e.target.value = ''
              }} />
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-[11px] font-bold text-slate-400 border border-white/10">Отмена</button>
          <button onClick={onSave} disabled={txPending || !form.title}
            className="flex-1 py-3 rounded-xl text-[12px] font-black gold-btn disabled:opacity-40">
            {txPending ? '⏳ ...' : '💾 Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// CREATE FORM — Форма создания (вынесена для чистоты)
// ═══════════════════════════════════════════════════
function CreateForm({ form, setForm, tab, wallet, addNotification, txPending, onSubmit, sel }) {
  return (
    <div className="p-3 rounded-2xl space-y-2.5" style={{background:'rgba(255,215,0,0.04)', border:'1px solid rgba(255,215,0,0.15)'}}>
      <div className="text-[12px] font-black text-gold-400">📝 Новое объявление ({tab==='corporate'?'корпоративное':'партнёрское'})</div>

      <div className="flex gap-1.5">
        <button onClick={() => setForm(f => ({...f, category:'diamond'}))}
          className={`flex-1 py-2 rounded-xl text-[10px] font-bold border ${sel(form.category==='diamond')}`}>💎 Бриллиант</button>
        <button onClick={() => setForm(f => ({...f, category:'jewelry'}))}
          className={`flex-1 py-2 rounded-xl text-[10px] font-bold border ${sel(form.category==='jewelry')}`}>💍 Ювелирка</button>
      </div>

      <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
        placeholder="Название (напр. Бриллиант 1.5ct Круглый VS1)"
        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none placeholder-slate-600" />

      <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
        placeholder="Описание — огранка, происхождение, особенности..." rows={2}
        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none resize-none placeholder-slate-600" />

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

      <div className="grid grid-cols-3 gap-2">
        <input value={form.carat} onChange={e => setForm(f => ({...f, carat: e.target.value}))}
          placeholder="Караты" type="number" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
        <input value={form.shape} onChange={e => setForm(f => ({...f, shape: e.target.value}))}
          placeholder="Форма" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
        <input value={form.clarity} onChange={e => setForm(f => ({...f, clarity: e.target.value}))}
          placeholder="Чистота" className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
      </div>

      <input value={form.certUrl} onChange={e => setForm(f => ({...f, certUrl: e.target.value}))}
        placeholder="Ссылка на сертификат (URL)"
        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none placeholder-slate-600" />

      <input value={form.videoUrl} onChange={e => setForm(f => ({...f, videoUrl: e.target.value}))}
        placeholder="YouTube ссылка или URL видео"
        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none placeholder-slate-600" />

      {/* Загрузка фото */}
      <div>
        <div className="text-[9px] text-slate-500 mb-1">📷 Фото (до 10 шт, макс 10 МБ каждое)</div>
        <label className="w-full py-2.5 rounded-xl text-[10px] font-bold text-center cursor-pointer bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all block">
          📷 Загрузить фото
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || [])
              if (files.length === 0) return
              if (form.photos.length + files.length > 10) { addNotification('❌ Максимум 10 фото'); return }
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

      <button onClick={onSubmit} disabled={txPending || !form.title || !form.clubPrice}
        className="w-full py-3 rounded-xl text-[12px] font-black gold-btn disabled:opacity-40">
        {txPending ? '⏳ ...' : '🏪 Опубликовать'}
      </button>
    </div>
  )
}
