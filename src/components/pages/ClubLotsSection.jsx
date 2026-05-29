'use client'
/**
 * ClubLotsSection.jsx — Клубные пулы (v2.4 USDT-модель)
 *
 * НОВАЯ МОДЕЛЬ:
 *  • Партнёр вкладывает любую сумму USDT (от $1)
 *  • Получает DCT по фиксированной цене $0.50
 *  • Никаких "долей по $50" — только сумма USDT и прогресс сбора
 *
 * Отображение:
 *  • Список пулов в виде компактных карточек
 *  • Клик "Открыть" → большая визуализация (DiamondLotVisual) с формой покупки
 *  • Прогресс показывается в USDT (raised/target)
 *  • Моё вложение видно отдельно (золотые грани в визуализации)
 *
 * Источник данных:
 *  • Метаданные (title, photo, description) — из Supabase /api/lots
 *  • Реальный прогресс (raised, treasury) — из контракта ClubPools.getPool(poolId)
 *  • Моё вложение — из контракта ClubPools.getUserInvestment(wallet, poolId)
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import { safeCall } from '@/lib/contracts'
import * as Club from '@/lib/clubV23'
import HelpButton from '@/components/ui/HelpButton'
import DiamondLotVisual from '@/components/ui/DiamondLotVisual'

const STATUS_INFO = {
  0: { label: '🟢 Сбор', color: 'text-emerald-400' },
  1: { label: '🔵 Собран', color: 'text-blue-400' },
  2: { label: '🟡 Камень куплен', color: 'text-yellow-400' },
  3: { label: '🔄 Цикл', color: 'text-purple-400' },
  4: { label: '❄️ Заморожен', color: 'text-cyan-400' },
  5: { label: '🔓 Разморожен', color: 'text-teal-400' },
  6: { label: '❌ Отменён', color: 'text-red-400' },
  7: { label: '🚨 Drained', color: 'text-red-500' },
}

export default function ClubLotsSection() {
  const { wallet, addNotification } = useGameStore()

  const [lots, setLots] = useState([])           // метаданные из Supabase
  const [pools, setPools] = useState({})          // poolId → данные с контракта
  const [myInvestments, setMyInvestments] = useState({}) // poolId → USDT
  const [mktBalance, setMktBalance] = useState('0')

  const [loading, setLoading] = useState(true)
  const [txPending, setTxPending] = useState(false)
  const [tab, setTab] = useState('active')
  const [openLot, setOpenLot] = useState(null)   // открытый для просмотра лот

  // ═══ Загрузка данных ═══
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Метаданные из Supabase
      const res = await fetch(`/api/lots?status=all&wallet=${wallet || ''}`)
      const data = await res.json()
      const dbLots = data.ok ? (data.lots || []) : []
      setLots(dbLots)

      // 2. Данные пулов с контракта (только для тех, что привязаны)
      const poolsData = {}
      const myInv = {}
      for (const lot of dbLots) {
        if (lot.contract_lot_id == null) continue
        const pool = await Club.getPool(lot.contract_lot_id).catch(() => null)
        if (pool) poolsData[lot.contract_lot_id] = pool
        if (wallet) {
          const inv = await Club.getUserInvestment(wallet, lot.contract_lot_id).catch(() => '0')
          myInv[lot.contract_lot_id] = parseFloat(inv) || 0
        }
      }
      setPools(poolsData)
      setMyInvestments(myInv)

      // 3. Баланс маркетинга
      if (wallet) {
        const bal = await Club.getMarketingBalance(wallet).catch(() => '0')
        setMktBalance(bal)
      }
    } catch {}
    setLoading(false)
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  // ═══ Покупка доли (вложить N USDT) ═══
  const handleBuy = async (amountUSDT) => {
    if (!openLot || !wallet || !amountUSDT) return
    const contractLotId = openLot.contract_lot_id
    if (contractLotId == null) {
      addNotification('❌ Пул ещё не привязан к контракту')
      return
    }

    setTxPending(true)

    const result = await safeCall(() => Club.buyShare(contractLotId, amountUSDT))

    if (result.ok) {
      const txHash = result.data?.hash || result.data?.transactionHash || ''
      addNotification(`✅ Вложено $${amountUSDT.toFixed(2)} в пул «${openLot.title}»! Tx: ${txHash.slice(0, 10)}...`)
      // Перезагружаем данные пула
      await reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
    setTxPending(false)
  }

  // ═══ Забрать маркетинг ═══
  const handleClaimMarketing = async () => {
    setTxPending(true)
    const result = await safeCall(() => Club.claimMarketing())
    if (result.ok) {
      addNotification('✅ Маркетинг получен!')
      reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
    setTxPending(false)
  }

  // ═══ Аварийная компенсация ═══
  const handleClaimCompensation = async (lot) => {
    if (lot.contract_lot_id == null) return
    setTxPending(true)
    const result = await safeCall(() => Club.claimDrainedPool(lot.contract_lot_id))
    if (result.ok) {
      addNotification('✅ Компенсация получена!')
      reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
    setTxPending(false)
  }

  // ═══ Фильтрация ═══
  const activeLots = lots.filter(l => {
    if (l.contract_lot_id == null) return false  // показываем только реально задеплоенные пулы
    const pool = pools[l.contract_lot_id]
    if (!pool) return false
    return [0, 1, 2, 3].includes(pool.status)  // Open, Funded, InGem, Cycling
  })

  const myLots = lots.filter(l => {
    const inv = myInvestments[l.contract_lot_id]
    return inv && inv > 0
  })

  const historyLots = lots.filter(l => {
    if (l.contract_lot_id == null) return false  // показываем только реально задеплоенные пулы
    const pool = pools[l.contract_lot_id]
    if (!pool) return false
    return [4, 5, 6, 7].includes(pool.status)  // Frozen, Unlocked, Cancelled, Drained
  })

  const displayLots = tab === 'active' ? activeLots : tab === 'my' ? myLots : historyLots

  if (loading) {
    return (
      <div className="px-3 mt-4 text-center py-12">
        <div className="text-3xl animate-spin">💎</div>
        <div className="text-xs text-slate-500 mt-2">Загрузка пулов...</div>
      </div>
    )
  }

  // ═══ Открытый лот — полная визуализация с покупкой ═══
  if (openLot) {
    const pool = pools[openLot.contract_lot_id]
    const target = pool?.targetUSDT ? parseFloat(pool.targetUSDT) : (openLot.gem_cost || 0)
    const raised = pool?.raisedUSDT ? parseFloat(pool.raisedUSDT) : 0
    const mine = myInvestments[openLot.contract_lot_id] || 0
    const notLinked = openLot.contract_lot_id == null

    return (
      <div className="px-3 mt-3 space-y-3">
        <button onClick={() => setOpenLot(null)}
          className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-400 border border-white/8 hover:bg-white/5">
          ← Назад к списку
        </button>

        {notLinked && (
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
            <div className="text-[12px] font-bold text-yellow-400">⚠️ Пул ещё не привязан к контракту</div>
            <div className="text-[10px] text-slate-400 mt-1">Покупка временно недоступна. Обратитесь к администратору.</div>
          </div>
        )}

        <DiamondLotVisual
          lot={openLot}
          targetUSDT={target}
          raisedUSDT={raised}
          myInvestedUSDT={mine}
          onBuy={notLinked ? null : handleBuy}
          disabled={txPending || notLinked}
          minBuyUSDT={1}
        />
      </div>
    )
  }

  return (
    <div className="px-3 mt-3 space-y-3">

      <div className="flex items-center justify-between">
        <div className="text-[14px] font-black text-gold-400">💎 Клубные пулы</div>
        <HelpButton section="lots" />
      </div>

      {/* Баланс маркетинга */}
      {wallet && parseFloat(mktBalance) > 0 && (
        <div className="p-3 rounded-2xl border" style={{ background: 'rgba(212,168,67,0.06)', borderColor: 'rgba(212,168,67,0.2)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400">Баланс маркетинга</div>
              <div className="text-lg font-black text-gold-400">${parseFloat(mktBalance).toFixed(2)} <span className="text-[10px] text-slate-500">USDT</span></div>
            </div>
            <button onClick={handleClaimMarketing} disabled={txPending}
              className="px-4 py-2 rounded-xl text-[11px] font-bold gold-btn disabled:opacity-50">
              💰 Вывести
            </button>
          </div>
        </div>
      )}

      {/* Табы */}
      <div className="flex gap-1">
        {[
          { id: 'active', label: `🟢 Активные (${activeLots.length})` },
          { id: 'my', label: `💰 Мои (${myLots.length})` },
          { id: 'history', label: `📜 История (${historyLots.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all ${
              tab === t.id
                ? 'bg-gold-400/15 border-gold-400/30 text-gold-400'
                : 'border-white/8 text-slate-500'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Список лотов */}
      {displayLots.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">{tab === 'active' ? '💎' : tab === 'my' ? '💰' : '📜'}</div>
          <div className="text-xs text-slate-500">
            {tab === 'active' ? 'Нет активных пулов' : tab === 'my' ? 'Вы ещё не вкладывали' : 'Нет завершённых пулов'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayLots.map(lot => {
            const pool = pools[lot.contract_lot_id]
            const target = pool?.targetUSDT ? parseFloat(pool.targetUSDT) : (lot.gem_cost || 0)
            const raised = pool?.raisedUSDT ? parseFloat(pool.raisedUSDT) : 0
            const mine = myInvestments[lot.contract_lot_id] || 0

            return (
              <PoolCard
                key={lot.id}
                lot={lot}
                target={target}
                raised={raised}
                mine={mine}
                pool={pool}
                onOpen={() => setOpenLot(lot)}
                onClaimComp={() => handleClaimCompensation(lot)}
                txPending={txPending}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══ КАРТОЧКА ПУЛА (компактная) ═══
function PoolCard({ lot, target, raised, mine, pool, onOpen, onClaimComp, txPending }) {
  const progressPct = target > 0 ? Math.min(100, (raised / target) * 100) : 0
  const minePct = target > 0 ? (mine / target) * 100 : 0
  const othersPct = Math.max(0, progressPct - minePct)

  const status = pool?.status ?? -1
  const statusInfo = STATUS_INFO[status] || { label: '⏳ Не привязан', color: 'text-yellow-400' }
  const isUnlocked = status === 5 || (pool?.unlocksAt && Date.now() / 1000 >= pool.unlocksAt)
  const canClaimComp = status === 7  // Drained

  return (
    <div className="p-4 rounded-2xl border" style={{ background: 'rgba(21,21,48,0.8)', borderColor: 'rgba(212,168,67,0.15)' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">💎</span>
            <span className="text-[14px] font-black text-white truncate">{lot.title}</span>
          </div>
          {lot.description && (
            <div className="text-[10px] text-slate-500 mt-0.5 ml-7 line-clamp-2">{lot.description}</div>
          )}
        </div>
        <div className={`text-[10px] font-bold ${statusInfo.color} ml-2 shrink-0`}>{statusInfo.label}</div>
      </div>

      {/* Tags */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {lot.carats && <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-slate-300">{lot.carats}ct</span>}
        {lot.shape && <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-slate-300">{lot.shape}</span>}
        {lot.clarity && <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-slate-300">{lot.clarity}</span>}
        {lot.color && <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-slate-300">{lot.color}</span>}
        {lot.has_cert && <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-[10px] text-emerald-400">📜 Серт.</span>}
      </div>

      {/* Стоимость + прогресс */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2 rounded-xl bg-white/3">
          <div className="text-[10px] text-slate-500">Цель сбора</div>
          <div className="text-[14px] font-black text-white">${target.toLocaleString()}</div>
        </div>
        <div className="p-2 rounded-xl bg-white/3">
          <div className="text-[10px] text-slate-500">Собрано</div>
          <div className="text-[14px] font-black text-gold-400">${raised.toLocaleString()}</div>
        </div>
      </div>

      {/* Прогресс-бар */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-slate-400">Прогресс</span>
          <span className="text-gold-400 font-bold">{progressPct.toFixed(1)}%</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full absolute top-0 left-0" style={{
            width: `${othersPct}%`,
            background: '#7c8796',
          }} />
          <div className="h-full absolute top-0" style={{
            left: `${othersPct}%`,
            width: `${minePct}%`,
            background: 'linear-gradient(90deg, #ffd700, #d4a843)',
          }} />
        </div>
      </div>

      {/* Моё вложение */}
      {mine > 0 && (
        <div className="p-2 rounded-xl bg-gold-400/8 border border-gold-400/15 mb-2">
          <div className="text-[11px] text-gold-400 font-bold">
            💰 Моё вложение: ${mine.toLocaleString()} USDT
          </div>
          {pool?.unlocksAt && (
            <div className="text-[9px] text-slate-500 mt-0.5">
              {isUnlocked
                ? '🔓 Можно делать redeem'
                : `❄️ Разморозка: ${new Date(pool.unlocksAt * 1000).toLocaleDateString('ru-RU')}`}
            </div>
          )}
        </div>
      )}

      {/* Не привязан */}
      {lot.contract_lot_id == null && (
        <div className="p-2 mb-2 rounded-xl bg-yellow-500/8 border border-yellow-500/15">
          <div className="text-[10px] text-yellow-400">⚠️ Пул ещё не привязан к контракту</div>
        </div>
      )}

      {/* Кнопки */}
      <div className="flex gap-2 mt-2">
        <button onClick={onOpen} disabled={txPending}
          className="flex-1 py-2.5 rounded-xl text-[12px] font-black gold-btn disabled:opacity-50">
          💎 Открыть пул
        </button>
        {canClaimComp && mine > 0 && (
          <button onClick={onClaimComp} disabled={txPending}
            className="py-2.5 px-3 rounded-xl text-[11px] font-bold text-teal-400 bg-teal-500/15 border border-teal-500/25 disabled:opacity-50">
            🔓 Компенсация
          </button>
        )}
      </div>
    </div>
  )
}
