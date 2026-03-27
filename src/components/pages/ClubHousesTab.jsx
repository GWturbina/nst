'use client'
/**
 * ClubHouseCard — Реалистичная визуализация покупки клубного дома
 * 
 * Вид: До покупки (ч/б) | После покупки (цветное)
 * Прогресс: Куплено X м² из Y м² (Z%)
 * Кнопки: Купить за $50 → 0.05 м² / $250 → 0.25 м² / $1000 → 1 м²
 * 
 * Данные: из Supabase (club_houses + club_house_purchases)
 * Покупка: через RealEstateMatrix контракт (buySlot)
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import * as C from '@/lib/contracts'
import { getClubHouseWithPurchases } from '@/lib/clubHouses'

const SQM_MAP = [
  { tableId: 0, price: 50, sqm: 0.05, label: '$50', color: '#3498DB' },
  { tableId: 1, price: 250, sqm: 0.25, label: '$250', color: '#F39C12' },
  { tableId: 2, price: 1000, sqm: 1.0, label: '$1000', color: '#10b981' },
]

export default function ClubHouseCard({ house, onUpdate }) {
  const { wallet, txPending, addNotification, bnbPrice } = useGameStore()
  const [detail, setDetail] = useState(null)
  const [buying, setBuying] = useState(null) // tableId being purchased
  const [showAfter, setShowAfter] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadDetail = useCallback(async () => {
    if (!house?.id) return
    setLoading(true)
    const d = await getClubHouseWithPurchases(house.id)
    setDetail(d)
    setLoading(false)
  }, [house?.id])

  useEffect(() => { loadDetail() }, [loadDetail])

  const totalSqm = parseFloat(detail?.total_sqm || house?.total_sqm || 100)
  const purchasedSqm = detail?.purchased_sqm || 0
  const progress = totalSqm > 0 ? Math.min(purchasedSqm / totalSqm, 1) : 0
  const progressPct = (progress * 100).toFixed(1)
  const totalPrice = parseFloat(detail?.total_price || house?.total_price || 100000)

  // Автопереключение на "После покупки" если есть прогресс
  useEffect(() => {
    if (progress > 0) setShowAfter(true)
  }, [progress])

  const handleBuy = async (tier) => {
    if (!wallet) { addNotification('❌ Подключите кошелёк'); return }
    setBuying(tier.tableId)
    try {
      addNotification(`⏳ Покупка ${tier.sqm} м² за ${tier.label}...`)
      const result = await C.safeCall(() => C.buySlot(tier.tableId))
      if (result.ok) {
        addNotification(`✅ Куплено ${tier.sqm} м² за ${tier.label}!`)
        setTimeout(() => { loadDetail(); onUpdate?.() }, 2000)
      } else {
        addNotification(`❌ ${result.error}`)
      }
    } catch (err) {
      addNotification(`❌ ${err.message?.slice(0, 80)}`)
    }
    setBuying(null)
  }

  const houseName = detail?.name || house?.name || 'Клубный дом'
  const city = detail?.city || house?.city || ''
  const country = detail?.country || house?.country || ''
  const imageUrl = detail?.image_url || house?.image_url || ''
  const description = detail?.description || house?.description || ''
  const status = detail?.status || house?.status || 'planning'

  const STATUS_MAP = {
    planning: { label: 'Планируется', color: '#94a3b8', emoji: '📋' },
    building: { label: 'Строится', color: '#3b82f6', emoji: '🏗' },
    completed: { label: 'Построен', color: '#10b981', emoji: '✅' },
  }
  const st = STATUS_MAP[status] || STATUS_MAP.planning

  return (
    <div className="w-full rounded-3xl overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #e8f0fe, #f0f4ff)', border: '2px solid rgba(0,100,255,0.1)' }}>

      {/* ═══ ЗАГОЛОВОК ═══ */}
      <div className="px-5 pt-5 pb-3 text-center">
        <h2 className="text-xl font-black text-gray-900 mb-1">Купи свой дом по частям!</h2>
        <p className="text-[13px] text-gray-500">
          {houseName} {city ? `• ${city}` : ''} {country ? `, ${country}` : ''} • {totalSqm} м² • 1 м² = 1 000 $
        </p>
      </div>

      {/* ═══ ФОТО: До / После ═══ */}
      <div className="px-5 mb-4">
        <div className="relative rounded-2xl overflow-hidden" style={{ height: 220 }}>
          {imageUrl ? (
            <>
              <img src={imageUrl} alt={houseName}
                className="w-full h-full object-cover transition-all duration-700"
                style={{ filter: showAfter ? 'none' : 'grayscale(100%) brightness(0.7)' }} />
              
              {/* Toggle buttons */}
              <div className="absolute top-3 left-0 right-0 flex justify-center gap-3 z-10">
                <button onClick={() => setShowAfter(false)}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md transition-all ${!showAfter ? 'bg-white/90 text-gray-900 shadow-lg' : 'bg-black/30 text-white/80'}`}>
                  До покупки
                </button>
                <button onClick={() => setShowAfter(true)}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md transition-all ${showAfter ? 'bg-white/90 text-gray-900 shadow-lg' : 'bg-black/30 text-white/80'}`}>
                  После покупки
                </button>
              </div>

              {/* Lock icon overlay on grayscale */}
              {!showAfter && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                    <span className="text-xl">🔒</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #c7d2fe, #e0e7ff)' }}>
              <span className="text-6xl">🏠</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ СТОИМОСТЬ И СТАТУС ═══ */}
      <div className="px-5 mb-4">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-[11px] text-gray-400">Общая стоимость дома:</div>
            <div className="text-3xl font-black text-gray-900">{totalPrice.toLocaleString()} $</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-gray-400">Покупка по частям:</div>
            <div className="text-3xl font-black text-gray-900">от 50 $</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm">{st.emoji}</span>
          <span className="text-[12px] font-bold" style={{ color: st.color }}>{st.label}</span>
          {description && <span className="text-[10px] text-gray-400 ml-2">{description}</span>}
        </div>
      </div>

      {/* ═══ ПРОГРЕСС м² ═══ */}
      <div className="px-5 mb-4">
        <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-[12px] text-gray-500">Куплено:</span>
            <span className="text-[13px] font-black text-gray-900">
              {purchasedSqm.toFixed(2)} м² из {totalSqm} м² ({progressPct}%)
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
            <div className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.max(progress * 100, 1)}%`,
                background: progress >= 1
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, #3b82f6, #10b981)',
              }} />
          </div>
          {detail?.purchases?.length > 0 && (
            <div className="mt-2 text-[10px] text-gray-400">
              👥 {detail.purchases.length} покупатель(ей) участвуют
            </div>
          )}
        </div>
      </div>

      {/* ═══ КНОПКИ ПОКУПКИ ═══ */}
      <div className="px-5 pb-5">
        <div className="text-[14px] font-black text-gray-900 mb-3">Выбери свою часть</div>
        <div className="space-y-2">
          {SQM_MAP.map((tier) => (
            <button key={tier.tableId}
              onClick={() => handleBuy(tier)}
              disabled={buying !== null || txPending || !wallet}
              className="w-full py-4 px-5 rounded-2xl text-left flex items-center justify-between transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${tier.color}dd, ${tier.color}99)`,
                border: 'none',
                cursor: buying !== null ? 'wait' : 'pointer',
              }}>
              <div>
                <div className="text-[17px] font-black text-white">
                  {buying === tier.tableId ? '⏳ Покупка...' : `Купить за ${tier.label}`}
                </div>
                <div className="text-[12px] text-white/80">→ {tier.sqm} м²</div>
              </div>
              {bnbPrice > 0 && (
                <div className="text-[10px] text-white/60 text-right">
                  ≈ {(tier.price / bnbPrice).toFixed(4)} BNB
                </div>
              )}
            </button>
          ))}
        </div>

        {!wallet && (
          <div className="mt-3 p-3 rounded-xl text-center text-[11px] text-gray-400"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px dashed rgba(0,0,0,0.1)' }}>
            🔐 Подключите кошелёк для покупки
          </div>
        )}
      </div>
    </div>
  )
}
