'use client'
/**
 * DiamondLotVisual.jsx — Интерактивная визуализация бриллианта для клубных лотов
 * 
 * 100 граней = 100 долей. Свободные сверкают, купленные серые, выбранная подсвечена.
 * 
 * Props:
 *   lot        — объект лота { id, name, description, total_shares, share_price, status, ... }
 *   soldIds    — Set<number> или Array<number> — ID граней (1-100) которые уже куплены
 *   myIds      — Set<number> или Array<number> — ID граней купленных текущим пользователем
 *   onBuy      — (facetId: number) => void — вызывается при покупке
 *   onBuyRandom — () => void — покупка случайной доли
 *   disabled   — boolean — блокировка кнопок (транзакция в процессе)
 */
import { useState, useEffect, useMemo, useCallback } from 'react'

// ═══ Геометрия бриллианта ═══
const CENTER = { x: 450, y: 450 }
const RINGS = [70, 165, 250, 335]
const SEGMENTS = [10, 20, 30, 40]
const TOTAL = 100

function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function generateFacets() {
  const facets = []
  let id = 1

  SEGMENTS.forEach((count, ringIndex) => {
    const innerR = RINGS[ringIndex]
    const outerR = RINGS[ringIndex + 1]
    const step = 360 / count
    const offset = ringIndex % 2 === 0 ? 0 : step / 2

    for (let i = 0; i < count; i++) {
      const a0 = offset + i * step
      const a1 = offset + (i + 1) * step
      const amid = (a0 + a1) / 2

      const p1 = polar(CENTER.x, CENTER.y, innerR, a0 + step * 0.1)
      const p2 = polar(CENTER.x, CENTER.y, innerR, a1 - step * 0.1)
      const p3 = polar(CENTER.x, CENTER.y, outerR, a1 - step * 0.04)
      const p4 = polar(CENTER.x, CENTER.y, outerR, amid)
      const p5 = polar(CENTER.x, CENTER.y, outerR, a0 + step * 0.04)

      let points
      if (ringIndex === 0) {
        points = [{ x: CENTER.x, y: CENTER.y }, p1, p4, p2]
      } else {
        points = [p1, p2, p3, p4, p5]
      }

      facets.push({ id, points: points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') })
      id++
    }
  })
  return facets
}

function generateGuideLines() {
  const lines = []
  for (let deg = 0; deg < 360; deg += 12) {
    const p1 = polar(CENTER.x, CENTER.y, 70, deg)
    const p2 = polar(CENTER.x, CENTER.y, 335, deg)
    lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y })
  }
  return lines
}

// Предрассчитанные данные (статичны)
const FACETS = generateFacets()
const GUIDE_LINES = generateGuideLines()

// ═══ Компонент грани ═══
function Facet({ id, points, state, isSelected, isMine, onClick }) {
  const cls = state === 'sold'
    ? (isMine ? 'facet mine' : 'facet sold')
    : isSelected ? 'facet selected' : 'facet free'

  return (
    <polygon
      points={points}
      className={cls}
      onClick={() => state !== 'sold' && onClick(id)}
    />
  )
}

// ═══ Основной компонент ═══
export default function DiamondLotVisual({ lot, soldIds = [], myIds = [], onBuy, onBuyRandom, disabled = false }) {
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])

  // Нормализуем в Set
  const soldSet = useMemo(() => new Set(Array.isArray(soldIds) ? soldIds : [...soldIds]), [soldIds])
  const mySet = useMemo(() => new Set(Array.isArray(myIds) ? myIds : [...myIds]), [myIds])

  const soldCount = soldSet.size
  const freeCount = TOTAL - soldCount
  const progressPct = (soldCount / TOTAL) * 100

  // Сброс выбора если грань стала sold
  useEffect(() => {
    if (selected && soldSet.has(selected)) setSelected(null)
  }, [soldSet, selected])

  // Начальная история
  useEffect(() => {
    setHistory([{ text: 'Лот открыт для участия', time: '' }])
  }, [lot?.id])

  const handleSelect = useCallback((id) => {
    if (soldSet.has(id)) return
    setSelected(id)
  }, [soldSet])

  const handleBuy = () => {
    if (!selected || disabled) return
    onBuy?.(selected)
    setHistory(h => [{ text: `Куплена доля — грань №${selected}`, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }, ...h].slice(0, 8))
  }

  const handleRandom = () => {
    const free = FACETS.filter(f => !soldSet.has(f.id)).map(f => f.id)
    if (!free.length) return
    const randomId = free[Math.floor(Math.random() * free.length)]
    setSelected(randomId)
  }

  const sharePrice = lot?.share_price || lot?.sharePrice || 10
  const lotName = lot?.name || lot?.title || `Лот #${lot?.id || '?'}`
  const lotDesc = lot?.description || ''

  return (
    <div className="space-y-3">
      {/* SVG Бриллиант */}
      <div className="rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(180deg, rgba(2,11,29,0.95), rgba(10,16,32,0.95))', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-3 pt-3">
          <div className="text-[13px] font-black text-white">💎 Купи долю бриллианта</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Нажми на свободную грань и подтверди покупку</div>
        </div>

        {/* Diamond SVG */}
        <div className="flex justify-center px-2 py-2">
          <svg viewBox="0 0 900 900" className="w-full max-w-[360px]" style={{ overflow: 'visible' }}>
            <defs>
              <radialGradient id="lotFacetFill" cx="35%" cy="28%" r="90%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="28%" stopColor="#f6fdff" />
                <stop offset="52%" stopColor="#dff5ff" />
                <stop offset="74%" stopColor="#b6e8ff" />
                <stop offset="100%" stopColor="#f4fbff" />
              </radialGradient>
              <radialGradient id="lotFacetMine" cx="35%" cy="28%" r="90%">
                <stop offset="0%" stopColor="#ffd700" />
                <stop offset="50%" stopColor="#d4a843" />
                <stop offset="100%" stopColor="#b8860b" />
              </radialGradient>
            </defs>

            {/* Направляющие линии */}
            <g>
              {GUIDE_LINES.map((l, i) => (
                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
              ))}
            </g>

            {/* Грани */}
            <g>
              {FACETS.map(f => (
                <Facet key={f.id} id={f.id} points={f.points}
                  state={soldSet.has(f.id) ? 'sold' : 'free'}
                  isSelected={selected === f.id}
                  isMine={mySet.has(f.id)}
                  onClick={handleSelect} />
              ))}
            </g>

            {/* Кольца */}
            <circle cx="450" cy="450" r="335" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" />
            <circle cx="450" cy="450" r="250" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
            <circle cx="450" cy="450" r="165" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Легенда */}
        <div className="flex justify-center gap-4 pb-3 px-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, #fff, #bae9ff)', boxShadow: '0 0 6px rgba(186,233,255,0.5)' }} />
            <span className="text-[9px] text-slate-400">Свободная</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: '#dff4ff' }} />
            <span className="text-[9px] text-slate-400">Выбранная</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, #ffd700, #b8860b)' }} />
            <span className="text-[9px] text-slate-400">Моя</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: '#7c8796' }} />
            <span className="text-[9px] text-slate-400">Купленная</span>
          </div>
        </div>
      </div>

      {/* Информация о лоте */}
      <div className="p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-[12px] font-bold text-white">{lotName}</div>
        {lotDesc && <div className="text-[10px] text-slate-400 mt-0.5">{lotDesc}</div>}
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[9px] text-slate-500">Всего</div>
          <div className="text-[18px] font-black text-white">{TOTAL}</div>
        </div>
        <div className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[9px] text-slate-500">Выкуплено</div>
          <div className="text-[18px] font-black text-slate-300">{soldCount}</div>
        </div>
        <div className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[9px] text-slate-500">Свободно</div>
          <div className="text-[18px] font-black text-emerald-400">{freeCount}</div>
        </div>
      </div>

      {/* Цена + прогресс */}
      <div className="p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-[10px] text-slate-500">Стоимость одной доли</div>
            <div className="text-[22px] font-black text-white">${sharePrice}</div>
          </div>
          <div className="text-[10px] text-slate-400 text-right">
            {selected ? <span className="text-blue-400 font-bold">Грань №{selected}</span> : 'Грань не выбрана'}
          </div>
        </div>

        {/* Прогресс-бар */}
        <div className="text-[9px] text-slate-500 mb-1">Заполнение лота</div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #ecfbff, #92dbff)',
            boxShadow: '0 0 12px rgba(146,219,255,0.4)',
          }} />
        </div>
        <div className="text-[9px] text-slate-500 text-right mt-1">{soldCount}/{TOTAL} ({progressPct.toFixed(0)}%)</div>

        {/* Кнопки */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={handleBuy} disabled={!selected || disabled || freeCount === 0}
            className="py-3 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #ffffff, #a8e2ff)', color: '#04101c', boxShadow: selected && !disabled ? '0 8px 20px rgba(154,226,255,0.2)' : 'none' }}>
            {disabled ? '⏳ ...' : '💎 Купить грань'}
          </button>
          <button onClick={handleRandom} disabled={disabled || freeCount === 0}
            className="py-3 rounded-xl text-[11px] font-bold text-white border transition-all disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}>
            🎲 Случайная
          </button>
        </div>
      </div>

      {/* Статус выбора */}
      {selected && (
        <div className="p-3 rounded-2xl" style={{ background: 'rgba(223,244,255,0.06)', border: '1px solid rgba(223,244,255,0.15)' }}>
          <div className="text-[11px] font-bold text-blue-400">✨ Грань №{selected} выбрана</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Нажмите «Купить грань» для подтверждения. Стоимость: ${sharePrice} USDT</div>
        </div>
      )}

      {/* История */}
      {history.length > 0 && (
        <div className="p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[11px] font-bold text-slate-300 mb-2">📋 Последние действия</div>
          <div className="space-y-1 max-h-[140px] overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className="flex justify-between items-center px-2.5 py-2 rounded-lg text-[10px]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-slate-300">{h.text}</span>
                <span className="text-slate-500 shrink-0 ml-2">{h.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSS для граней */}
      <style jsx global>{`
        .facet {
          stroke: rgba(255,255,255,0.55);
          stroke-width: 1;
          cursor: pointer;
          transition: fill 0.2s ease, filter 0.2s ease, opacity 0.2s ease;
        }
        .facet.free {
          fill: url(#lotFacetFill);
          filter: drop-shadow(0 0 8px rgba(190,235,255,0.2));
        }
        .facet.free:hover {
          filter: drop-shadow(0 0 16px rgba(223,246,255,0.7));
        }
        .facet.selected {
          fill: #dff4ff;
          filter: drop-shadow(0 0 18px rgba(223,244,255,0.85));
        }
        .facet.sold {
          fill: #7c8796;
          stroke: rgba(255,255,255,0.1);
          filter: none;
          cursor: default;
        }
        .facet.mine {
          fill: url(#lotFacetMine);
          stroke: rgba(255,215,0,0.4);
          filter: drop-shadow(0 0 8px rgba(255,215,0,0.25));
          cursor: default;
        }
      `}</style>
    </div>
  )
}
