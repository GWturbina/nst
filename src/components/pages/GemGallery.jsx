'use client'
/**
 * GemGallery.jsx — Галерея долевых камней
 * 
 * Визуализация: камень разделён на 100 частей.
 * Купленные доли — серые. Свободные — светятся.
 * Каждый камень с ID (C1.5W = кушон 1.5ct белый).
 * 
 * Данные из контракта FractionalGem (уже задеплоен).
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import { formatUSD } from '@/lib/gemCatalog'
import * as DCT from '@/lib/dctContracts'

const SHAPE_ICONS = {
  round: '🔵', princess: '🟦', cushion: '🟡', oval: '🟢',
  emerald: '🟩', pear: '🍐', heart: '❤️', trillion: '🔺', radiant: '💠',
}

export default function GemGallery() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [lots, setLots] = useState([])
  const [userLots, setUserLots] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedLot, setSelectedLot] = useState(null)
  const [buyAmount, setBuyAmount] = useState('1')
  const [showBuyModal, setShowBuyModal] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const allLots = await DCT.getAllFractionalLots().catch(() => [])
      // Только активные лоты (FUNDRAISING)
      const active = allLots.filter(l => l.status >= 1 && l.status <= 4)
      setLots(active)

      if (wallet) {
        const uLots = {}
        for (const lot of active) {
          const info = await DCT.getUserLotInfo(lot.id, wallet).catch(() => null)
          if (info) uLots[lot.id] = info
        }
        setUserLots(uLots)
      }
    } catch {}
    setLoading(false)
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  const handleBuyFractions = async () => {
    if (!showBuyModal || !buyAmount || parseInt(buyAmount) <= 0) return
    setTxPending(true)
    const result = await DCT.buyFractions(showBuyModal, parseInt(buyAmount)).then(
      () => ({ ok: true }),
      (err) => ({ ok: false, error: err?.reason || err?.message || 'Ошибка' })
    )
    setTxPending(false)
    if (result.ok) {
      addNotification(`✅ Куплено ${buyAmount} долей!`)
      setShowBuyModal(null); setBuyAmount('1'); reload()
    } else addNotification(`❌ ${result.error}`)
  }

  const MODE_LABELS = { 0: 'Создан', 1: '🟢 Сбор', 2: '⏳ Стейкинг', 3: '💍 Ювелирка', 4: '🏪 Продажа', 5: '✅ Продан', 6: '🔒 Закрыт' }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="text-2xl animate-spin">💎</div></div>

  return (
    <div className="px-3 mt-2 space-y-3">

      <div className="text-center">
        <div className="text-[14px] font-black text-gold-400">💎 Галерея долевых камней</div>
        <div className="text-[10px] text-slate-500 mt-1">Купи долю дорогого камня — получай доход</div>
      </div>

      {lots.length === 0 ? (
        <div className="py-12 text-center rounded-2xl" style={{background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.08)'}}>
          <div className="text-4xl mb-3">💎</div>
          <div className="text-[13px] font-bold text-slate-400">Нет доступных лотов</div>
          <div className="text-[11px] text-slate-600 mt-1">Камни для долевого участия появятся позже</div>
        </div>
      ) : (
        <div className="space-y-3">
          {lots.map(lot => {
            const myInfo = userLots[lot.id]
            const myFractions = myInfo?.fractions || 0
            const pctSold = lot.totalFractions > 0 ? Math.round(lot.soldFractions / lot.totalFractions * 100) : 0
            const remaining = lot.totalFractions - lot.soldFractions

            return (
              <div key={lot.id} className="rounded-2xl overflow-hidden"
                style={{background:'rgba(255,255,255,0.04)', border: myFractions > 0 ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.07)'}}>
                
                {/* Заголовок */}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{SHAPE_ICONS[lot.name?.toLowerCase()] || '💎'}</span>
                      <div>
                        <div className="text-[13px] font-black text-white">{lot.name || `Лот #${lot.id}`}</div>
                        <div className="text-[10px] text-slate-500">{lot.carats}ct • ID: {lot.gemId ? `G${lot.gemId}` : `L${lot.id}`}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[10px] font-bold ${lot.status===1?'text-emerald-400':lot.status===2?'text-blue-400':'text-slate-400'}`}>
                        {MODE_LABELS[lot.mode] || `Статус ${lot.mode}`}
                      </div>
                      {lot.stakingAPR > 0 && (
                        <div className="text-[9px] text-emerald-400">{lot.stakingAPR/100}% годовых</div>
                      )}
                    </div>
                  </div>

                  {/* Визуализация долей — сетка 10×10 */}
                  <div className="grid gap-[2px] mb-2" style={{gridTemplateColumns: 'repeat(10, 1fr)'}}>
                    {Array.from({length: lot.totalFractions > 100 ? 100 : lot.totalFractions}, (_, i) => {
                      // Определяем состояние доли
                      const soldCount = Math.round(lot.soldFractions * (lot.totalFractions > 100 ? 100 : lot.totalFractions) / lot.totalFractions)
                      const myCount = Math.round(myFractions * (lot.totalFractions > 100 ? 100 : lot.totalFractions) / lot.totalFractions)
                      
                      const isSold = i < soldCount
                      const isMine = i >= (soldCount - myCount) && i < soldCount && myFractions > 0

                      return (
                        <div key={i}
                          className="aspect-square rounded-sm transition-all"
                          style={{
                            background: isMine
                              ? 'rgba(255,215,0,0.6)'      // Мои — золотые
                              : isSold
                                ? 'rgba(100,100,120,0.3)'   // Чужие — серые
                                : 'rgba(16,185,129,0.4)',    // Свободные — зелёные, светятся
                            boxShadow: !isSold ? '0 0 4px rgba(16,185,129,0.5)' : 'none',
                          }}
                        />
                      )
                    })}
                  </div>

                  {/* Прогресс + цены */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-slate-400">
                      <span className="text-white font-bold">{lot.soldFractions}</span>/{lot.totalFractions} долей ({pctSold}%)
                    </div>
                    <div className="text-[10px] text-gold-400 font-bold">
                      {lot.fractionPriceDCT} DCT/доля
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

                  {/* Цены */}
                  <div className="grid grid-cols-3 gap-1 text-[9px] text-center mb-2">
                    <div className="p-1.5 rounded-lg bg-white/5">
                      <div className="text-slate-500">Себестоимость</div>
                      <div className="text-white font-bold">{formatUSD(parseFloat(lot.costPrice))}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/5">
                      <div className="text-slate-500">Клубная</div>
                      <div className="text-gold-400 font-bold">{formatUSD(parseFloat(lot.clubPrice))}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/5">
                      <div className="text-slate-500">Рыночная</div>
                      <div className="text-emerald-400 font-bold">{formatUSD(parseFloat(lot.wholesalePrice))}</div>
                    </div>
                  </div>

                  {/* Мои доли */}
                  {myFractions > 0 && (
                    <div className="p-2 rounded-xl bg-gold-400/8 border border-gold-400/15 mb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-gold-400 font-bold">Мои доли: {myFractions}</div>
                          <div className="text-[9px] text-slate-500">{myInfo?.ownershipPct ? (myInfo.ownershipPct/100).toFixed(1) : 0}% камня</div>
                        </div>
                        {parseFloat(myInfo?.claimableStaking || 0) > 0 && (
                          <div className="text-right">
                            <div className="text-[10px] text-emerald-400 font-bold">+${parseFloat(myInfo.claimableStaking).toFixed(2)}</div>
                            <div className="text-[8px] text-slate-500">доход</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Кнопка покупки */}
                  {remaining > 0 && lot.status === 1 && wallet && (
                    <button onClick={() => { setShowBuyModal(lot.id); setBuyAmount('1') }}
                      className="w-full py-2.5 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      🧩 Купить доли ({remaining} доступно)
                    </button>
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
        const lot = lots.find(l => l.id === showBuyModal)
        if (!lot) return null
        const remaining = lot.totalFractions - lot.soldFractions
        const totalCostDCT = parseInt(buyAmount || 0) * parseFloat(lot.fractionPriceDCT)

        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowBuyModal(null)}>
            <div className="w-full max-w-sm p-4 rounded-2xl" onClick={e => e.stopPropagation()}
              style={{background:'#12122a', border:'1px solid rgba(255,215,0,0.2)'}}>
              <div className="text-center mb-3">
                <div className="text-3xl mb-2">🧩</div>
                <div className="text-[14px] font-black text-white">Купить доли</div>
                <div className="text-[11px] text-slate-500">{lot.name || `Лот #${lot.id}`} • {lot.carats}ct</div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 text-center text-[9px]">
                <div className="p-1.5 rounded-lg bg-white/5">
                  <div className="text-[10px] font-bold text-white">{lot.fractionPriceDCT}</div>
                  <div className="text-slate-500">DCT/доля</div>
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
                {buyAmount && (
                  <div className="text-center mt-1 text-[10px] text-slate-400">
                    Итого: <span className="text-gold-400 font-bold">{totalCostDCT.toFixed(0)} DCT</span>
                  </div>
                )}
              </div>

              <button onClick={handleBuyFractions} disabled={txPending || !buyAmount || parseInt(buyAmount) <= 0}
                className="w-full py-3 rounded-xl text-sm font-bold gold-btn" style={{opacity:(!buyAmount||txPending)?0.5:1}}>
                {txPending ? '⏳ ...' : '🧩 Купить доли'}
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
