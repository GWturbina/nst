'use client'
/**
 * DiamondLotVisual.jsx — Визуализация бриллианта (v2.4 USDT-модель)
 *
 * НОВАЯ МОДЕЛЬ: партнёр вкладывает любую сумму USDT, получает DCT по $0.50.
 * Грани (100 штук) — декоративная метрика прогресса:
 *   • Золотые — пропорциональны МОЕМУ вложению в этом пуле
 *   • Серые   — пропорциональны вкладу ОСТАЛЬНЫХ партнёров
 *   • Сверкают — оставшаяся свобода до цели
 *
 * Props:
 *   lot              — { id, title/name, description, gem_cost/target_usdt, status, ... }
 *   raisedUSDT       — сколько собрано всего в пуле (число USDT)
 *   myInvestedUSDT   — сколько вложил текущий пользователь (число USDT)
 *   targetUSDT       — цель сбора (если не передано — берётся из lot.gem_cost)
 *   onBuy            — (amountUSDT: number) => void — вызывается при покупке
 *   disabled         — boolean — блокировка во время транзакции
 *   minBuyUSDT       — минимум на одну покупку (по умолчанию $1)
 */
import { useState, useEffect, useMemo } from 'react'

// ═══ Геометрия бриллианта (100 граней) ═══
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
      if (ringIndex === 0) points = [{ x: CENTER.x, y: CENTER.y }, p1, p4, p2]
      else points = [p1, p2, p3, p4, p5]
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

const FACETS = generateFacets()
const GUIDE_LINES = generateGuideLines()

function Facet({ points, state }) {
  return <polygon points={points} className={`facet ${state}`} />
}

export default function DiamondLotVisual({
  lot,
  raisedUSDT = 0,
  myInvestedUSDT = 0,
  targetUSDT = null,
  onBuy,
  disabled = false,
  minBuyUSDT = 1,
}) {
  const target = Number(targetUSDT ?? lot?.gem_cost ?? lot?.target_usdt ?? 0)
  const raised = Number(raisedUSDT) || 0
  const mine = Number(myInvestedUSDT) || 0
  const others = Math.max(0, raised - mine)
  const remaining = Math.max(0, target - raised)

  const [amount, setAmount] = useState('')
  const [history, setHistory] = useState([])

  // Распределение граней по %
  const facetState = useMemo(() => {
    if (target <= 0) return new Array(TOTAL).fill('free')
    const mineCount = Math.round((mine / target) * TOTAL)
    const othersCount = Math.round((others / target) * TOTAL)
    const totalSold = Math.min(TOTAL, mineCount + othersCount)
    const adjOthers = Math.max(0, totalSold - mineCount)

    const arr = new Array(TOTAL).fill('free')
    for (let i = 0; i < adjOthers && i < TOTAL; i++) {
      arr[TOTAL - 1 - i] = 'sold'
    }
    for (let i = 0; i < mineCount && i < TOTAL; i++) {
      if (arr[i] === 'free') arr[i] = 'mine'
    }
    return arr
  }, [mine, others, target])

  const progressPct = target > 0 ? Math.min(100, (raised / target) * 100) : 0
  const minePct = target > 0 ? Math.min(100, (mine / target) * 100) : 0
  const othersPct = target > 0 ? Math.min(100, (others / target) * 100) : 0

  useEffect(() => {
    setHistory([{ text: 'Лот открыт для участия', time: '' }])
  }, [lot?.id])

  const numAmount = parseFloat(amount) || 0
  const dctEstimate = numAmount * 2
  const amountValid = numAmount >= minBuyUSDT && numAmount <= remaining

  const handleBuy = () => {
    if (!amountValid || disabled) return
    onBuy?.(numAmount)
    setHistory(h => [
      { text: `Вложено $${numAmount.toFixed(2)} USDT`, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) },
      ...h
    ].slice(0, 8))
    setAmount('')
  }

  const setQuickAmount = (v) => setAmount(String(v))

  const lotName = lot?.title || lot?.name || `Лот #${lot?.id || '?'}`
  const lotDesc = lot?.description || ''

  const quickAmounts = useMemo(() => {
    if (remaining <= 0) return []
    const opts = [10, 50, 100, 500, 1000].filter(v => v <= remaining)
    return [...new Set(opts)].sort((a, b) => a - b)
  }, [remaining])

  const isFull = remaining <= 0

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(180deg, rgba(2,11,29,0.95), rgba(10,16,32,0.95))', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-3 pt-3">
          <div className="text-[13px] font-black text-white">💎 Вложи USDT в этот пул</div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {isFull ? 'Лот заполнен — пора покупать камень' : 'Любая сумма USDT. Получишь DCT по $0.50'}
          </div>
        </div>

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

            <g>
              {GUIDE_LINES.map((l, i) => (
                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
              ))}
            </g>

            <g>
              {FACETS.map((f, idx) => (
                <Facet key={f.id} points={f.points} state={facetState[idx]} />
              ))}
            </g>

            <circle cx="450" cy="450" r="335" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" />
            <circle cx="450" cy="450" r="250" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
            <circle cx="450" cy="450" r="165" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="flex justify-center gap-4 pb-3 px-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, #fff, #bae9ff)', boxShadow: '0 0 6px rgba(186,233,255,0.5)' }} />
            <span className="text-[9px] text-slate-400">Свободно</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, #ffd700, #b8860b)' }} />
            <span className="text-[9px] text-slate-400">Моя доля</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: '#7c8796' }} />
            <span className="text-[9px] text-slate-400">Других участников</span>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-[12px] font-bold text-white">{lotName}</div>
        {lotDesc && <div className="text-[10px] text-slate-400 mt-0.5">{lotDesc}</div>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[9px] text-slate-500">Цель</div>
          <div className="text-[16px] font-black text-white">${target.toLocaleString()}</div>
        </div>
        <div className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.10)' }}>
          <div className="text-[9px] text-slate-500">Моё вложение</div>
          <div className="text-[16px] font-black" style={{ color: '#d4a843' }}>${mine.toLocaleString()}</div>
        </div>
        <div className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[9px] text-slate-500">Осталось</div>
          <div className="text-[16px] font-black text-emerald-400">${remaining.toLocaleString()}</div>
        </div>
      </div>

      <div className="p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>

        <div className="text-[9px] text-slate-500 mb-1">Заполнение лота</div>
        <div className="h-2.5 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="h-full absolute top-0 left-0 transition-all duration-500" style={{
            width: `${othersPct}%`,
            background: '#7c8796',
          }} />
          <div className="h-full absolute top-0 transition-all duration-500" style={{
            left: `${othersPct}%`,
            width: `${minePct}%`,
            background: 'linear-gradient(90deg, #ffd700, #d4a843)',
            boxShadow: '0 0 12px rgba(212,168,67,0.5)',
          }} />
        </div>
        <div className="flex justify-between text-[9px] text-slate-500 mt-1">
          <span>Собрано: ${raised.toLocaleString()}</span>
          <span>{progressPct.toFixed(1)}%</span>
        </div>

        {isFull ? (
          <div className="mt-3 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="text-[12px] font-bold text-emerald-400">✅ Лот полностью заполнен</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Клуб скоро закупит камень</div>
          </div>
        ) : (
          <div className="mt-3">
            <div className="text-[10px] text-slate-400 mb-1">Сколько вложить (USDT)</div>
            <input
              type="number"
              min={minBuyUSDT}
              max={remaining}
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={`от $${minBuyUSDT} до $${remaining.toLocaleString()}`}
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-[14px] outline-none focus:border-yellow-400/40"
              style={{ borderColor: amount && !amountValid ? 'rgba(239,68,68,0.5)' : undefined }}
            />

            {quickAmounts.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {quickAmounts.map(v => (
                  <button key={v} onClick={() => setQuickAmount(v)} disabled={disabled}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40">
                    ${v}
                  </button>
                ))}
                <button onClick={() => setQuickAmount(remaining)} disabled={disabled}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 disabled:opacity-40">
                  Всё (${remaining.toLocaleString()})
                </button>
              </div>
            )}

            {numAmount > 0 && (
              <div className="mt-2 p-2 rounded-xl bg-blue-500/8 border border-blue-500/15">
                <div className="text-[10px] text-slate-300">
                  Ты получишь: <span className="font-bold text-blue-300">{dctEstimate.toLocaleString()} DCT</span>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  {!amountValid && numAmount > 0 && numAmount < minBuyUSDT && `Минимум $${minBuyUSDT}`}
                  {!amountValid && numAmount > remaining && `Максимум $${remaining.toLocaleString()}`}
                  {amountValid && `по фиксированной цене $0.50 за DCT • разморозка через 1 год`}
                </div>
              </div>
            )}

            <button onClick={handleBuy} disabled={disabled || !amountValid}
              className="w-full mt-3 py-3 rounded-xl text-[12px] font-black transition-all disabled:opacity-40"
              style={{
                background: amountValid ? 'linear-gradient(135deg, #ffd700, #d4a843)' : 'rgba(255,255,255,0.06)',
                color: amountValid ? '#04101c' : '#94a3b8',
                boxShadow: amountValid && !disabled ? '0 8px 20px rgba(212,168,67,0.25)' : 'none',
              }}>
              {disabled ? '⏳ Транзакция...' : numAmount > 0 ? `💎 Вложить $${numAmount.toFixed(2)} USDT` : '💎 Введи сумму'}
            </button>
          </div>
        )}
      </div>

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

      <style jsx global>{`
        .facet {
          stroke: rgba(255,255,255,0.55);
          stroke-width: 1;
          transition: fill 0.3s ease, filter 0.3s ease;
        }
        .facet.free {
          fill: url(#lotFacetFill);
          filter: drop-shadow(0 0 8px rgba(190,235,255,0.2));
        }
        .facet.sold {
          fill: #7c8796;
          stroke: rgba(255,255,255,0.1);
          filter: none;
        }
        .facet.mine {
          fill: url(#lotFacetMine);
          stroke: rgba(255,215,0,0.4);
          filter: drop-shadow(0 0 8px rgba(255,215,0,0.25));
        }
      `}</style>
    </div>
  )
}
