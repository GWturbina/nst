'use client'
/**
 * DCT Diamond Club v2.3 — упрощённая страница
 * 
 * Изменения от v3.2:
 * - Убраны секции: Bridge (DCTBridge удалён, DCT начисляется сразу),
 *                  Exchange (биржа DCT/USDT — будет в v2.4),
 *                  DEX (P2P для долей теперь внутри ClubPools),
 *                  Heritage (DCTHeritage удалён),
 *                  NFT Showcase (заменено на ClubMarket в DiamondClubPage)
 * - Оставлены: Обзор (баланс DCT, holdings), Фракции (пулы — список с возможностью купить долю)
 * - Добавлено: Redeem — выкуп DCT за USDT по текущей или защитной цене
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import * as Club from '@/lib/clubV23'
import { safeCall } from '@/lib/contracts'
import { shortAddress } from '@/lib/web3'
import ADDRESSES from '@/contracts/addresses'
import HelpButton from '@/components/ui/HelpButton'

// ═════════════════════════════════════════════════════════
// MAIN: DCTPage
// ═════════════════════════════════════════════════════════
export default function DCTPage() {
  const { wallet } = useGameStore()
  const [section, setSection] = useState('dashboard')

  const sections = [
    { id: 'dashboard',  icon: '📊', label: 'Обзор' },
    { id: 'pools',      icon: '💎', label: 'Пулы' },
    { id: 'redeem',     icon: '💰', label: 'Выкуп' },
  ]

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <div className="flex items-center justify-between px-3 pt-3">
        <h2 className="text-lg font-black text-emerald-400">🪙 DCT Diamond Club</h2>
        <HelpButton section={section} />
      </div>

      <div className="flex gap-1 px-3 mt-2">
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${
              section === s.id
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'border-white/8 text-slate-500'
            }`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {!wallet ? (
        <div className="mx-3 mt-4 p-4 rounded-2xl glass text-center">
          <div className="text-3xl mb-2">🔐</div>
          <div className="text-sm font-bold text-slate-300">Подключите кошелёк</div>
          <div className="text-[11px] text-slate-500 mt-1">SafePal для доступа к DCT</div>
        </div>
      ) : (
        <>
          {section === 'dashboard' && <DashboardSection />}
          {section === 'pools'     && <PoolsSection />}
          {section === 'redeem'    && <RedeemSection />}
        </>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// SHARED
// ═════════════════════════════════════════════════════════
function Loading() {
  return <div className="flex items-center justify-center py-12"><div className="text-2xl animate-spin">🪙</div></div>
}

function ErrorCard({ text }) {
  return <div className="mx-3 mt-4 p-4 rounded-2xl glass text-center text-red-400 text-[12px]">❌ {text}</div>
}

function StatCard({ label, value, color }) {
  return (
    <div className="p-2 rounded-2xl glass text-center">
      <div className={`text-lg font-black ${color}`}>{value}</div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// DASHBOARD — баланс DCT + holdings по пулам
// ═════════════════════════════════════════════════════════
function DashboardSection() {
  const { wallet } = useGameStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wallet) return
    setLoading(true)
    Club.loadDashboard(wallet)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [wallet])

  if (loading) return <Loading />
  if (!data) return <ErrorCard text="Ошибка загрузки" />

  const dctTotal = parseFloat(data.dctInfo?.total || 0)
  const dctFrozen = parseFloat(data.dctInfo?.frozen || 0)
  const dctUnlocked = parseFloat(data.dctInfo?.unlocked || 0)

  return (
    <div className="px-3 mt-3 space-y-2">
      {/* Главный баланс */}
      <div className="p-4 rounded-2xl glass text-center">
        <div className="text-[11px] text-slate-500 mb-1">Всего DCT</div>
        <div className="text-3xl font-black text-emerald-400">{dctTotal.toFixed(2)}</div>
        <div className="text-[10px] text-slate-500 mt-1">токенов клуба</div>
      </div>

      {/* Свободно / Заморожено */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] text-slate-500">Свободно</div>
          <div className="text-xl font-black text-emerald-400">{dctUnlocked.toFixed(2)}</div>
          <div className="text-[9px] text-slate-500">можно потратить</div>
        </div>
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] text-slate-500">Заморожено</div>
          <div className="text-xl font-black text-blue-400">{dctFrozen.toFixed(2)}</div>
          <div className="text-[9px] text-slate-500">размораживается</div>
        </div>
      </div>

      {/* Объяснение */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-blue-400 mb-2">📚 Что такое DCT</div>
        <div className="text-[10px] text-slate-400 space-y-1.5">
          <div>• DCT — токен клуба, который ты получаешь когда покупаешь долю в пуле</div>
          <div>• 1 USDT = 2 DCT (стартовая цена $0.50)</div>
          <div>• DCT замораживается на 1 год — это защита клуба</div>
          <div>• После разморозки можешь обменять на USDT по текущей цене</div>
          <div>• Защитная цена выкупа $0.56 действует в форс-мажоре</div>
        </div>
      </div>

      {/* Holdings по пулам */}
      {data.holdings && data.holdings.length > 0 && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[12px] font-bold text-gold-400 mb-2">
            💎 Мои доли в пулах ({data.holdings.length})
          </div>
          <div className="space-y-1.5">
            {data.holdings.map((h, i) => <HoldingRow key={i} holding={h} />)}
          </div>
        </div>
      )}

      {/* Резерв клуба */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-purple-400 mb-1">🛡️ Резерв клуба</div>
        <div className="text-2xl font-black text-purple-400">${parseFloat(data.reserveBalance || 0).toFixed(2)}</div>
        <div className="text-[9px] text-slate-500 mt-0.5">
          Защитный фонд для выкупа DCT по цене $0.56 в форс-мажоре
        </div>
      </div>
    </div>
  )
}

function HoldingRow({ holding }) {
  const now = Math.floor(Date.now() / 1000)
  const daysLeft = Math.max(0, Math.ceil((holding.unlocksAt - now) / 86400))
  const unlocked = holding.unlocksAt <= now
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
      <div>
        <span className="text-[11px] font-bold text-white">Пул #{holding.poolId}</span>
        <span className="text-[10px] text-slate-500 ml-2">{parseFloat(holding.amount).toFixed(2)} DCT</span>
      </div>
      <div className="text-right">
        <div className={`text-[10px] font-bold ${unlocked ? 'text-emerald-400' : 'text-blue-400'}`}>
          {unlocked ? '✅ Свободно' : `🔒 ${daysLeft} дн`}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// POOLS — список пулов с возможностью купить долю
// ═════════════════════════════════════════════════════════
function PoolsSection() {
  const { wallet, addNotification, txPending, setTxPending } = useGameStore()
  const [pools, setPools] = useState([])
  const [loading, setLoading] = useState(true)
  const [buyModal, setBuyModal] = useState(null)
  const [buyCount, setBuyCount] = useState(1)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const all = await Club.getAllPools()
      setPools(all.filter(p => p.status <= 2))   // активные + funded + gem куплен
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleBuy = async () => {
    if (!buyModal || !wallet) return
    setTxPending(true)
    const result = await safeCall(() => Club.buyShare(buyModal.poolId, buyCount))
    setTxPending(false)
    if (result.ok) {
      addNotification(`✅ Куплено ${buyCount} доля(ей) в пуле «${buyModal.name}»`)
      setBuyModal(null)
      setBuyCount(1)
      reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="px-3 mt-3 space-y-2">
      <div className="text-[12px] font-bold text-gold-400">💎 Активные пулы ({pools.length})</div>

      {pools.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-2">💎</div>
          <div className="text-xs text-slate-500">Нет активных пулов</div>
        </div>
      ) : (
        <div className="space-y-2">
          {pools.map(p => <PoolCard key={p.poolId} pool={p} onBuy={() => { setBuyModal(p); setBuyCount(1) }} />)}
        </div>
      )}

      {/* Модал покупки */}
      {buyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{ background: 'linear-gradient(180deg, #1a1040, #0c0c1e)', border: '1px solid rgba(212,168,67,0.2)' }}>
            <div className="text-center mb-4">
              <div className="text-2xl mb-1">💎</div>
              <div className="text-base font-black text-white">{buyModal.name}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Цена доли: ${parseFloat(buyModal.sharePrice).toFixed(2)}
              </div>
            </div>

            <div className="mb-3">
              <div className="text-[11px] text-slate-400 mb-1">Количество долей:</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setBuyCount(Math.max(1, buyCount - 1))}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-bold">-</button>
                <input type="number" value={buyCount} onChange={e => setBuyCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-lg font-bold text-white outline-none text-center" />
                <button onClick={() => setBuyCount(buyCount + 1)}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-bold">+</button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 mb-3">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">Итого:</span>
                <span className="text-emerald-400 font-black">
                  ${(parseFloat(buyModal.sharePrice) * buyCount).toFixed(2)} USDT
                </span>
              </div>
              <div className="flex justify-between text-[10px] mt-1">
                <span className="text-slate-500">Получишь:</span>
                <span className="text-gold-400">
                  ≈ {(parseFloat(buyModal.sharePrice) * buyCount * 2).toFixed(2)} DCT
                </span>
              </div>
            </div>

            <button onClick={handleBuy} disabled={txPending}
              className="w-full py-3 rounded-2xl text-sm font-black gold-btn disabled:opacity-50 mb-2">
              {txPending ? '⏳ Транзакция...' : `💎 Купить ${buyCount} доля(ей)`}
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

function PoolCard({ pool, onBuy }) {
  const pctSold = pool.totalShares > 0
    ? Math.round((pool.sharesSold / pool.totalShares) * 100)
    : 0
  const available = pool.totalShares - pool.sharesSold
  
  const STATUS_NAMES = ['🟢 Сбор', '🔵 Собран', '🟡 Камень куплен', '🏆 Продано', '❌ Отменён', '🚨 Drained']
  const statusLabel = STATUS_NAMES[pool.status] || '?'
  
  return (
    <div className="p-3 rounded-2xl border" style={{ background: 'rgba(21,21,48,0.8)', borderColor: 'rgba(212,168,67,0.15)' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="text-[13px] font-black text-white">{pool.name}</div>
          <div className="text-[9px] text-slate-500 mt-0.5">#{pool.poolId} • {statusLabel}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">Цена доли</div>
          <div className="text-[13px] font-black text-emerald-400">${parseFloat(pool.sharePrice).toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="text-center p-2 rounded-xl bg-white/3">
          <div className="text-[10px] text-slate-500">Цель</div>
          <div className="text-[12px] font-black text-gold-400">${parseFloat(pool.targetUSDT).toFixed(0)}</div>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/3">
          <div className="text-[10px] text-slate-500">Собрано</div>
          <div className="text-[12px] font-black text-blue-400">${parseFloat(pool.collectedUSDT).toFixed(0)}</div>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-slate-400">Доли: {pool.sharesSold}/{pool.totalShares}</span>
          <span className="text-gold-400 font-bold">{pctSold}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full"
            style={{
              width: `${Math.min(100, pctSold)}%`,
              background: 'linear-gradient(90deg, #d4a843, #e8c96a)',
            }} />
        </div>
      </div>

      {pool.status === 0 && available > 0 && (
        <button onClick={onBuy}
          className="w-full mt-2 py-2.5 rounded-xl text-[12px] font-black gold-btn">
          💎 Купить долю
        </button>
      )}
      {pool.minGWLevel > 1 && (
        <div className="text-[9px] text-slate-600 mt-1 text-center">
          Минимум GW level {pool.minGWLevel}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// REDEEM — выкуп DCT за USDT
// ═════════════════════════════════════════════════════════
function RedeemSection() {
  const { wallet, addNotification, txPending, setTxPending } = useGameStore()
  const [pools, setPools] = useState([])
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const [redeemModal, setRedeemModal] = useState(null)
  const [redeemAmount, setRedeemAmount] = useState('0')
  const [redeemMode, setRedeemMode] = useState('current')   // 'current' | 'floor'

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [allPools, h] = await Promise.all([
        Club.getAllPools(),
        Club.getDCTHoldings(wallet),
      ])
      setPools(allPools)
      setHoldings(h || [])
    } catch {}
    setLoading(false)
  }, [wallet])

  useEffect(() => { if (wallet) reload() }, [reload, wallet])

  const handleRedeem = async () => {
    if (!redeemModal) return
    setTxPending(true)
    let result
    if (redeemMode === 'floor') {
      result = await safeCall(() => Club.redeemAtFloor(redeemModal.poolId))
    } else {
      result = await safeCall(() => Club.redeem(redeemModal.poolId, redeemAmount))
    }
    setTxPending(false)
    if (result.ok) {
      addNotification(`✅ Выкуп выполнен!`)
      setRedeemModal(null)
      reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
  }

  if (loading) return <Loading />

  // Объединяем holdings с информацией о пуле
  const myHoldingsWithPool = holdings.map(h => {
    const pool = pools.find(p => p.poolId === h.poolId)
    return { ...h, pool }
  }).filter(h => h.pool)

  return (
    <div className="px-3 mt-3 space-y-2">
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-blue-400 mb-1">💡 Как работает выкуп</div>
        <div className="text-[10px] text-slate-400 space-y-1">
          <div>• <b>Текущая цена</b> — выкуп DCT по рыночной цене пула. Только для <b>свободных</b> DCT.</div>
          <div>• <b>Защитная цена $0.56</b> — экстренный выкуп когда пул в состоянии "Drained" (форс-мажор).</div>
          <div>• Свежие DCT заморожены на 1 год — можно выкупать только разморозённые.</div>
        </div>
      </div>

      {myHoldingsWithPool.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-2">💰</div>
          <div className="text-xs text-slate-500">У тебя нет долей для выкупа</div>
          <div className="text-[10px] text-slate-600 mt-1">Купи доли в "Пулы"</div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[12px] font-bold text-gold-400">Мои доли</div>
          {myHoldingsWithPool.map((h, i) => <RedeemCard key={i} holding={h} pool={h.pool} onRedeem={(mode) => {
            setRedeemMode(mode)
            setRedeemModal(h.pool)
            setRedeemAmount(h.amount)
          }} />)}
        </div>
      )}

      {/* Модал выкупа */}
      {redeemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{ background: 'linear-gradient(180deg, #1a1040, #0c0c1e)', border: '1px solid rgba(212,168,67,0.2)' }}>
            <div className="text-center mb-4">
              <div className="text-2xl mb-1">{redeemMode === 'floor' ? '🛡️' : '💰'}</div>
              <div className="text-base font-black text-white">
                {redeemMode === 'floor' ? 'Защитный выкуп' : 'Выкуп по рыночной цене'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{redeemModal.name}</div>
            </div>

            {redeemMode === 'current' && (
              <div className="mb-3">
                <div className="text-[11px] text-slate-400 mb-1">Сколько DCT выкупить:</div>
                <input type="number" value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-lg font-bold text-white outline-none text-center" />
              </div>
            )}

            <div className="p-3 rounded-xl bg-white/5 mb-3">
              {redeemMode === 'floor' ? (
                <div className="text-[10px] text-slate-400 space-y-1">
                  <div>Цена защитного выкупа: <span className="text-gold-400 font-bold">$0.56 за DCT</span></div>
                  <div>Будут выкуплены ВСЕ свободные DCT этого пула</div>
                </div>
              ) : (
                <div className="text-[10px] text-slate-400">
                  Цена выкупа считается контрактом на основе текущего treasury пула
                </div>
              )}
            </div>

            <button onClick={handleRedeem} disabled={txPending}
              className="w-full py-3 rounded-2xl text-sm font-black gold-btn disabled:opacity-50 mb-2">
              {txPending ? '⏳ Транзакция...' : `${redeemMode === 'floor' ? '🛡️ Защитный выкуп' : '💰 Выкупить'}`}
            </button>
            <button onClick={() => setRedeemModal(null)}
              className="w-full py-2 text-[11px] text-slate-500 hover:text-slate-300">
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RedeemCard({ holding, pool, onRedeem }) {
  const now = Math.floor(Date.now() / 1000)
  const daysLeft = Math.max(0, Math.ceil((holding.unlocksAt - now) / 86400))
  const unlocked = holding.unlocksAt <= now
  const drained = pool.status === 5
  
  return (
    <div className="p-3 rounded-2xl border border-white/8 bg-white/3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[12px] font-bold text-white">{pool.name}</div>
          <div className="text-[9px] text-slate-500">#{pool.poolId} • {parseFloat(holding.amount).toFixed(2)} DCT</div>
        </div>
        <div className={`text-[10px] font-bold ${unlocked ? 'text-emerald-400' : 'text-blue-400'}`}>
          {unlocked ? '✅ Свободно' : `🔒 ${daysLeft} дн`}
        </div>
      </div>

      <div className="flex gap-2 mt-2">
        {unlocked && !drained && (
          <button onClick={() => onRedeem('current')}
            className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            💰 Выкуп по рыночной
          </button>
        )}
        {drained && (
          <button onClick={() => onRedeem('floor')}
            className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/20">
            🛡️ Защитный выкуп
          </button>
        )}
        {!unlocked && !drained && (
          <div className="flex-1 py-2 rounded-xl text-[11px] font-bold text-center text-slate-500 bg-white/3">
            Жди разморозки
          </div>
        )}
      </div>
    </div>
  )
}
