'use client'
/**
 * GemGallery.jsx — Галерея пулов клуба (визуализация долей)
 * 
 * АДАПТАЦИЯ под v2.3:
 * - Импорт: dctContracts → clubV23
 * - Источник данных: getAllFractionalLots → getAllPools
 * - Покупка: buyFractions (за DCT) → buyShare (за USDT, DCT начисляется)
 * - Поля пула изменены: lot.totalFractions → pool.totalShares, lot.fractionPriceDCT → pool.sharePrice (USDT)
 * - Удалены поля: stakingAPR, costPrice, clubPrice, wholesalePrice, claimableStaking
 *   (эти данные в v2.3 не на блокчейне — могут быть в Supabase /api/lots если нужны)
 * - Визуализация (сетка долей) — без изменений
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import { formatUSD } from '@/lib/gemCatalog'
import * as Club from '@/lib/clubV23'

export default function GemGallery() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [pools, setPools] = useState([])
  const [userInvestments, setUserInvestments] = useState({})  // poolId → USDT invested
  const [loading, setLoading] = useState(true)
  const [showBuyModal, setShowBuyModal] = useState(null)
  const [buyAmount, setBuyAmount] = useState('1')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const allPools = await Club.getAllPools().catch(() => [])
      // Только активные пулы (status: 0=Сбор, 1=Собран, 2=Камень куплен)
      const active = allPools.filter(p => p.status >= 0 && p.status <= 2)
      setPools(active)

      if (wallet) {
        const investments = {}
        for (const pool of active) {
          const inv = await Club.getUserInvestment(wallet, pool.poolId).catch(() => '0')
          if (parseFloat(inv) > 0) investments[pool.poolId] = inv
        }
        setUserInvestments(investments)
      }
    } catch {}
    setLoading(false)
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  const handleBuyShares = async () => {
    if (!showBuyModal || !buyAmount || parseInt(buyAmount) <= 0) return
    setTxPending(true)
    const result = await Club.buyShare(showBuyModal, parseInt(buyAmount)).then(
      () => ({ ok: true }),
      (err) => ({ ok: false, error: err?.reason || err?.message || 'Ошибка' })
    )
    setTxPending(false)
    if (result.ok) {
      addNotification(`✅ Куплено ${buyAmount} долей!`)
      setShowBuyModal(null); setBuyAmount('1'); reload()
    } else addNotification(`❌ ${result.error}`)
  }

  const STATUS_LABELS = {
    0: '🟢 Сбор',
    1: '🔵 Собран',
    2: '🟡 Камень куплен',
    3: '🏆 Продано',
    4: '❌ Отменён',
    5: '🚨 Drained',
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="text-2xl animate-spin">💎</div></div>

  return (
    <div className="px-3 mt-2 space-y-3">

      <div className="text-center">
        <div className="text-[14px] font-black text-gold-400">💎 Галерея пулов</div>
        <div className="text-[10px] text-slate-500 mt-1">Купи долю в пуле — получи DCT и долю в камне</div>
      </div>

      {pools.length === 0 ? (
        <div className="py-12 text-center rounded-2xl" style={{background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.08)'}}>
          <div className="text-4xl mb-3">💎</div>
          <div className="text-[13px] font-bold text-slate-400">Нет активных пулов</div>
          <div className="text-[11px] text-slate-600 mt-1">Пулы появятся когда клуб откроет новый сбор</div>
        </div>
      ) : (
        <div className="space-y-3">
          {pools.map(pool => {
            // Считаем мои доли через USDT инвестиции / цену доли
            const myInvestmentUSDT = parseFloat(userInvestments[pool.poolId] || 0)
            const sharePrice = parseFloat(pool.sharePrice)
            const myShares = sharePrice > 0 ? Math.round(myInvestmentUSDT / sharePrice) : 0
            
            const pctSold = pool.totalShares > 0 ? Math.round(pool.sharesSold / pool.totalShares * 100) : 0
            const remaining = pool.totalShares - pool.sharesSold

            return (
              <div key={pool.poolId} className="rounded-2xl overflow-hidden"
                style={{background:'rgba(255,255,255,0.04)', border: myShares > 0 ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.07)'}}>
                
                {/* Заголовок */}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💎</span>
                      <div>
                        <div className="text-[13px] font-black text-white">{pool.name || `Пул #${pool.poolId}`}</div>
                        <div className="text-[10px] text-slate-500">ID: P{pool.poolId}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[10px] font-bold ${pool.status===0?'text-emerald-400':pool.status===1?'text-blue-400':'text-amber-400'}`}>
                        {STATUS_LABELS[pool.status] || `Статус ${pool.status}`}
                      </div>
                      {pool.minGWLevel > 1 && (
                        <div className="text-[9px] text-slate-500">мин. уровень {pool.minGWLevel}</div>
                      )}
                    </div>
                  </div>

                  {/* Визуализация долей — сетка 10×10 */}
                  <div className="grid gap-[2px] mb-2" style={{gridTemplateColumns: 'repeat(10, 1fr)'}}>
                    {Array.from({length: pool.totalShares > 100 ? 100 : pool.totalShares}, (_, i) => {
                      // Масштабируем количество долей к 100 ячейкам
                      const scale = (pool.totalShares > 100 ? 100 : pool.totalShares) / pool.totalShares
                      const soldCount = Math.round(pool.sharesSold * scale)
                      const myCount = Math.round(myShares * scale)
                      
                      const isSold = i < soldCount
                      const isMine = i >= (soldCount - myCount) && i < soldCount && myShares > 0

                      return (
                        <div key={i}
                          className="aspect-square rounded-sm transition-all"
                          style={{
                            background: isMine
                              ? 'rgba(255,215,0,0.6)'      // Мои — золотые
                              : isSold
                                ? 'rgba(100,100,120,0.3)'   // Чужие — серые
                                : 'rgba(16,185,129,0.4)',    // Свободные — зелёные
                            boxShadow: !isSold ? '0 0 4px rgba(16,185,129,0.5)' : 'none',
                          }}
                        />
                      )
                    })}
                  </div>

                  {/* Прогресс + цена */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-slate-400">
                      <span className="text-white font-bold">{pool.sharesSold}</span>/{pool.totalShares} долей ({pctSold}%)
                    </div>
                    <div className="text-[10px] text-gold-400 font-bold">
                      ${sharePrice.toFixed(2)} USDT/доля
                    </div>
                  </div>

                  {/* Прогресс-бар */}
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all" 
                      style={{
                        width: `${pctSold}%`,
                        background: pctSold >= 100 ? '#10B981' : 'linear-gradient(90deg, #FFD700, #F59E0B)'
                      }} />
                  </div>

                  {/* Цели */}
                  <div className="grid grid-cols-2 gap-1 text-[9px] text-center mb-2">
                    <div className="p-1.5 rounded-lg bg-white/5">
                      <div className="text-slate-500">Цель сбора</div>
                      <div className="text-gold-400 font-bold">{formatUSD(parseFloat(pool.targetUSDT))}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/5">
                      <div className="text-slate-500">Собрано</div>
                      <div className="text-emerald-400 font-bold">{formatUSD(parseFloat(pool.collectedUSDT))}</div>
                    </div>
                  </div>

                  {/* Мои доли */}
                  {myShares > 0 && (
                    <div className="p-2 rounded-xl bg-gold-400/8 border border-gold-400/15 mb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-gold-400 font-bold">Мои доли: {myShares}</div>
                          <div className="text-[9px] text-slate-500">
                            ${myInvestmentUSDT.toFixed(2)} вложено • {((myShares / pool.totalShares) * 100).toFixed(1)}% пула
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Кнопка покупки */}
                  {remaining > 0 && pool.status === 0 && wallet && (
                    <button onClick={() => { setShowBuyModal(pool.poolId); setBuyAmount('1') }}
                      className="w-full py-2.5 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      🧩 Купить доли ({remaining} доступно)
                    </button>
                  )}
                  {pool.status >= 1 && (
                    <div className="w-full py-2.5 rounded-xl text-[11px] font-bold text-center text-slate-500 bg-white/3">
                      Сбор закрыт
                    </div>
                  )}
                </div>

                {/* Легенда */}
                <div className="px-3 pb-2 flex items-center gap-3 text-[8px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{background:'rgba(16,185,129,0.4)', boxShadow:'0 0 3px rgba(16,185,129,0.5)'}} />
                    Свободно
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{background:'rgba(255,215,0,0.6)'}} />
                    Мои
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{background:'rgba(100,100,120,0.3)'}} />
                    Продано
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Модалка покупки долей */}
      {showBuyModal !== null && (() => {
        const pool = pools.find(p => p.poolId === showBuyModal)
        if (!pool) return null
        const remaining = pool.totalShares - pool.sharesSold
        const sharePrice = parseFloat(pool.sharePrice)
        const totalCostUSDT = parseInt(buyAmount || 0) * sharePrice
        // 1 USDT = 2 DCT (стартовая цена)
        const dctReceived = totalCostUSDT * 2

        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowBuyModal(null)}>
            <div className="w-full max-w-sm p-4 rounded-2xl" onClick={e => e.stopPropagation()}
              style={{background:'#12122a', border:'1px solid rgba(255,215,0,0.2)'}}>
              <div className="text-center mb-3">
                <div className="text-3xl mb-2">🧩</div>
                <div className="text-[14px] font-black text-white">Купить доли</div>
                <div className="text-[11px] text-slate-500">{pool.name || `Пул #${pool.poolId}`}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 text-center text-[9px]">
                <div className="p-1.5 rounded-lg bg-white/5">
                  <div className="text-[10px] font-bold text-white">${sharePrice.toFixed(2)}</div>
                  <div className="text-slate-500">USDT/доля</div>
                </div>
                <div className="p-1.5 rounded-lg bg-white/5">
                  <div className="text-[10px] font-bold text-emerald-400">{remaining}</div>
                  <div className="text-slate-500">Доступно</div>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-[10px] text-slate-500 mb-1">Количество долей</div>
                <input type="number" value={buyAmount} onChange={e => setBuyAmount(e.target.value)}
                  placeholder="1" min="1" max={remaining}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-lg font-bold text-white outline-none text-center" />
                {buyAmount && parseInt(buyAmount) > 0 && (
                  <div className="text-center mt-2 space-y-1">
                    <div className="text-[10px] text-slate-400">
                      Заплатишь: <span className="text-gold-400 font-bold">${totalCostUSDT.toFixed(2)} USDT</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Получишь: <span className="text-emerald-400 font-bold">{dctReceived.toFixed(2)} DCT</span>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={handleBuyShares} disabled={txPending || !buyAmount || parseInt(buyAmount) <= 0}
                className="w-full py-3 rounded-xl text-sm font-bold gold-btn" style={{opacity:(!buyAmount||txPending)?0.5:1}}>
                {txPending ? '⏳ ...' : '🧩 Купить'}
              </button>
              <button onClick={() => setShowBuyModal(null)}
                className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold text-slate-500 border border-white/8">Отмена</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
