'use client'
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import useGameStore from '@/lib/store'
import {
  SHAPES, CLARITIES, WHITE_COLORS, FANCY_COLORS, FANCY_INTENSITIES, REGIONS,
  CARAT_RANGE, formatUSD, gemSpecString
} from '@/lib/gemCatalog'
import * as Orders from '@/lib/dcOrders'
import ADDRESSES from '@/contracts/addresses'
import ShapeSVG from '@/components/ui/DiamondShapes'

const READ_RPC = 'https://opbnb-mainnet-rpc.bnbchain.org'
const readProvider = new ethers.JsonRpcProvider(READ_RPC)
const PRICE_ABI = [
  'function getPriceInfo(uint256 c, bool cert) view returns (uint256 cost, uint256 club, uint256 ws, uint256 mkt)',
  'function getRegisteredCarats() view returns (uint256[])',
]
const fmt6 = (v) => parseFloat(ethers.formatUnits(v, 6))

export default function GemConfigurator() {
  const { wallet, t, addNotification, setTxPending, txPending, dct } = useGameStore()

  const [gemType, setGemType] = useState('white')
  const [shape, setShape] = useState('round')
  const [clarity, setClarity] = useState('VS1')
  const [color, setColor] = useState('G')
  const [fancyColor, setFancyColor] = useState('fancy_yellow')
  const [intensity, setIntensity] = useState('fancy')
  const [carats, setCarats] = useState(1.0)
  const [hasCert, setHasCert] = useState(true)
  const [region, setRegion] = useState('cis')
  const [fractions, setFractions] = useState(1)
  const [totalFractions, setTotalFractions] = useState(10)
  const [buyMode, setBuyMode] = useState(1)
  const [confirmOrder, setConfirmOrder] = useState(null)
  const [myOrders, setMyOrders] = useState([])
  const [showOrders, setShowOrders] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)

  // Цены из контракта
  const [contractPrices, setContractPrices] = useState({})
  const [availableCarats, setAvailableCarats] = useState([])
  const [pricesLoading, setPricesLoading] = useState(true)

  const loadPrices = useCallback(async () => {
    setPricesLoading(true)
    try {
      const addr = ADDRESSES.FractionalGem
      if (!addr) { setPricesLoading(false); return }
      const c = new ethers.Contract(addr, PRICE_ABI, readProvider)
      const caratList = await c.getRegisteredCarats()
      const prices = {}; const available = []
      for (const ct of caratList) {
        try {
          const noCert = await c.getPriceInfo(ct, false)
          const withCert = await c.getPriceInfo(ct, true)
          const key = Number(ct); available.push(key)
          prices[key] = {
            noCert: { cost: fmt6(noCert.cost), club: fmt6(noCert.club), market: fmt6(noCert.mkt) },
            cert: { cost: fmt6(withCert.cost), club: fmt6(withCert.club), market: fmt6(withCert.mkt) },
          }
        } catch {}
      }
      available.sort((a, b) => a - b)
      setContractPrices(prices); setAvailableCarats(available)
    } catch {}
    setPricesLoading(false)
  }, [])

  useEffect(() => { loadPrices() }, [loadPrices])

  const loadOrders = useCallback(async () => {
    if (!wallet) return; setOrdersLoading(true)
    const orders = await Orders.getMyOrders(wallet)
    setMyOrders(orders); setOrdersLoading(false)
  }, [wallet])

  useEffect(() => { loadOrders() }, [loadOrders])

  // Расчёт цены интерполяцией между опорными точками из контракта
  const calcPrice = (ct, cert) => {
    if (availableCarats.length === 0) return null
    const x100 = Math.round(ct * 100)

    // Точное совпадение
    if (contractPrices[x100]) {
      const p = cert ? contractPrices[x100].cert : contractPrices[x100].noCert
      return p
    }

    // Найти две ближайшие точки (ниже и выше)
    let lower = null, upper = null
    for (const a of availableCarats) {
      if (a <= x100) lower = a
      if (a >= x100 && upper === null) upper = a
    }

    // Если ниже минимума — экстраполяция по первой точке (цена за карат)
    if (!lower && upper) {
      const p = cert ? contractPrices[upper].cert : contractPrices[upper].noCert
      const perCarat = p.club / (upper / 100)
      const club = perCarat * ct
      const market = (p.market / (upper / 100)) * ct
      return { cost: 0, club, market }
    }

    // Если выше максимума — экстраполяция по последней точке
    if (lower && !upper) {
      const p = cert ? contractPrices[lower].cert : contractPrices[lower].noCert
      const perCarat = p.club / (lower / 100)
      const club = perCarat * ct
      const market = (p.market / (lower / 100)) * ct
      return { cost: 0, club, market }
    }

    // Интерполяция между двумя точками
    if (lower && upper && lower !== upper) {
      const pL = cert ? contractPrices[lower].cert : contractPrices[lower].noCert
      const pU = cert ? contractPrices[upper].cert : contractPrices[upper].noCert
      const t = (x100 - lower) / (upper - lower) // 0..1
      const club = pL.club + (pU.club - pL.club) * t
      const market = pL.market + (pU.market - pL.market) * t
      return { cost: 0, club, market }
    }

    // lower === upper (точное совпадение, уже обработано выше)
    if (lower) {
      const p = cert ? contractPrices[lower].cert : contractPrices[lower].noCert
      return p
    }
    return null
  }

  const currentPrice = calcPrice(carats, hasCert)

  const price = currentPrice ? {
    clubPrice: Math.round(currentPrice.club),
    retailPrice: Math.round(currentPrice.market),
    clubPerCarat: Math.round(currentPrice.club / carats),
    retailPerCarat: Math.round(currentPrice.market / carats),
    savings: Math.round(currentPrice.market - currentPrice.club),
    discountPct: currentPrice.market > 0 ? Math.round((1 - currentPrice.club / currentPrice.market) * 100) : 0,
  } : null

  const fractionPrice = price ? Math.round(price.clubPrice * fractions / totalFractions) : 0

  const handleBuy = async (buyFrac = false) => {
    if (!wallet) return addNotification('❌ ' + t('connectWallet'))
    if (!price) return addNotification('❌ Цена не найдена')
    const spec = gemSpecString({
      type: gemType, shape, clarity,
      color: gemType === 'white' ? color : undefined,
      fancyColor: gemType === 'fancy' ? fancyColor : undefined,
      intensity: gemType === 'fancy' ? intensity : undefined,
      carats, hasCert, region
    })
    setConfirmOrder({
      buyFrac, fracCount: buyFrac ? fractions : 0, totalFrac: buyFrac ? totalFractions : 0,
      specString: spec, retailPrice: price.retailPrice,
      clubPrice: buyFrac ? fractionPrice : price.clubPrice,
      savings: buyFrac ? Math.round(price.savings * fractions / totalFractions) : price.savings,
      discountPct: price.discountPct,
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
      carats, hasCert, region, buyMode,
      isFraction: confirmOrder.buyFrac, fractionCount: confirmOrder.fracCount,
      totalFractions: confirmOrder.totalFrac, retailPrice: confirmOrder.retailPrice,
      clubPrice: confirmOrder.clubPrice, savings: confirmOrder.savings,
      discountPct: confirmOrder.discountPct, specString: confirmOrder.specString,
    })
    setTxPending(false)
    if (result.ok) {
      addNotification(`✅ 💎 Заказ #${result.order.id} создан! — ${formatUSD(confirmOrder.clubPrice)}`)
      setConfirmOrder(null); loadOrders()
    } else addNotification(`❌ ${result.error}`)
  }

  const sel = (active) => active
    ? 'bg-gold-400/12 border-gold-400/25 text-gold-400 shadow-lg shadow-gold-400/5'
    : 'bg-white/3 border-transparent text-slate-500 hover:bg-white/5'

  return (
    <div className="px-3 mt-2 space-y-2">

      {/* ТИП */}
      <div className="flex gap-1 p-1 rounded-2xl bg-white/5">
        <button onClick={() => setGemType('white')}
          className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${sel(gemType==='white')}`}>
          ◇ {t('gcWhiteDiamond')}
        </button>
        <button onClick={() => setGemType('fancy')}
          className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${sel(gemType==='fancy')}`}>
          🌈 {t('gcFancyDiamond')}
        </button>
      </div>

      {/* РЕГИОН */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcRegion')}</div>
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
        <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcCertificate')}</div>
        <div className="flex gap-1">
          <button onClick={() => setHasCert(true)}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold transition-all border ${sel(hasCert)}`}>
            ✅ {t('gcWithCert')}
          </button>
          <button onClick={() => setHasCert(false)}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold transition-all border ${sel(!hasCert)}`}>
            — {t('gcNoCert')}
          </button>
        </div>
        <div className="mt-1.5 text-[8px] text-slate-600 text-center">
          Сертификат не влияет на качество — только на цену. GIA / IGI / HRD
        </div>
      </div>

      {/* ФОРМА — ОРИГИНАЛЬНЫЙ ДИЗАЙН С ИЗОБРАЖЕНИЯМИ */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcShape')}</div>
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

      {/* ЧИСТОТА */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcClarity')}</div>
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

      {/* ЦВЕТ БЕЛЫХ — ОРИГИНАЛЬНЫЙ ДИЗАЙН С ЦВЕТНЫМИ КРУЖОЧКАМИ */}
      {gemType === 'white' && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcColor')}</div>
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

      {/* ЦВЕТ + ИНТЕНСИВНОСТЬ ЦВЕТНЫХ — ОРИГИНАЛЬНЫЙ ДИЗАЙН */}
      {gemType === 'fancy' && (
        <>
          <div className="p-3 rounded-2xl glass">
            <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcFancyColor')}</div>
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
            <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t('gcIntensity')}</div>
            <div className="flex gap-1">
              {FANCY_INTENSITIES.map(fi => {
                const fc = FANCY_COLORS.find(c => c.id === fancyColor)
                const op = fi.id==='faint'?0.3 : fi.id==='light'?0.5 : fi.id==='fancy'?0.7 : 1
                return (
                  <button key={fi.id} onClick={() => setIntensity(fi.id)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[8px] font-bold transition-all border ${sel(intensity===fi.id)}`}>
                    <div className="w-3.5 h-3.5 rounded-full border border-white/10" style={{background:fc?.hex||'#fff', opacity:op}} />
                    <span>{fi.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* КАРАТЫ — ПОЛЗУНОК + БЫСТРЫЕ КНОПКИ */}
      <div className="p-3 rounded-2xl glass">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('gcCarats')}</div>
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

      {/* ═══ ЦЕНА ═══ */}
      {pricesLoading ? (
        <div className="p-4 rounded-2xl glass text-center">
          <div className="text-[11px] text-slate-500">⏳ Загрузка цен из контракта...</div>
        </div>
      ) : price ? (
        <div className="p-3 rounded-2xl border border-gold-400/20"
          style={{background:'linear-gradient(135deg, rgba(255,215,0,0.05), rgba(255,215,0,0.02))'}}>

          {/* Конфигурация */}
          <div className="flex items-center gap-2 mb-3">
            <ShapeSVG shape={shape} size={36} active={true} />
            <div className="flex-1">
              <div className="text-[11px] font-bold text-white">
                {gemType==='white'
                  ? `${t(`shape_${shape}`)||SHAPES.find(s=>s.id===shape)?.name} ${color} ${clarity}`
                  : `${FANCY_COLORS.find(c=>c.id===fancyColor)?.name} ${FANCY_INTENSITIES.find(i=>i.id===intensity)?.name}`
                }
              </div>
              <div className="text-[9px] text-slate-500">
                {carats.toFixed(2)} ct • {hasCert ? '✅ Сертификат' : 'Без серт.'} • {REGIONS.find(r=>r.id===region)?.name}
              </div>
            </div>
          </div>

          {/* 3 цены */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <div className="p-2 rounded-xl bg-white/5 text-center">
              <div className="text-[7px] text-slate-600 mb-0.5">{t('gcRetailPrice') || 'Рыночная'}</div>
              <div className="text-[12px] font-bold text-slate-400 line-through">
                {formatUSD(price.retailPrice)}
              </div>
              <div className="text-[7px] text-slate-600">{formatUSD(price.retailPerCarat)}/ct</div>
            </div>
            <div className="p-2 rounded-xl bg-gold-400/8 border border-gold-400/15 text-center">
              <div className="text-[7px] text-gold-400/70 mb-0.5">{t('gcClubPrice') || 'Цена клуба'}</div>
              <div className="text-[15px] font-black text-gold-400">
                {formatUSD(price.clubPrice)}
              </div>
              <div className="text-[7px] text-gold-400/60">{formatUSD(price.clubPerCarat)}/ct</div>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-center">
              <div className="text-[7px] text-emerald-400/70 mb-0.5">{t('gcSavings') || 'Экономия'}</div>
              <div className="text-[13px] font-black text-emerald-400">
                −{formatUSD(price.savings)}
              </div>
              <div className="text-[7px] text-emerald-400/60">−{price.discountPct}%</div>
            </div>
          </div>

          {/* Режим покупки */}
          <div className="flex gap-1 mb-2">
            <button onClick={() => setBuyMode(0)}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                buyMode===0?'bg-blue-500/15 border-blue-500/30 text-blue-400':'border-white/8 text-slate-500'}`}>
              📦 Покупка (владение)
            </button>
            <button onClick={() => setBuyMode(1)}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                buyMode===1?'bg-emerald-500/15 border-emerald-500/30 text-emerald-400':'border-white/8 text-slate-500'}`}>
              ⏳ Актив (стейкинг)
            </button>
          </div>

          {/* Заказать */}
          <button onClick={() => handleBuy(false)} disabled={txPending || !wallet}
            className="w-full py-3 rounded-xl text-[12px] font-bold gold-btn mb-1.5"
            style={{opacity: (txPending||!wallet) ? 0.5 : 1}}>
            {txPending ? '⏳...' : `💎 ${t('gcBuyFull') || 'Заказать'} — ${formatUSD(price.clubPrice)}`}
          </button>

          {/* Купить долями */}
          <div className="flex gap-1.5 items-center">
            <div className="flex items-center gap-1 flex-1 p-2 rounded-xl bg-white/5">
              <input type="number" min={1} max={totalFractions-1} value={fractions}
                onChange={e => setFractions(Math.min(totalFractions-1, Math.max(1, parseInt(e.target.value)||1)))}
                className="w-12 bg-transparent text-white text-[11px] font-bold outline-none text-center" />
              <span className="text-[9px] text-slate-500">/</span>
              <input type="number" min={2} max={100} value={totalFractions}
                onChange={e => setTotalFractions(Math.max(2, parseInt(e.target.value)||10))}
                className="w-12 bg-transparent text-white text-[11px] font-bold outline-none text-center" />
              <span className="text-[8px] text-slate-500">{t('gcFractions') || 'долей'}</span>
            </div>
            <button onClick={() => handleBuy(true)} disabled={txPending||!wallet}
              className="py-2 px-3 rounded-xl text-[10px] font-bold border border-purple-500/25 bg-purple-500/10 text-purple-400">
              {formatUSD(fractionPrice)}
            </button>
          </div>
        </div>
      ) : availableCarats.length === 0 ? (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
          <div className="text-[11px] text-red-400">❌ Цены ещё не загружены в контракт</div>
        </div>
      ) : null}

      <div className="p-2.5 rounded-2xl bg-white/3">
        <div className="text-[9px] text-slate-500 text-center leading-relaxed">
          {t('gcDisclaimer') || 'Камни заказываются от завода. Сертификаты GIA, IGI, HRD — проверяйте по номеру на сайте лаборатории.'}
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
                    <span className="text-[9px] text-slate-500 ml-2">{o.carats}ct • {o.has_cert ? '✅' : '—'}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-bold text-gold-400">${parseFloat(o.club_price).toFixed(0)}</div>
                    <div className={`text-[9px] font-bold ${Orders.STATUS_COLORS[o.status] || 'text-slate-400'}`}>
                      {Orders.STATUS_LABELS[o.status] || o.status}</div>
                  </div>
                </div>
              </div>
            ))}</div>
          ))}
        </div>
      )}

      {/* Модалка подтверждения заказа */}
      {confirmOrder && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={() => setConfirmOrder(null)}>
          <div className="w-full max-w-sm p-4 rounded-2xl glass" onClick={e => e.stopPropagation()} style={{background:'var(--bg-card,#1e1e3a)'}}>
            <div className="text-center mb-3">
              <div className="text-3xl mb-2">💎</div>
              <div className="text-[14px] font-black text-white">Подтверждение заказа</div>
              <div className="text-[10px] text-slate-500 mt-1">Камень будет подобран или изготовлен под заказ</div>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                <span className="text-[10px] text-slate-400">Параметры</span>
                <span className="text-[10px] font-bold text-white">{confirmOrder.specString}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                <span className="text-[10px] text-slate-400">Рыночная</span>
                <span className="text-[11px] font-bold text-slate-400 line-through">{formatUSD(confirmOrder.retailPrice)}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-gold-400/8 border border-gold-400/15">
                <span className="text-[10px] text-gold-400">Цена клуба</span>
                <span className="text-[14px] font-black text-gold-400">{formatUSD(confirmOrder.clubPrice)}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                <span className="text-[10px] text-emerald-400">Экономия</span>
                <span className="text-[12px] font-black text-emerald-400">−{formatUSD(confirmOrder.savings)} (−{confirmOrder.discountPct}%)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                <span className="text-[10px] text-slate-400">Режим</span>
                <span className={`text-[11px] font-bold ${buyMode===0?'text-blue-400':'text-emerald-400'}`}>
                  {buyMode===0?'📦 Покупка':'⏳ Стейкинг'}</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-blue-500/8 border border-blue-500/15 mb-3">
              <div className="text-[9px] text-blue-300 text-center">💡 После оплаты заказ проверяется и отправляется на завод.</div>
            </div>
            <button onClick={executeOrder} disabled={txPending}
              className="w-full py-3 rounded-xl text-sm font-bold gold-btn" style={{opacity:txPending?0.5:1}}>
              {txPending ? '⏳ ...' : `💎 Оплатить — ${formatUSD(confirmOrder.clubPrice)}`}</button>
            <button onClick={() => setConfirmOrder(null)}
              className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold text-slate-500 border border-white/8">Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}
