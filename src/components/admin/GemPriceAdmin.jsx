'use client'
/**
 * GemPriceAdmin — Управление ценами бриллиантов (v2)
 *
 * МОДЕЛЬ ЦЕНООБРАЗОВАНИЯ:
 *  Цена в этой админке = БАЗОВАЯ цена (35% от рынка) = закупочная цена клуба у завода.
 *  Из неё конфигуратор автоматически считает 3 цены для покупателя:
 *   • Купить себе целиком (через ClubMarket)        : ~50% от рынка   = база × 1.4286
 *   • Купить себе со скидкой -5% (тапалка)           : ~47.5% от рынка = база × 1.357
 *   • Заказать долю / купить как актив (через пул)  : 35% от рынка    = база
 *     (партнёр платит база / 0.85, потому что в контракте +5% реклама +10% маркетинг)
 *
 * 4 столбца: Standard (без серт / с серт) и Premium (без серт / с серт).
 * Premium — для камней лучшей огранки (Cut/Polish/Symmetry: Excellent),
 * наценка ~10% к Standard.
 *
 * Сохраняется в Supabase таблицу dc_prices через POST /api/prices.
 * Конфигуратор тянет цены через GET /api/prices.
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { authFetch } from '@/lib/authClient'
import { formatUSD } from '@/lib/gemCatalog'

const TIER_KEYS = ['club_standard', 'club_premium']
const TIER_LABELS = {
  club_standard: '💎 Стандарт',
  club_premium: '👑 Премиум',
}

// Дефолтные караты (можно добавлять/удалять)
const DEFAULT_CARATS = ['0.30', '0.50', '1.00', '1.50', '2.00', '2.50', '3.00']

export default function GemPriceAdmin() {
  const { wallet, addNotification } = useGameStore()
  const [prices, setPrices] = useState({ club_standard: {}, club_premium: {} })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [newCarat, setNewCarat] = useState('')

  // ═══ Загрузка цен из Supabase ═══
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/prices')
      const data = await res.json()
      if (data.ok && data.prices) {
        setPrices({
          club_standard: data.prices.club_standard || {},
          club_premium: data.prices.club_premium || {},
        })
      }
    } catch {
      addNotification('❌ Ошибка загрузки цен')
    }
    setLoading(false)
  }, [addNotification])

  useEffect(() => { load() }, [load])

  // ═══ Получить отсортированный список каратов (объединяя обе категории) ═══
  const allCarats = (() => {
    const set = new Set([
      ...Object.keys(prices.club_standard || {}),
      ...Object.keys(prices.club_premium || {}),
    ])
    if (set.size === 0) DEFAULT_CARATS.forEach(c => set.add(c))
    return [...set].map(c => parseFloat(c)).sort((a, b) => a - b).map(c => c.toFixed(2))
  })()

  // ═══ Изменить ячейку ═══
  const updateCell = (tier, carat, field, value) => {
    const v = parseInt(value) || 0
    setPrices(p => ({
      ...p,
      [tier]: {
        ...(p[tier] || {}),
        [carat]: {
          noCert: p[tier]?.[carat]?.noCert || 0,
          cert: p[tier]?.[carat]?.cert || 0,
          [field]: v,
        },
      },
    }))
    setDirty(true)
  }

  // ═══ Добавить карат ═══
  const addCarat = () => {
    const c = parseFloat(newCarat)
    if (isNaN(c) || c <= 0 || c > 50) {
      addNotification('❌ Карат: число от 0.01 до 50')
      return
    }
    const key = c.toFixed(2)
    if (allCarats.includes(key)) {
      addNotification('⚠️ Такой карат уже есть')
      return
    }
    setPrices(p => ({
      club_standard: { ...p.club_standard, [key]: { noCert: 0, cert: 0 } },
      club_premium: { ...p.club_premium, [key]: { noCert: 0, cert: 0 } },
    }))
    setDirty(true)
    setNewCarat('')
  }

  // ═══ Удалить карат ═══
  const removeCarat = (carat) => {
    if (!confirm(`Удалить карат ${carat} из обеих категорий?`)) return
    setPrices(p => {
      const std = { ...p.club_standard }; delete std[carat]
      const prm = { ...p.club_premium }; delete prm[carat]
      return { club_standard: std, club_premium: prm }
    })
    setDirty(true)
  }

  // ═══ Сохранить в Supabase ═══
  const handleSave = async () => {
    if (!wallet) { addNotification('❌ Кошелёк не подключён'); return }
    setSaving(true)
    try {
      // Сохраняем обе категории отдельными запросами
      for (const tier of TIER_KEYS) {
        const res = await authFetch('/api/prices', {
          method: 'POST',
          body: { adminWallet: wallet, key: tier, data: prices[tier] || {} },
        })
        const json = await res.json()
        if (!json.ok) {
          addNotification(`❌ ${tier}: ${json.error}`)
          setSaving(false)
          return
        }
      }
      addNotification('✅ Цены сохранены')
      setDirty(false)
    } catch (e) {
      addNotification(`❌ ${e.message || 'Ошибка сохранения'}`)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="px-3 mt-2 text-center py-8">
      <div className="text-2xl animate-spin">💰</div>
    </div>
  )

  return (
    <div className="px-3 mt-2 space-y-3">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[14px] font-black text-gold-400">💰 Цены бриллиантов</div>
          <div className="text-[10px] text-slate-500">Базовая цена = закупка клуба (35% от рынка)</div>
        </div>
        {dirty && (
          <button onClick={handleSave} disabled={saving}
            className="px-3 py-2 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 animate-pulse disabled:opacity-50">
            {saving ? '⏳' : '💾 Сохранить'}
          </button>
        )}
      </div>

      {/* Подсказка */}
      <div className="p-3 rounded-2xl bg-blue-500/8 border border-blue-500/20">
        <div className="text-[10px] text-slate-300 leading-relaxed">
          В этой таблице — <b className="text-blue-300">базовые цены</b> (35% от рынка),
          по которым клуб закупает камни у завода.<br/>
          Из них автоматически считается:<br/>
          • <b>Купить себе</b> = ×1.4286 (50% от рынка) — доступно с уровня 1+<br/>
          • <b>Купить со скидкой -5%</b> (тапалка) = ×1.357 (47.5% от рынка)<br/>
          • <b>Заказать долю/актив</b> = база ÷ 0.85 (партнёр платит +15% контрактных накруток) — доступно с уровня 7+
        </div>
      </div>

      {/* Таблицы для каждой категории */}
      {TIER_KEYS.map(tier => (
        <div key={tier} className="p-3 rounded-2xl glass">
          <div className="text-[12px] font-bold text-white mb-2">{TIER_LABELS[tier]}</div>

          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-center">
            {/* Header */}
            <div className="text-[9px] font-bold text-slate-500 px-1">Карат</div>
            <div className="text-[9px] font-bold text-slate-500 px-1 text-center">Без серт. ($)</div>
            <div className="text-[9px] font-bold text-slate-500 px-1 text-center">С серт. ($)</div>
            <div className="w-6"></div>

            {/* Rows */}
            {allCarats.map(c => (
              <Row key={c} carat={c}
                noCertValue={prices[tier]?.[c]?.noCert ?? 0}
                certValue={prices[tier]?.[c]?.cert ?? 0}
                onChange={(field, v) => updateCell(tier, c, field, v)}
                onRemove={() => removeCarat(c)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Добавить карат */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[11px] font-bold text-slate-300 mb-2">➕ Добавить карат</div>
        <div className="flex gap-2">
          <input
            type="number" step="0.01" min="0.01" max="50"
            value={newCarat} onChange={e => setNewCarat(e.target.value)}
            placeholder="например 0.75"
            className="flex-1 p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none"
          />
          <button onClick={addCarat}
            className="px-4 py-2 rounded-xl text-[11px] font-bold bg-gold-400/15 text-gold-400 border border-gold-400/25">
            Добавить
          </button>
        </div>
        <div className="text-[9px] text-slate-500 mt-1.5">
          Между каратами цена интерполируется автоматически. Например, если есть 1.00 ($1000) и 1.50 ($1600), то для 1.20 будет $1240.
        </div>
      </div>

      {/* Превью расчёта */}
      <PriceCalcPreview prices={prices} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Строка таблицы
// ═══════════════════════════════════════════════════════
function Row({ carat, noCertValue, certValue, onChange, onRemove }) {
  return (
    <>
      <div className="text-[11px] font-bold text-gold-400 px-1 py-1.5">💎 {carat} ct</div>
      <input
        type="number" min="0" value={noCertValue || ''}
        onChange={e => onChange('noCert', e.target.value)}
        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white text-center outline-none"
      />
      <input
        type="number" min="0" value={certValue || ''}
        onChange={e => onChange('cert', e.target.value)}
        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white text-center outline-none"
      />
      <button onClick={onRemove}
        className="w-6 h-6 rounded-lg text-[10px] text-red-400 hover:bg-red-500/15">
        ✕
      </button>
    </>
  )
}

// ═══════════════════════════════════════════════════════
// Превью расчёта — показывает как формируются 4 цены
// ═══════════════════════════════════════════════════════
function PriceCalcPreview({ prices }) {
  const [carat, setCarat] = useState('1.00')
  const [tier, setTier] = useState('club_standard')
  const [hasCert, setHasCert] = useState(true)

  const base = prices[tier]?.[carat]?.[hasCert ? 'cert' : 'noCert'] || 0
  const market = base / 0.35
  const shopPrice = market * 0.5
  const shopWithDiscount = shopPrice * 0.95
  const sharePrice = base / 0.85

  return (
    <div className="p-3 rounded-2xl bg-purple-500/8 border border-purple-500/20">
      <div className="text-[12px] font-bold text-purple-300 mb-2">🧮 Превью расчёта</div>

      {/* Селекторы */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <select value={tier} onChange={e => setTier(e.target.value)}
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white outline-none">
          {TIER_KEYS.map(t => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
        </select>
        <select value={carat} onChange={e => setCarat(e.target.value)}
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white outline-none">
          {Object.keys(prices[tier] || {}).sort((a, b) => parseFloat(a) - parseFloat(b))
            .map(c => <option key={c} value={c}>{c} ct</option>)}
        </select>
        <button onClick={() => setHasCert(!hasCert)}
          className={`p-1.5 rounded-lg text-[10px] font-bold border ${
            hasCert ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                    : 'bg-slate-500/15 text-slate-400 border-slate-500/25'
          }`}>
          {hasCert ? '✅ С серт.' : '— Без серт.'}
        </button>
      </div>

      {/* Расчёт */}
      {base > 0 ? (
        <div className="space-y-1 text-[10px]">
          <Line label="Закупка клуба (база, 35%)"   value={base}              color="text-blue-300" bold />
          <Line label="Цена на рынке (100%)"        value={market}            color="text-slate-500" strike />
          <Line label="🛒 В магазине себе (50%)"     value={shopPrice}         color="text-emerald-400" />
          <Line label="🛒 Со скидкой -5% за GST"     value={shopWithDiscount}  color="text-emerald-300" />
          <Line label="📈 Заказать долю/актив (7+)" value={sharePrice}        color="text-gold-400" hint="база ÷ 0.85 = +5% реклама +10% маркетинг" />
        </div>
      ) : (
        <div className="text-[10px] text-slate-500 text-center py-2">Введи цены выше — здесь покажется расчёт</div>
      )}
    </div>
  )
}

function Line({ label, value, color, bold, strike, hint }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-slate-400">{label}</span>
      <span className={`${color} ${bold ? 'font-black' : 'font-bold'} ${strike ? 'line-through' : ''} whitespace-nowrap`}>
        {formatUSD(Math.round(value))}
        {hint && <span className="block text-[8px] text-slate-500 font-normal">{hint}</span>}
      </span>
    </div>
  )
}
