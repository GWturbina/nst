'use client'
/**
 * MyPurchasesSection.jsx — Мои покупки долей
 * 
 * ПОЛНАЯ ПРОЗРАЧНОСТЬ:
 *   - Каждая покупка с датой, суммой, хэшем транзакции
 *   - Ссылка на блокчейн-эксплорер для верификации
 *   - Процент владения в каждом лоте
 *   - Статус лота (активный → заполнен → завершён)
 *   - Информация о победителе
 *   - Суммарная статистика
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import HelpButton from '@/components/ui/HelpButton'

const EXPLORER_URL = 'https://opbnb.bscscan.com/tx/'

const STATUS_LABELS = {
  active: { label: '🟢 Активный', color: 'text-emerald-400', bg: 'rgba(16,185,129,0.08)' },
  filled: { label: '🔵 Заполнен', color: 'text-blue-400', bg: 'rgba(59,130,246,0.08)' },
  revealing: { label: '🔮 Розыгрыш', color: 'text-purple-400', bg: 'rgba(168,85,247,0.08)' },
  completed: { label: '🏆 Завершён', color: 'text-amber-400', bg: 'rgba(245,158,11,0.08)' },
  unlocked: { label: '🔓 Разморожен', color: 'text-teal-400', bg: 'rgba(20,184,166,0.08)' },
  cancelled: { label: '❌ Отменён', color: 'text-red-400', bg: 'rgba(239,68,68,0.08)' },
  unknown: { label: '❓ Неизвестно', color: 'text-slate-400', bg: 'rgba(148,163,184,0.08)' },
}

export default function MyPurchasesSection() {
  const { wallet, t } = useGameStore()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  const reload = useCallback(async () => {
    if (!wallet) { setPurchases([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/lots?status=all&wallet=${wallet}&detail=purchases`)
      const data = await res.json()
      if (data.ok) {
        setPurchases(data.myPurchases || [])
      }
    } catch {}
    setLoading(false)
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  // ═══ Суммарная статистика ═══
  const totalInvested = purchases.reduce((sum, p) => sum + (parseFloat(p.usdtAmount) || 0), 0)
  const totalShares = purchases.reduce((sum, p) => sum + p.sharesCount, 0)
  const uniqueLots = [...new Set(purchases.map(p => p.lotId))].length
  const wonLots = purchases.filter(p => p.isWinner).length
  const giftedShares = purchases.filter(p => p.isGift).reduce((sum, p) => sum + p.sharesCount, 0)

  if (!wallet) {
    return (
      <div className="px-3 mt-4 text-center py-12">
        <div className="text-3xl mb-2">🔐</div>
        <div className="text-xs text-slate-500">Подключите кошелёк чтобы увидеть покупки</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="px-3 mt-4 text-center py-12">
        <div className="text-3xl animate-spin">📋</div>
        <div className="text-xs text-slate-500 mt-2">Загрузка покупок...</div>
      </div>
    )
  }

  return (
    <div className="px-3 mt-3 space-y-3">

      <div className="flex items-center justify-between">
        <div className="text-[14px] font-black text-gold-400">📋 Мои покупки</div>
        <HelpButton section="purchases" />
      </div>

      {/* ═══ СУММАРНАЯ СТАТИСТИКА ═══ */}
      <div className="p-4 rounded-2xl border" style={{ background: 'rgba(21,21,48,0.8)', borderColor: 'rgba(212,168,67,0.15)' }}>
        <div className="text-[11px] font-bold text-gold-400 mb-2">📊 Итого</div>
        <div className="grid grid-cols-2 gap-2">
          <StatItem label="Инвестировано" value={`$${totalInvested.toFixed(2)}`} color="text-gold-400" />
          <StatItem label="Долей куплено" value={totalShares} color="text-emerald-400" />
          <StatItem label="Лотов" value={uniqueLots} color="text-blue-400" />
          <StatItem label="Выиграно камней" value={wonLots} color="text-purple-400" />
          {giftedShares > 0 && (
            <StatItem label="Подарено долей" value={giftedShares} color="text-pink-400" />
          )}
        </div>
      </div>

      {/* ═══ СПИСОК ПОКУПОК ═══ */}
      {purchases.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-3xl mb-2">🎟</div>
          <div className="text-xs text-slate-500">У вас пока нет покупок</div>
          <div className="text-[10px] text-slate-600 mt-1">Купите долю в активном лоте — она появится здесь</div>
        </div>
      ) : (
        <div className="space-y-2">
          {purchases.map(p => (
            <PurchaseCard
              key={p.purchaseId}
              purchase={p}
              expanded={expandedId === p.purchaseId}
              onToggle={() => setExpandedId(expandedId === p.purchaseId ? null : p.purchaseId)}
            />
          ))}
        </div>
      )}

      {/* Ссылка на обновление */}
      {purchases.length > 0 && (
        <button onClick={reload}
          className="w-full py-2 text-[10px] text-slate-500 hover:text-slate-300 transition-all">
          🔄 Обновить данные
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// КАРТОЧКА ПОКУПКИ
// ═══════════════════════════════════════════════════
function PurchaseCard({ purchase: p, expanded, onToggle }) {
  const statusInfo = STATUS_LABELS[p.lotStatus] || STATUS_LABELS.unknown
  const purchaseDate = p.purchaseDate ? new Date(p.purchaseDate) : null
  const dateStr = purchaseDate
    ? purchaseDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
  const timeStr = purchaseDate
    ? purchaseDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : ''

  // Таймер до разморозки
  const unlockDate = p.unlockAt ? new Date(p.unlockAt) : null
  const now = new Date()
  const daysLeft = unlockDate ? Math.max(0, Math.ceil((unlockDate - now) / 86400000)) : null

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ background: 'rgba(21,21,48,0.8)', borderColor: p.isWinner ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)' }}
    >
      {/* Основная строка — всегда видна */}
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-3 text-left">

        {/* Иконка статуса */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: statusInfo.bg }}>
          {p.isWinner ? '🏆' : p.isGift ? '🎁' : '💎'}
        </div>

        {/* Инфо */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-black text-white truncate">{p.lotTitle}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
            <span className="text-[9px] text-slate-500">{dateStr}</span>
          </div>
        </div>

        {/* Сумма и доли */}
        <div className="text-right flex-shrink-0">
          <div className="text-[14px] font-black text-gold-400">
            {p.sharesCount} {p.sharesCount === 1 ? 'доля' : 'долей'}
          </div>
          <div className="text-[10px] text-slate-400">
            ${parseFloat(p.usdtAmount || 0).toFixed(2)}
          </div>
        </div>

        {/* Стрелка */}
        <div className={`text-slate-500 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</div>
      </button>

      {/* Расширенные детали */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>

          {/* Победитель */}
          {p.isWinner && (
            <div className="p-2.5 rounded-xl mt-2" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <div className="text-[12px] font-black text-emerald-400">🏆 Вы получаете камень!</div>
              {daysLeft !== null && daysLeft > 0 && (
                <div className="text-[10px] text-slate-400 mt-0.5">❄️ Заморозка: {daysLeft} дн.</div>
              )}
            </div>
          )}

          {/* Детали покупки */}
          <div className="mt-2 space-y-1.5">
            <DetailRow label="Дата покупки" value={`${dateStr} ${timeStr}`} />
            <DetailRow label="Кол-во долей" value={p.sharesCount} />
            <DetailRow label="Цена доли" value={`$${parseFloat(p.sharePrice || 0).toFixed(2)}`} />
            <DetailRow label="Сумма оплаты" value={`$${parseFloat(p.usdtAmount || 0).toFixed(2)} USDT`} highlight />
            <DetailRow label="Доля владения" value={`${p.ownershipPct}%`} />
            {p.isGift && <DetailRow label="Тип" value="🎁 Подарок" />}
          </div>

          {/* Характеристики камня */}
          {(p.carats || p.shape || p.clarity || p.color) && (
            <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="text-[10px] text-slate-500 mb-1">💎 Камень:</div>
              <div className="flex flex-wrap gap-1.5">
                {p.carats && <Tag text={`${p.carats} ct`} />}
                {p.shape && <Tag text={p.shape} />}
                {p.clarity && <Tag text={p.clarity} />}
                {p.color && <Tag text={`Цвет: ${p.color}`} />}
                {p.hasCert && <Tag text="📜 Серт." green />}
              </div>
            </div>
          )}

          {/* Статус лота */}
          <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <div className="text-[10px] text-slate-500 mb-1">📊 Лот:</div>
            <div className="space-y-1">
              <DetailRow label="Стоимость камня" value={`$${parseFloat(p.gemType === 'diamond' ? (p.totalShares * p.sharePrice) : 0).toFixed(0)}`} />
              <DetailRow label="Продано долей" value={`${p.soldShares} / ${p.totalShares}`} />
              {/* Прогресс-бар */}
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${Math.min(100, p.totalShares > 0 ? (p.soldShares / p.totalShares * 100) : 0)}%`,
                  background: 'linear-gradient(90deg, #d4a843, #e8c96a)',
                }} />
              </div>
            </div>

            {p.winnerWallet && (
              <div className="mt-1.5">
                <DetailRow label="Получатель камня" value={shortAddress(p.winnerWallet)} />
              </div>
            )}
          </div>

          {/* Блокчейн — ВЕРИФИКАЦИЯ */}
          <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <div className="text-[10px] text-slate-500 mb-1">🔗 Блокчейн:</div>
            {p.txHash ? (
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] text-slate-400 font-mono break-all flex-1">
                    {p.txHash}
                  </div>
                  <button
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(p.txHash)
                      }
                    }}
                    className="text-[9px] text-slate-500 hover:text-white px-1.5 py-0.5 rounded bg-white/5 flex-shrink-0"
                  >📋</button>
                </div>
                <a
                  href={`${EXPLORER_URL}${p.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold text-blue-400 bg-blue-500/8 border border-blue-500/15 hover:bg-blue-500/12 transition-all"
                >
                  🔍 Проверить на opBNB Explorer
                </a>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 italic">
                {p.isGift ? 'Подарок — без транзакции' : 'Хэш транзакции не записан'}
              </div>
            )}

            {p.confirmed ? (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                ✅ Подтверждено
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400 font-bold">
                ⏳ Ожидает подтверждения
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
// ═══════════════════════════════════════════════════

function StatItem({ label, value, color }) {
  return (
    <div className="p-2 rounded-lg bg-white/3 text-center">
      <div className={`text-[15px] font-black ${color}`}>{value}</div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  )
}

function DetailRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className={highlight ? 'font-black text-gold-400' : 'text-white font-bold'}>{value}</span>
    </div>
  )
}

function Tag({ text, green }) {
  return (
    <span className={`px-2 py-0.5 rounded-lg text-[10px] ${
      green
        ? 'bg-emerald-500/15 text-emerald-400'
        : 'bg-white/5 text-slate-300'
    }`}>
      {text}
    </span>
  )
}
