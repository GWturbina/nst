'use client'
/**
 * GemConfigurator (v2) — Конфигуратор бриллиантов под универсальную модель цен
 *
 * МОДЕЛЬ:
 *  Цены в Supabase (dc_prices) — это БАЗА (35% от рынка) = закупочная цена клуба.
 *  Из неё считаются 4 цены для покупателя:
 *    1. Закупка клуба (35%)         — справочно
 *    2. На рынке (100% = база÷0.35) — справочно, для сравнения
 *    3. Купить себе (50% от рынка)  — через ClubMarket, уровень 1+
 *    4. Со скидкой -5% за GST       — то же, с NSS-купоном
 *    5. Заказать долю/актив (база÷0.85) — через ClubPools, уровень 7+
 *       (партнёр платит +15% контрактных накруток: 5% реклама + 10% маркетинг)
 *
 * Источник цен — ТОЛЬКО Supabase (контракт FractionalGem удалён в v2.4).
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import {
  SHAPES, CLARITIES, WHITE_COLORS, FANCY_COLORS, FANCY_INTENSITIES, REGIONS,
  CARAT_RANGE, formatUSD, gemSpecString
} from '@/lib/gemCatalog'
import * as Orders from '@/lib/dcOrders'
import ShapeSVG from '@/components/ui/DiamondShapes'
import HelpButton from '@/components/ui/HelpButton'

// ═══════════════════════════════════════════════════════
// Коэффициенты влияния чистоты и цвета на цену
// (применяются к базовой цене из Supabase)
// ═══════════════════════════════════════════════════════
const CLARITY_COEFF = { IF: 1.05, VVS1: 1.03, VVS2: 1.02, VS1: 1.01, VS2: 1.00 }
const COLOR_COEFF   = { D: 1.05, E: 1.04, F: 1.03, G: 1.02, H: 1.01, I: 1.00 }

// Premium tier — наценка к Standard ценам в превью (если в Supabase нет premium)
const PREMIUM_FALLBACK_MULT = 1.08

export default function GemConfigurator() {
  const { wallet, t, addNotification, setTxPending, txPending } = useGameStore()

  // Селекторы конфигурации
  const [gemType, setGemType] = useState('white')
  const [shape, setShape] = useState('round')
  const [clarity, setClarity] = useState('VS1')
  const [color, setColor] = useState('G')
  const [fancyColor, setFancyColor] = useState('fancy_yellow')
  const [intensity, setIntensity] = useState('fancy')
  const [carats, setCarats] = useState(1.0)
  const [hasCert, setHasCert] = useState(true)
  const [region, setRegion] = useState('cis')
  const [qualityTier, setQualityTier] = useState('standard') // standard | premium

  // Цены из Supabase
  const [supabasePrices, setSupabasePrices] = useState(null)

  // Заказ и подтверждение
  const [confirmOrder, setConfirmOrder] = useState(null)
  const [myOrders, setMyOrders] = useState([])
  const [showOrders, setShowOrders] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)

  // ═══ Загрузка цен из Supabase ═══
  useEffect(() => {
    fetch('/api/prices').then(r => r.json()).then(d => {
      if (d.ok) setSupabasePrices(d.prices)
    }).catch(() => {})
  }, [])

  // ═══ Загрузка моих заказов ═══
  const loadOrders = useCallback(async () => {
    if (!wallet) return
    setOrdersLoading(true)
    try {
      const orders = await Orders.getMyOrders(wallet)
      setMyOrders(orders || [])
    } catch {}
    setOrdersLoading(false)
  }, [wallet])

  useEffect(() => { loadOrders() }, [loadOrders])

  // ═══════════════════════════════════════════════════════
  // РАСЧЁТ БАЗОВОЙ ЦЕНЫ (35% = закупка клуба)
  // ═══════════════════════════════════════════════════════
  const calcBase = (ct, cert, tier) => {
    if (!supabasePrices) return 0

    let tierPrices = supabasePrices[tier === 'premium' ? 'club_premium' : 'club_standard']
    let useFallbackMult = false

    // Если premium нет — используем standard × 1.08
    if (tier === 'premium' && (!tierPrices || Object.keys(tierPrices).length === 0)) {
      tierPrices = supabasePrices.club_standard
      useFallbackMult = true
    }
    if (!tierPrices) return 0

    const points = Object.keys(tierPrices).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b)
    if (points.length === 0) return 0

    const field = cert ? 'cert' : 'noCert'

    // Точное совпадение
    const exactKey = ct.toFixed(2)
    if (tierPrices[exactKey] != null) {
      const p = tierPrices[exactKey][field] || 0
      return useFallbackMult ? Math.round(p * PREMIUM_FALLBACK_MULT) : p
    }

    // Поиск двух ближайших точек для интерполяции
    let lower = null, upper = null
    for (const p of points) {
      if (p <= ct) lower = p
      if (p >= ct && upper === null) upper = p
    }

    let result = 0
    if (lower !== null && upper !== null && lower !== upper) {
      // Линейная интерполяция между двумя точками
      const lP = tierPrices[lower.toFixed(2)]?.[field] || 0
      const uP = tierPrices[upper.toFixed(2)]?.[field] || 0
      const r = (ct - lower) / (upper - lower)
      result = Math.round(lP + (uP - lP) * r)
    } else if (lower !== null) {
      // Только нижняя точка — экстраполируем по pro-rate
      const p = tierPrices[lower.toFixed(2)]?.[field] || 0
      result = Math.round((p / lower) * ct)
    } else if (upper !== null) {
      // Только верхняя — экстраполируем
      const p = tierPrices[upper.toFixed(2)]?.[field] || 0
      result = Math.round((p / upper) * ct)
    }

    return useFallbackMult ? Math.round(result * PREMIUM_FALLBACK_MULT) : result
  }

  // ═══════════════════════════════════════════════════════
  // ИТОГОВАЯ БАЗА с учётом чистоты и цвета
  // ═══════════════════════════════════════════════════════
  const clarityMult = gemType === 'white' ? (CLARITY_COEFF[clarity] || 1.0) : 1.0
  const colorMult   = gemType === 'white' ? (COLOR_COEFF[color] || 1.0)   : 1.0
  const totalMult   = clarityMult * colorMult

  const baseRaw = calcBase(carats, hasCert, qualityTier)
  const base    = Math.round(baseRaw * totalMult)        // 35% — закупка клуба
  const market  = Math.round(base / 0.35)                // 100% — на рынке
  const shop    = Math.round(market * 0.50)              // 50% — купить себе
  const shopGst = Math.round(shop * 0.95)                // -5% за тапалку
  const share   = Math.round(base / 0.85)                // партнёр платит за долю (+15% накруток)

  const haveBase = base > 0

  // ═══════════════════════════════════════════════════════
  // СОЗДАНИЕ ЗАКАЗА
  // ═══════════════════════════════════════════════════════
  const openConfirm = (orderType) => {
    if (!wallet) return addNotification('❌ Подключите кошелёк')
    if (!haveBase) return addNotification('❌ Цена не определена — проверьте параметры')

    const spec = gemSpecString({
      type: gemType, shape, clarity,
      color: gemType === 'white' ? color : undefined,
      fancyColor: gemType === 'fancy' ? fancyColor : undefined,
      intensity: gemType === 'fancy' ? intensity : undefined,
      carats, hasCert, region,
    })

    // orderType: 'self' = купить себе (50%) | 'share' = заказать актив (база/0.85)
    const finalPrice = orderType === 'self' ? shop : share
    const requiredLevel = orderType === 'self' ? 1 : 7
    const description = orderType === 'self'
      ? 'Покупка камня себе через магазин клуба (50% от рынка)'
      : 'Заказ камня как актива через пул (партнёр платит +5% реклама + 10% маркетинг)'

    setConfirmOrder({
      orderType, requiredLevel, description,
      specString: spec,
      base, market, shop, shopGst, share,
      finalPrice,
    })
  }

  const executeOrder = async () => {
    if (!confirmOrder) return
    setTxPending(true)
    const result = await Orders.createOrder(wallet, {
      gemType, shape, clarity,
      color: gemType === 'white' ? color : null,
      fancyColor: gemType === 'fancy' ? fancyColor : null,
      intensity: gemType === 'fancy' ? intensity : null,
      carats, hasCert, region,
      buyMode: confirmOrder.orderType === 'self' ? 0 : 1,  // 0=self, 1=share/asset
      qualityTier,
      isFraction: confirmOrder.orderType === 'share',
      retailPrice: confirmOrder.market,
      clubPrice: confirmOrder.finalPrice,
      savings: confirmOrder.market - confirmOrder.finalPrice,
      discountPct: Math.round((1 - confirmOrder.finalPrice / confirmOrder.market) * 100),
      specString: confirmOrder.specString,
    })
    setTxPending(false)
    if (result.ok) {
      addNotification(`✅ Заказ #${result.order.id} создан!`)
      setConfirmOrder(null)
      loadOrders()
    } else {
      addNotification(`❌ ${result.error}`)
    }
  }

  // helper для подсветки активной кнопки
  const sel = (active) => active
    ? 'bg-gold-400/12 border-gold-400/25 text-gold-400 shadow-lg shadow-gold-400/5'
    : 'bg-white/3 border-transparent text-slate-500 hover:bg-white/5'

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div className="px-3 mt-2 space-y-2">

      <div className="flex items-center justify-between">
        <div className="text-[14px] font-black text-gold-400">💎 Конфигуратор</div>
        <HelpButton section="gems" />
      </div>

      {/* ТИП КАМНЯ */}
      <div className="flex gap-1 p-1 rounded-2xl bg-white/5">
        <button onClick={() => setGemType('white')}
          className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${sel(gemType==='white')}`}>
          ◇ {t('gcWhiteDiamond') || 'Белый бриллиант'}
        </button>
        <button onClick={() => setGemType('fancy')}
          className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${sel(gemType==='fancy')}`}>
          🌈 {t('gcFancyDiamond') || 'Цветной бриллиант'}
        </button>
      </div>

      {/* РЕГИОН (информационно) */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcRegion') || 'Регион покупки'}</div>
        <div className="flex gap-1">
          {REGIONS.map(r => (
            <button key={r.id} onClick={() => setRegion(r.id)}
              className={`flex-1 py-2 rounded-xl text-[9px] font-bold transition-all border ${sel(region===r.id)}`}>
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* СЕРТИФИКАТ */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcCertificate') || 'Сертификат'}</div>
        <div className="flex gap-1">
          <button onClick={() => setHasCert(true)}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold transition-all border ${sel(hasCert)}`}>
            ✅ С сертификатом
          </button>
          <button onClick={() => setHasCert(false)}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold transition-all border ${sel(!hasCert)}`}>
            — Без сертификата
          </button>
        </div>
        <div className="mt-1.5 text-[8px] text-slate-600 text-center">
          Сертификат не влияет на качество — только на цену. GIA / IGI / HRD
        </div>
      </div>

      {/* TIER КАЧЕСТВА */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Ценовая категория</div>
        <div className="flex gap-1">
          <button onClick={() => setQualityTier('standard')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold transition-all border ${sel(qualityTier==='standard')}`}>
            💎 Стандарт
          </button>
          <button onClick={() => setQualityTier('premium')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold transition-all border ${sel(qualityTier==='premium')}`}>
            👑 Премиум
          </button>
        </div>
        <div className="mt-1.5 text-[8px] text-slate-600 text-center">
          {qualityTier === 'premium'
            ? 'Премиум — лучшие характеристики (Cut/Polish/Symmetry: Excellent), выше цена'
            : 'Стандарт — оптимальное соотношение цена/качество'}
        </div>
      </div>

      {/* ФОРМА ОГРАНКИ */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcShape') || 'Форма огранки'}</div>
        <div className="grid grid-cols-3 gap-1.5">
          {SHAPES.map(s => (
            <button key={s.id} onClick={() => setShape(s.id)}
              className={`flex flex-col items-center py-2.5 rounded-xl transition-all border ${sel(shape===s.id)}`}>
              {s.img ? (
                <div className="w-12 h-12 flex items-center justify-center transition-all duration-300"
                  style={{
                    filter: shape === s.id
                      ? 'brightness(1.15) drop-shadow(0 0 8px rgba(255,215,0,0.7))'
                      : 'brightness(0.45) grayscale(0.3)',
                  }}>
                  <img src={`/images/gems/${s.img}`} alt={s.name}
                    className="w-full h-full object-contain"
                    onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
                  <div className="hidden w-full h-full items-center justify-center">
                    <ShapeSVG shape={s.id} size={48} active={shape===s.id} />
                  </div>
                </div>
              ) : (
                <ShapeSVG shape={s.id} size={48} active={shape===s.id} />
              )}
              <span className="text-[9px] mt-1 font-bold">{t(`shape_${s.id}`) || s.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ЧИСТОТА (только для white) */}
      {gemType === 'white' && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcClarity') || 'Чистота'}</div>
          <div className="flex gap-1">
            {CLARITIES.map(c => (
              <button key={c.id} onClick={() => setClarity(c.id)}
                className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-all border ${sel(clarity===c.id)}`}>
                {c.id}
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-[9px] text-slate-500 text-center">
            {CLARITIES.find(c => c.id === clarity)?.descRu}
          </div>
        </div>
      )}

      {/* ЦВЕТ БЕЛЫХ */}
      {gemType === 'white' && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcColor') || 'Цвет'}</div>
          <div className="flex gap-1">
            {WHITE_COLORS.map((c, i) => {
              const warm = i * 12
              const bg = `rgb(${255-warm*0.2},${255-warm*0.5},${255-warm*1.5})`
              return (
                <button key={c.id} onClick={() => setColor(c.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all border ${sel(color===c.id)}`}>
                  <div className="w-3.5 h-3.5 rounded-full border border-white/15" style={{background:bg}} />
                  <span className="text-[9px] font-bold">{c.id}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-1.5 text-[9px] text-slate-500 text-center">
            {WHITE_COLORS.find(c => c.id === color)?.descRu}
          </div>
        </div>
      )}

      {/* ЦВЕТ ФАНТАЗИЙНЫХ */}
      {gemType === 'fancy' && (
        <>
          <div className="p-3 rounded-2xl glass">
            <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcFancyColor') || 'Цвет'}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {FANCY_COLORS.map(fc => (
                <button key={fc.id} onClick={() => setFancyColor(fc.id)}
                  className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all border ${sel(fancyColor===fc.id)}`}
                  style={fancyColor===fc.id ? {background:`${fc.hex}15`, boxShadow:`0 4px 15px ${fc.hex}20`} : {}}>
                  <div className="w-5 h-5 rounded-full border border-white/15" style={{background:fc.hex}} />
                  <span className="text-[8px] font-bold">{fc.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-2xl glass">
            <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Интенсивность</div>
            <div className="grid grid-cols-3 gap-1">
              {FANCY_INTENSITIES.map(fi => (
                <button key={fi.id} onClick={() => setIntensity(fi.id)}
                  className={`py-1.5 rounded-xl text-[9px] font-bold transition-all border ${sel(intensity===fi.id)}`}>
                  {fi.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* КАРАТЫ */}
      <div className="p-3 rounded-2xl glass">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('gcCarats') || 'Караты'}</div>
          <div className="text-[14px] font-black text-gold-400">{carats.toFixed(2)} ct</div>
        </div>
        <input type="range" min={CARAT_RANGE.min} max={CARAT_RANGE.max} step={CARAT_RANGE.step}
          value={carats} onChange={e => setCarats(parseFloat(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{background:`linear-gradient(to right, #ffd700 ${(carats-CARAT_RANGE.min)/(CARAT_RANGE.max-CARAT_RANGE.min)*100}%, rgba(255,255,255,0.08) 0%)`}} />
        <div className="flex justify-between mt-1 text-[9px] text-slate-600">
          <span>{CARAT_RANGE.min} ct</span><span>{CARAT_RANGE.max} ct</span>
        </div>
        <div className="flex gap-1 mt-2">
          {[0.3, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0].map(v => (
            <button key={v} onClick={() => setCarats(v)}
              className={`flex-1 py-1 rounded-lg text-[9px] font-bold transition-all border ${sel(Math.abs(carats-v)<0.05)}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ БЛОК ЦЕН (новая структура) ═══ */}
      {!supabasePrices ? (
        <div className="p-4 rounded-2xl glass text-center">
          <div className="text-[11px] text-slate-500">⏳ Загрузка цен...</div>
        </div>
      ) : !haveBase ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
          <div className="text-[11px] text-amber-400">⚠️ Для этой комбинации цена не задана</div>
          <div className="text-[9px] text-amber-400/70 mt-1">Добавь цену в админке для {carats.toFixed(2)}ct</div>
        </div>
      ) : (
        <div className="space-y-2">

          {/* Сводка камня */}
          <div className="p-3 rounded-2xl border border-gold-400/20"
            style={{background:'linear-gradient(135deg, rgba(255,215,0,0.05), rgba(255,215,0,0.02))'}}>
            <div className="flex items-center gap-2 mb-2">
              <ShapeSVG shape={shape} size={36} active={true} />
              <div className="flex-1">
                <div className="text-[11px] font-bold text-white">
                  {gemType==='white'
                    ? `${SHAPES.find(s=>s.id===shape)?.name || shape} ${color} ${clarity}`
                    : `${FANCY_COLORS.find(c=>c.id===fancyColor)?.name} ${FANCY_INTENSITIES.find(i=>i.id===intensity)?.name}`
                  }
                </div>
                <div className="text-[9px] text-slate-500">
                  {carats.toFixed(2)} ct • {hasCert ? '✅ Сертификат' : 'Без серт.'} • {qualityTier==='premium'?'👑 Премиум':'💎 Стандарт'}
                </div>
              </div>
            </div>

            {/* 4 цены столбиком — наглядно */}
            <div className="space-y-1.5">
              <PriceLine label="На рынке (100%)"            value={market}  color="text-slate-500" strike note="справочно" />
              <PriceLine label="🛒 Купить себе (50%)"        value={shop}    color="text-emerald-400" bold note="через магазин · 1+ уровень" />
              <PriceLine label="🛒 Со скидкой -5% за GST"    value={shopGst} color="text-emerald-300" note="натапай купон в шахте" />
              <PriceLine label="📈 Заказать долю/актив"      value={share}   color="text-gold-400" bold note={`база ${formatUSD(base)} + 5% реклама + 10% маркетинг · 7+ уровень`} />
            </div>
          </div>

          {/* 2 кнопки покупки */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => openConfirm('self')} disabled={txPending || !wallet}
              className="py-3 rounded-2xl text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 disabled:opacity-50">
              🛒 Купить себе<br/>
              <span className="text-[14px] font-black">{formatUSD(shop)}</span>
            </button>
            <button onClick={() => openConfirm('share')} disabled={txPending || !wallet}
              className="py-3 rounded-2xl text-[11px] font-bold bg-gold-400/12 border border-gold-400/30 text-gold-400 disabled:opacity-50">
              📈 Заказать актив<br/>
              <span className="text-[14px] font-black">{formatUSD(share)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Дисклеймер */}
      <div className="p-2.5 rounded-2xl bg-white/3">
        <div className="text-[9px] text-slate-500 text-center leading-relaxed">
          {t('gcDisclaimer') || 'Камни заказываются от завода. Сертификаты GIA, IGI, HRD — проверяются по номеру на сайте лаборатории.'}
        </div>
      </div>

      {/* Мои заказы */}
      {wallet && (
        <div className="p-3 rounded-2xl glass">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-bold text-blue-400">📋 Мои заказы ({myOrders.length})</div>
            <button onClick={() => { setShowOrders(!showOrders); if (!showOrders) loadOrders() }}
              className="text-[10px] text-blue-400 font-bold">{showOrders ? '✕ Скрыть' : '👁 Показать'}</button>
          </div>
          {showOrders && (ordersLoading ? (
            <div className="text-center py-3 text-[11px] text-slate-500">⏳ Загрузка...</div>
          ) : myOrders.length === 0 ? (
            <div className="text-center py-3 text-[11px] text-slate-500">У вас пока нет заказов</div>
          ) : (
            <div className="space-y-1.5">{myOrders.slice(0, 10).map(o => (
              <div key={o.id} className="p-2 rounded-lg bg-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-white">#{o.id}</span>
                    <span className="text-[9px] text-slate-500 ml-2">
                      {o.carats}ct • {o.has_cert ? '✅' : '—'} • {o.buy_mode === 0 ? '🛒 себе' : '📈 актив'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-bold text-gold-400">${parseFloat(o.club_price).toFixed(0)}</div>
                    <div className={`text-[9px] font-bold ${Orders.STATUS_COLORS?.[o.status] || 'text-slate-400'}`}>
                      {Orders.STATUS_LABELS?.[o.status] || o.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}</div>
          ))}
        </div>
      )}

      {/* МОДАЛКА ПОДТВЕРЖДЕНИЯ */}
      {confirmOrder && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={() => setConfirmOrder(null)}>
          <div className="w-full max-w-sm p-4 rounded-2xl glass" onClick={e => e.stopPropagation()}
            style={{background:'var(--bg-card,#1e1e3a)'}}>

            <div className="text-center mb-3">
              <div className="text-3xl mb-2">{confirmOrder.orderType === 'self' ? '🛒' : '📈'}</div>
              <div className="text-[14px] font-black text-white">
                {confirmOrder.orderType === 'self' ? 'Купить себе' : 'Заказать актив'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Требуется уровень <b className="text-gold-400">{confirmOrder.requiredLevel}+</b> в GlobalWay
              </div>
            </div>

            <div className="text-[10px] text-slate-400 mb-3 p-2 rounded-xl bg-blue-500/8 border border-blue-500/15">
              💡 {confirmOrder.description}
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                <span className="text-[10px] text-slate-400">Параметры</span>
                <span className="text-[10px] font-bold text-white text-right">{confirmOrder.specString}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                <span className="text-[10px] text-slate-400">На рынке</span>
                <span className="text-[11px] font-bold text-slate-400 line-through">{formatUSD(confirmOrder.market)}</span>
              </div>
              {confirmOrder.orderType === 'share' && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-blue-500/8 border border-blue-500/15">
                  <span className="text-[10px] text-blue-300">Закупка клуба (база)</span>
                  <span className="text-[11px] font-bold text-blue-300">{formatUSD(confirmOrder.base)}</span>
                </div>
              )}
              <div className={`flex items-center justify-between p-2 rounded-xl border ${
                confirmOrder.orderType === 'self'
                  ? 'bg-emerald-500/8 border-emerald-500/20'
                  : 'bg-gold-400/8 border-gold-400/20'
              }`}>
                <span className={`text-[10px] ${confirmOrder.orderType === 'self' ? 'text-emerald-400' : 'text-gold-400'}`}>
                  Ты платишь
                </span>
                <span className={`text-[16px] font-black ${confirmOrder.orderType === 'self' ? 'text-emerald-400' : 'text-gold-400'}`}>
                  {formatUSD(confirmOrder.finalPrice)}
                </span>
              </div>
            </div>

            <button onClick={executeOrder} disabled={txPending}
              className="w-full py-3 rounded-xl text-sm font-bold gold-btn"
              style={{opacity:txPending?0.5:1}}>
              {txPending ? '⏳ ...' : `Создать заказ — ${formatUSD(confirmOrder.finalPrice)}`}
            </button>
            <button onClick={() => setConfirmOrder(null)}
              className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold text-slate-500 border border-white/8">
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Строка цены в блоке цен
// ═══════════════════════════════════════════════════════
function PriceLine({ label, value, color, bold, strike, note }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-slate-300">{label}</div>
        {note && <div className="text-[8px] text-slate-500 leading-tight mt-0.5">{note}</div>}
      </div>
      <div className={`${color} ${bold ? 'font-black text-[13px]' : 'font-bold text-[11px]'} ${strike ? 'line-through' : ''} whitespace-nowrap`}>
        {formatUSD(value)}
      </div>
    </div>
  )
}
