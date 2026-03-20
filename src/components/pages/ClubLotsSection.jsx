'use client'
/**
 * ClubLotsSection.jsx — Клубные лоты
 * Секция внутри DiamondClubPage
 * 
 * Функции партнёра:
 *   - Просмотр активных лотов с прогресс-баром
 *   - Покупка долей (USDT через блокчейн)
 *   - Покупка из баланса маркетинга
 *   - Мои доли и статус
 *   - Вывод реферальных
 *   - Компенсация через 6 мес
 *   - История завершённых лотов
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import { safeCall } from '@/lib/contracts'
import * as CL from '@/lib/clubLotsContracts'
import { authFetch } from '@/lib/authClient'

const STATUS_MAP = {
  active: { label: '🟢 Активный', color: 'text-emerald-400' },
  filled: { label: '🔵 Заполнен', color: 'text-blue-400' },
  revealing: { label: '🔮 Розыгрыш', color: 'text-purple-400' },
  completed: { label: '🏆 Завершён', color: 'text-gold-400' },
  unlocked: { label: '🔓 Разморожен', color: 'text-teal-400' },
  cancelled: { label: '❌ Отменён', color: 'text-red-400' },
}

export default function ClubLotsSection() {
  const { wallet, addNotification, t } = useGameStore()
  const [lots, setLots] = useState([])
  const [myShares, setMyShares] = useState({})
  const [mktBalance, setMktBalance] = useState('0')
  const [loading, setLoading] = useState(true)
  const [txPending, setTxPending] = useState(false)
  const [tab, setTab] = useState('active') // active / my / history
  const [buyModal, setBuyModal] = useState(null)
  const [buyCount, setBuyCount] = useState(1)
  const [useBalance, setUseBalance] = useState(false)

  // ═══ Загрузка данных ═══
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      // Из Supabase
      const res = await fetch(`/api/lots?status=all&wallet=${wallet || ''}`)
      const data = await res.json()
      if (data.ok) {
        setLots(data.lots || [])
        setMyShares(data.myShares || {})
      }
      // Баланс маркетинга (из контракта)
      if (wallet) {
        const bal = await CL.getMarketingBalance(wallet).catch(() => '0')
        setMktBalance(bal)
      }
    } catch {}
    setLoading(false)
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  // ═══ Покупка доли ═══
  const handleBuy = async () => {
    if (!buyModal || !wallet) return
    setTxPending(true)

    const result = await safeCall(async () => {
      if (useBalance) {
        return await CL.buyShareFromBalance(buyModal.contract_lot_id ?? buyModal.id, buyCount)
      } else {
        return await CL.buyShare(buyModal.contract_lot_id ?? buyModal.id, buyCount)
      }
    })

    if (result.ok) {
      // Записать в Supabase
      try {
        await authFetch('/api/lots', {
          method: 'PATCH',
          body: {
            action: 'record_purchase',
            wallet,
            lotId: buyModal.id,
            sharesCount: buyCount,
            usdtAmount: buyModal.share_price * buyCount,
            txHash: result.data?.hash || '',
          }
        })
      } catch {}

      addNotification(`✅ Куплено ${buyCount} доля(ей) в лоте «${buyModal.title}»!`)
      setBuyModal(null)
      setBuyCount(1)
      reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
    setTxPending(false)
  }

  // ═══ Вывод реферальных ═══
  const handleClaimEarnings = async () => {
    setTxPending(true)
    const result = await safeCall(() => CL.claimEarnings())
    if (result.ok) {
      addNotification('✅ Реферальные выведены!')
      reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
    setTxPending(false)
  }

  // ═══ Компенсация ═══
  const handleClaimCompensation = async (lotId) => {
    setTxPending(true)
    const result = await safeCall(() => CL.claimCompensation(lotId))
    if (result.ok) {
      addNotification('✅ Компенсация получена!')
      reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
    setTxPending(false)
  }

  // ═══ Фильтрация ═══
  const activeLots = lots.filter(l => l.status === 'active')
  const myLots = lots.filter(l => myShares[l.id] > 0)
  const historyLots = lots.filter(l => ['completed', 'unlocked', 'cancelled'].includes(l.status))

  const displayLots = tab === 'active' ? activeLots : tab === 'my' ? myLots : historyLots

  if (loading) {
    return (
      <div className="px-3 mt-4 text-center py-12">
        <div className="text-3xl animate-spin">🎟</div>
        <div className="text-xs text-slate-500 mt-2">Загрузка лотов...</div>
      </div>
    )
  }

  return (
    <div className="px-3 mt-3 space-y-3">

      {/* Баланс маркетинга */}
      {wallet && parseFloat(mktBalance) > 0 && (
        <div className="p-3 rounded-2xl border border-gold-400/20" style={{ background: 'rgba(212,168,67,0.06)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400">Баланс реферальных</div>
              <div className="text-lg font-black text-gold-400">${parseFloat(mktBalance).toFixed(2)} <span className="text-[10px] text-slate-500">USDT</span></div>
            </div>
            <button onClick={handleClaimEarnings} disabled={txPending}
              className="px-4 py-2 rounded-xl text-[11px] font-bold gold-btn disabled:opacity-50">
              💰 Вывести
            </button>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Или используйте для покупки долей — не нужно выводить
          </div>
        </div>
      )}

      {/* Табы */}
      <div className="flex gap-1">
        {[
          { id: 'active', label: `🟢 Активные (${activeLots.length})` },
          { id: 'my', label: `🎟 Мои (${myLots.length})` },
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
          <div className="text-2xl mb-2">{tab === 'active' ? '💎' : tab === 'my' ? '🎟' : '📜'}</div>
          <div className="text-xs text-slate-500">
            {tab === 'active' ? 'Нет активных лотов' : tab === 'my' ? 'Вы ещё не участвуете' : 'Нет завершённых лотов'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayLots.map(lot => (
            <LotCard
              key={lot.id}
              lot={lot}
              myShareCount={myShares[lot.id] || 0}
              wallet={wallet}
              onBuy={() => { setBuyModal(lot); setBuyCount(1); setUseBalance(false) }}
              onClaimComp={() => handleClaimCompensation(lot.id)}
              txPending={txPending}
            />
          ))}
        </div>
      )}

      {/* Модал покупки */}
      {buyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{ background: 'linear-gradient(180deg, #1a1040, #0c0c1e)', border: '1px solid rgba(212,168,67,0.2)' }}>
            <div className="text-center mb-4">
              <div className="text-2xl mb-1">🎟</div>
              <div className="text-base font-black text-white">{buyModal.title}</div>
              <div className="text-[11px] text-slate-400 mt-1">Цена доли: ${buyModal.share_price}</div>
            </div>

            {/* Количество */}
            <div className="mb-3">
              <div className="text-[11px] text-slate-400 mb-1">Количество долей:</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setBuyCount(Math.max(1, buyCount - 1))}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-bold">-</button>
                <input type="number" value={buyCount} onChange={e => setBuyCount(Math.max(1, Math.min(
                  buyModal.total_shares - buyModal.sold_shares - (buyModal.reserved_shares || 0),
                  parseInt(e.target.value) || 1
                )))}
                  className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-lg font-bold text-white outline-none text-center" />
                <button onClick={() => setBuyCount(Math.min(buyCount + 1, buyModal.total_shares - buyModal.sold_shares - (buyModal.reserved_shares || 0)))}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-bold">+</button>
              </div>
            </div>

            {/* Итого */}
            <div className="p-3 rounded-xl bg-white/5 mb-3">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">Итого:</span>
                <span className="text-gold-400 font-black">${(buyModal.share_price * buyCount).toFixed(2)} USDT</span>
              </div>
            </div>

            {/* Оплата из баланса */}
            {parseFloat(mktBalance) >= buyModal.share_price && (
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input type="checkbox" checked={useBalance} onChange={e => setUseBalance(e.target.checked)}
                  className="w-4 h-4 accent-yellow-500" />
                <span className="text-[11px] text-slate-300">
                  Оплатить из баланса реферальных (${parseFloat(mktBalance).toFixed(2)})
                </span>
              </label>
            )}

            {/* Кнопки */}
            <button onClick={handleBuy} disabled={txPending}
              className="w-full py-3 rounded-2xl text-sm font-black gold-btn disabled:opacity-50 mb-2">
              {txPending ? '⏳ Транзакция...' : `🎟 Купить ${buyCount} доля(ей)`}
            </button>
            <button onClick={() => setBuyModal(null)}
              className="w-full py-2 text-[11px] text-slate-500 hover:text-slate-300">
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// КАРТОЧКА ЛОТА
// ═══════════════════════════════════════════════════
function LotCard({ lot, myShareCount, wallet, onBuy, onClaimComp, txPending }) {
  const pctSold = lot.total_shares > 0
    ? Math.round(((lot.sold_shares + (lot.reserved_shares || 0)) / lot.total_shares) * 100)
    : 0
  const available = lot.total_shares - lot.sold_shares - (lot.reserved_shares || 0)
  const statusInfo = STATUS_MAP[lot.status] || STATUS_MAP.active
  const isWinner = lot.winner_wallet && wallet && lot.winner_wallet.toLowerCase() === wallet.toLowerCase()

  // Таймер до разморозки
  const unlockDate = lot.unlock_at ? new Date(lot.unlock_at) : null
  const now = new Date()
  const daysLeft = unlockDate ? Math.max(0, Math.ceil((unlockDate - now) / 86400000)) : null
  const canClaim = lot.status === 'completed' && unlockDate && now >= unlockDate && myShareCount > 0 && !isWinner

  return (
    <div className="p-4 rounded-2xl border" style={{ background: 'rgba(21,21,48,0.8)', borderColor: 'rgba(212,168,67,0.15)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">💎</span>
            <span className="text-[14px] font-black text-white">{lot.title}</span>
          </div>
          {lot.description && (
            <div className="text-[10px] text-slate-500 mt-0.5 ml-7">{lot.description}</div>
          )}
        </div>
        <div className={`text-[10px] font-bold ${statusInfo.color}`}>{statusInfo.label}</div>
      </div>

      {/* Specs */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {lot.carats && <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-slate-300">{lot.carats}ct</span>}
        {lot.shape && <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-slate-300">{lot.shape}</span>}
        {lot.clarity && <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-slate-300">{lot.clarity}</span>}
        {lot.color && <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-slate-300">{lot.color}</span>}
        {lot.has_cert && <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-[10px] text-emerald-400">📜 Серт.</span>}
      </div>

      {/* Prices */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 rounded-xl bg-white/3">
          <div className="text-[10px] text-slate-500">Камень</div>
          <div className="text-[13px] font-black text-white">${parseFloat(lot.gem_cost).toLocaleString()}</div>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/3">
          <div className="text-[10px] text-slate-500">Лот</div>
          <div className="text-[13px] font-black text-gold-400">${parseFloat(lot.lot_price).toLocaleString()}</div>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/3">
          <div className="text-[10px] text-slate-500">1 доля</div>
          <div className="text-[13px] font-black text-emerald-400">${parseFloat(lot.share_price)}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-slate-400">Продано: {lot.sold_shares}/{lot.total_shares}</span>
          <span className="text-gold-400 font-bold">{pctSold}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, pctSold)}%`,
              background: pctSold >= 100
                ? 'linear-gradient(90deg, #22c55e, #14b8a6)'
                : 'linear-gradient(90deg, #d4a843, #e8c96a)',
            }} />
        </div>
      </div>

      {/* My shares */}
      {myShareCount > 0 && (
        <div className="p-2 rounded-xl bg-gold-400/8 border border-gold-400/15 mb-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gold-400 font-bold">
              🎟 Мои доли: {myShareCount} (${(myShareCount * parseFloat(lot.share_price)).toFixed(0)})
            </span>
            {isWinner && <span className="text-[11px] text-emerald-400 font-bold">🏆 Вы получаете камень!</span>}
          </div>
        </div>
      )}

      {/* Winner info */}
      {lot.status === 'completed' && lot.winner_wallet && (
        <div className="p-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15 mb-2">
          <div className="text-[11px] text-emerald-400 font-bold">
            🏆 Получатель: {shortAddress(lot.winner_wallet)}
          </div>
          {daysLeft !== null && daysLeft > 0 && !isWinner && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              ❄️ Заморозка: {daysLeft} дн. до разморозки
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-2">
        {lot.status === 'active' && available > 0 && wallet && (
          <button onClick={onBuy} disabled={txPending}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-black gold-btn disabled:opacity-50">
            🎟 Купить долю (${parseFloat(lot.share_price)})
          </button>
        )}

        {canClaim && (
          <button onClick={onClaimComp} disabled={txPending}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-black bg-teal-500/20 border border-teal-500/30 text-teal-400 disabled:opacity-50">
            🔓 Получить компенсацию
          </button>
        )}

        {lot.status === 'active' && available === 0 && (
          <div className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-center text-slate-500 bg-white/3">
            Все доли проданы
          </div>
        )}
      </div>

      {/* Min level */}
      {lot.min_gw_level > 1 && (
        <div className="text-[9px] text-slate-600 mt-2 text-center">
          Минимальный уровень GlobalWay: {lot.min_gw_level}
        </div>
      )}
    </div>
  )
}
