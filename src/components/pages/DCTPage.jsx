'use client'
/**
 * DCT Diamond Club v3.2 — Полная страница
 * DCTToken + DCTBridge + FractionalGem + GemShowcase + DCTExchange + GemFractionDEX + DCTHeritage
 * Deployed: 09.03.2026 on opBNB Mainnet
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import * as DCT from '@/lib/dctContracts'
import { safeCall } from '@/lib/contracts'
import { shortAddress } from '@/lib/web3'
import ADDRESSES from '@/contracts/addresses'

// ═════════════════════════════════════════════════════════
// MAIN: DCTPage
// ═════════════════════════════════════════════════════════
export default function DCTPage() {
  const { wallet, t } = useGameStore()
  const [section, setSection] = useState('dashboard')

  const sections = [
    { id: 'dashboard',  icon: '📊', label: 'Обзор' },
    { id: 'bridge',     icon: '🌉', label: 'Мост' },
    { id: 'fractions',  icon: '💎', label: 'Фракции' },
    { id: 'showcase',   icon: '🏪', label: 'Витрина' },
    { id: 'exchange',   icon: '📈', label: 'Биржа' },
    { id: 'dex',        icon: '🔄', label: 'DEX' },
    { id: 'heritage',   icon: '🏛️', label: 'Наследство' },
  ]

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      {/* Заголовок */}
      <div className="px-3 pt-3 pb-1">
        <h2 className="text-lg font-black text-emerald-400">🪙 DCT Diamond Club</h2>
        <p className="text-[11px] text-slate-500">Токенизация активов v3.2</p>
      </div>

      {/* Sub-навигация */}
      <div className="flex gap-1 px-3 mt-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
              section === s.id
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'border-white/8 text-slate-500'
            }`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Подключи кошелёк */}
      {!wallet ? (
        <div className="mx-3 mt-4 p-4 rounded-2xl glass text-center">
          <div className="text-3xl mb-2">🔐</div>
          <div className="text-sm font-bold text-slate-300">Подключите кошелёк</div>
          <div className="text-[11px] text-slate-500 mt-1">SafePal для доступа к DCT</div>
        </div>
      ) : (
        <>
          {section === 'dashboard'  && <DashboardSection />}
          {section === 'bridge'     && <BridgeSection />}
          {section === 'fractions'  && <FractionsSection />}
          {section === 'showcase'   && <ShowcaseSection />}
          {section === 'exchange'   && <ExchangeSection />}
          {section === 'dex'        && <DEXSection />}
          {section === 'heritage'   && <HeritageSection />}
        </>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// SHARED COMPONENTS
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
function SectionTitle({ icon, text, color = 'text-emerald-400' }) {
  return <div className={`text-[12px] font-bold ${color} mb-2`}>{icon} {text}</div>
}

// ═════════════════════════════════════════════════════════
// 1. DASHBOARD — Обзор DCT
// ═════════════════════════════════════════════════════════
function DashboardSection() {
  const { wallet } = useGameStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wallet) return
    setLoading(true)
    DCT.loadDCTDashboard(wallet).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [wallet])

  if (loading) return <Loading />
  if (!data) return <ErrorCard text="Ошибка загрузки" />

  const { tokenInfo, userInfo, claimableGems, exchangeStats, bestPrices, heritageInfo } = data
  const claimableCount = (claimableGems?.purchaseIds?.length || 0)

  return (
    <div className="px-3 mt-2 space-y-2">
      {/* DCT Token */}
      {tokenInfo && (
        <div className="p-4 rounded-2xl glass">
          <SectionTitle icon="🪙" text="DCT Token" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-white/5">
              <div className="text-[14px] font-black text-emerald-400">${parseFloat(tokenInfo.price).toFixed(4)}</div>
              <div className="text-[8px] text-slate-500">Цена</div>
            </div>
            <div className="p-2 rounded-xl bg-white/5">
              <div className="text-[14px] font-black text-blue-400">{parseFloat(tokenInfo.supply).toFixed(0)}</div>
              <div className="text-[8px] text-slate-500">Эмиссия</div>
            </div>
            <div className="p-2 rounded-xl bg-white/5">
              <div className="text-[14px] font-black text-gold-400">${parseFloat(tokenInfo.backing).toFixed(0)}</div>
              <div className="text-[8px] text-slate-500">Обеспечение</div>
            </div>
          </div>
          {tokenInfo.paused && (
            <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center text-[10px] text-red-400 font-bold">
              ⚠️ Токен приостановлен
            </div>
          )}
        </div>
      )}

      {/* Мой баланс */}
      {userInfo && (
        <div className="p-4 rounded-2xl glass">
          <SectionTitle icon="👛" text="Мой баланс" color="text-gold-400" />
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-white/5 text-center">
              <div className="text-xl font-black text-gold-400">{parseFloat(userInfo.free).toFixed(2)}</div>
              <div className="text-[9px] text-slate-500">DCT свободно</div>
            </div>
            <div className="p-3 rounded-xl bg-white/5 text-center">
              <div className="text-xl font-black text-purple-400">{parseFloat(userInfo.locked).toFixed(2)}</div>
              <div className="text-[9px] text-slate-500">DCT заблок.</div>
            </div>
          </div>
          <div className="mt-2 p-2 rounded-lg bg-emerald-500/5 text-center">
            <span className="text-[10px] text-slate-400">Стоимость: </span>
            <span className="text-[12px] font-bold text-emerald-400">${parseFloat(userInfo.valueUSDT).toFixed(2)} USDT</span>
          </div>
        </div>
      )}

      {/* Мост — если есть что клеймить */}
      {claimableCount > 0 && (
        <div className="p-3 rounded-2xl glass border border-emerald-500/15">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-bold text-emerald-400">🌉 Доступно для клейма</div>
              <div className="text-[10px] text-slate-400">{claimableCount} покупок → DCT</div>
            </div>
            <div className="text-lg font-black text-emerald-400">
              {claimableGems.estimatedDCT.reduce((s, v) => s + parseFloat(v), 0).toFixed(2)} DCT
            </div>
          </div>
        </div>
      )}

      {/* Биржа */}
      {exchangeStats && (
        <div className="p-3 rounded-2xl glass">
          <SectionTitle icon="📈" text="Биржа DCT" color="text-blue-400" />
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[11px] font-black text-emerald-400">{exchangeStats.trades}</div>
              <div className="text-[8px] text-slate-500">Сделок</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[11px] font-black text-gold-400">${parseFloat(exchangeStats.volumeUSDT).toFixed(0)}</div>
              <div className="text-[8px] text-slate-500">Оборот USDT</div>
            </div>
          </div>
          {bestPrices && (
            <div className="mt-2 flex gap-2">
              <div className="flex-1 p-2 rounded-lg bg-emerald-500/5 text-center">
                <div className="text-[10px] font-bold text-emerald-400">${parseFloat(bestPrices.bestBid).toFixed(4)}</div>
                <div className="text-[8px] text-slate-500">Лучш. покупка</div>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-red-500/5 text-center">
                <div className="text-[10px] font-bold text-red-400">${parseFloat(bestPrices.bestAsk).toFixed(4)}</div>
                <div className="text-[8px] text-slate-500">Лучш. продажа</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Наследство */}
      {heritageInfo && heritageInfo.active && (
        <div className="p-3 rounded-2xl glass">
          <SectionTitle icon="🏛️" text="Наследство" color="text-purple-400" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[11px] font-black text-purple-400">{heritageInfo.heirCount}</div>
              <div className="text-[8px] text-slate-500">Наследников</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[11px] font-black text-gold-400">{heritageInfo.inactivityDays} дн</div>
              <div className="text-[8px] text-slate-500">Неактивность</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className={`text-[11px] font-black ${heritageInfo.canExecuteNow ? 'text-red-400' : 'text-emerald-400'}`}>
                {heritageInfo.canExecuteNow ? '⚠️' : '✅'}
              </div>
              <div className="text-[8px] text-slate-500">Статус</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// 2. BRIDGE — Мост GemVault → DCT
// ═════════════════════════════════════════════════════════
function BridgeSection() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [claimableGems, setClaimableGems] = useState({ purchaseIds: [], marketValues: [], estimatedDCT: [] })
  const [claimableMetals, setClaimableMetals] = useState({ purchaseIds: [], marketValues: [], estimatedDCT: [] })
  const [backingRate, setBackingRate] = useState(0)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!wallet) return
    setLoading(true)
    const [gems, metals, rate] = await Promise.all([
      DCT.getClaimableGems(wallet).catch(() => ({ purchaseIds: [], marketValues: [], estimatedDCT: [] })),
      DCT.getClaimableMetals(wallet).catch(() => ({ purchaseIds: [], marketValues: [], estimatedDCT: [] })),
      DCT.getBridgeBackingRate().catch(() => 0),
    ])
    setClaimableGems(gems); setClaimableMetals(metals); setBackingRate(rate); setLoading(false)
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  const handleClaimSingle = async (purchaseId) => {
    setTxPending(true)
    const r = await safeCall(() => DCT.claimGemDCT(purchaseId))
    setTxPending(false)
    if (r.ok) { addNotification(`✅ DCT получен за покупку #${purchaseId}`); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleClaimAllGems = async () => {
    setTxPending(true)
    const r = await safeCall(() => DCT.claimAllGemDCT())
    setTxPending(false)
    if (r.ok) { addNotification('✅ Все DCT за камни получены!'); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleClaimAllMetals = async () => {
    setTxPending(true)
    const r = await safeCall(() => DCT.claimAllMetalDCT())
    setTxPending(false)
    if (r.ok) { addNotification('✅ Все DCT за металлы получены!'); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  if (loading) return <Loading />

  const totalGemDCT = claimableGems.estimatedDCT.reduce((s, v) => s + parseFloat(v), 0)
  const totalMetalDCT = claimableMetals.estimatedDCT.reduce((s, v) => s + parseFloat(v), 0)

  return (
    <div className="px-3 mt-2 space-y-2">
      <div className="p-4 rounded-2xl glass text-center">
        <div className="text-3xl mb-2">🌉</div>
        <div className="text-[14px] font-black text-white">DCT Bridge</div>
        <div className="text-[11px] text-slate-400">Конвертация активов Diamond Club → DCT токены</div>
        {backingRate > 0 && (
          <div className="mt-2 text-[10px] text-emerald-400">Backing rate: {backingRate / 100}%</div>
        )}
      </div>

      {/* Камни */}
      <div className="p-3 rounded-2xl glass">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle icon="💎" text={`Камни (${claimableGems.purchaseIds.length})`} />
          {claimableGems.purchaseIds.length > 0 && (
            <button onClick={handleClaimAllGems} disabled={txPending}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              {txPending ? '⏳' : `🪙 Забрать все (${totalGemDCT.toFixed(2)} DCT)`}
            </button>
          )}
        </div>
        {claimableGems.purchaseIds.length === 0 ? (
          <div className="text-[11px] text-slate-500 text-center py-3">Нет доступных камней для конвертации</div>
        ) : (
          <div className="space-y-1.5">
            {claimableGems.purchaseIds.map((pid, i) => (
              <div key={pid} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <div>
                  <span className="text-[11px] font-bold text-white">#{pid}</span>
                  <span className="text-[10px] text-slate-500 ml-2">${claimableGems.marketValues[i]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-emerald-400">{parseFloat(claimableGems.estimatedDCT[i]).toFixed(2)} DCT</span>
                  <button onClick={() => handleClaimSingle(pid)} disabled={txPending}
                    className="px-2 py-1 rounded-lg text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    {txPending ? '⏳' : '🪙'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Металлы */}
      <div className="p-3 rounded-2xl glass">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle icon="🥇" text={`Металлы (${claimableMetals.purchaseIds.length})`} color="text-yellow-400" />
          {claimableMetals.purchaseIds.length > 0 && (
            <button onClick={handleClaimAllMetals} disabled={txPending}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
              {txPending ? '⏳' : `🪙 Забрать все (${totalMetalDCT.toFixed(2)} DCT)`}
            </button>
          )}
        </div>
        {claimableMetals.purchaseIds.length === 0 ? (
          <div className="text-[11px] text-slate-500 text-center py-3">Нет доступных металлов для конвертации</div>
        ) : (
          <div className="space-y-1.5">
            {claimableMetals.purchaseIds.map((pid, i) => (
              <div key={pid} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <div>
                  <span className="text-[11px] font-bold text-white">#{pid}</span>
                  <span className="text-[10px] text-slate-500 ml-2">${claimableMetals.marketValues[i]}</span>
                </div>
                <span className="text-[11px] font-bold text-yellow-400">{parseFloat(claimableMetals.estimatedDCT[i]).toFixed(2)} DCT</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// 3. FRACTIONS — Дробные камни
// ═════════════════════════════════════════════════════════
function FractionsSection() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [view, setView] = useState('lots') // lots | my | prices
  const [lots, setLots] = useState([])
  const [priceTable, setPriceTable] = useState([])
  const [loading, setLoading] = useState(true)
  const [buyModal, setBuyModal] = useState(null)
  const [buyAmount, setBuyAmount] = useState('')
  const [buyMode, setBuyMode] = useState('fractions') // fractions | whole

  const reload = useCallback(async () => {
    setLoading(true)
    const l = await DCT.getAllFractionalLots().catch(() => [])
    setLots(l); setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const loadPrices = async () => {
    setLoading(true)
    const p = await DCT.getGemPriceTable().catch(() => [])
    setPriceTable(p); setLoading(false)
  }

  const handleBuyFractions = async () => {
    if (!buyModal || !buyAmount || parseInt(buyAmount) <= 0) return
    setTxPending(true)
    const r = await safeCall(() => DCT.buyFractions(buyModal.lotId, parseInt(buyAmount)))
    setTxPending(false)
    if (r.ok) { addNotification(`✅ ${buyAmount} фракций лота #${buyModal.lotId} куплено!`); setBuyModal(null); setBuyAmount(''); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleBuyWhole = async (lotId) => {
    setTxPending(true)
    const r = await safeCall(() => DCT.buyWholeGem(lotId))
    setTxPending(false)
    if (r.ok) { addNotification(`✅ Лот #${lotId} куплен целиком!`); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleClaimStaking = async (lotId) => {
    setTxPending(true)
    const r = await safeCall(() => DCT.claimFractionalStaking(lotId))
    setTxPending(false)
    if (r.ok) { addNotification(`✅ Стейкинг лота #${lotId} получен!`); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleVote = async (lotId) => {
    setTxPending(true)
    const r = await safeCall(() => DCT.voteForLotSale(lotId))
    setTxPending(false)
    if (r.ok) { addNotification(`✅ Голос за продажу лота #${lotId}`); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleClaimSale = async (lotId) => {
    setTxPending(true)
    const r = await safeCall(() => DCT.claimLotSaleProceeds(lotId))
    setTxPending(false)
    if (r.ok) { addNotification(`✅ Средства от продажи лота #${lotId} получены!`); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const STATUS_COLORS = {
    CREATED: 'text-slate-400', FUNDRAISING: 'text-blue-400', FUNDED: 'text-emerald-400',
    JEWELRY: 'text-pink-400', FOR_SALE: 'text-gold-400', SOLD: 'text-purple-400', CANCELLED: 'text-red-400'
  }

  return (
    <div className="px-3 mt-2 space-y-2">
      {/* Tabs */}
      <div className="flex gap-1">
        {[
          { id: 'lots', icon: '💎', label: 'Лоты' },
          { id: 'my', icon: '👛', label: 'Мои фракции' },
          { id: 'prices', icon: '💰', label: 'Прайс' },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setView(tab.id); if (tab.id === 'prices' && priceTable.length === 0) loadPrices() }}
            className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all ${
              view === tab.id ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'border-white/8 text-slate-500'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <>
          {/* Все лоты */}
          {view === 'lots' && (
            lots.length === 0 ? (
              <div className="p-6 rounded-2xl glass text-center">
                <div className="text-3xl mb-2">💎</div>
                <div className="text-[12px] text-slate-400">Нет доступных лотов</div>
              </div>
            ) : (
              <div className="space-y-2">
                {lots.map(lot => (
                  <LotCard key={lot.lotId} lot={lot}
                    onBuyFractions={() => { setBuyModal(lot); setBuyAmount(''); setBuyMode('fractions') }}
                    onBuyWhole={() => handleBuyWhole(lot.lotId)}
                    onClaimStaking={() => handleClaimStaking(lot.lotId)}
                    onVote={() => handleVote(lot.lotId)}
                    onClaimSale={() => handleClaimSale(lot.lotId)}
                    txPending={txPending}
                    wallet={wallet}
                    STATUS_COLORS={STATUS_COLORS}
                  />
                ))}
              </div>
            )
          )}

          {/* Мои фракции */}
          {view === 'my' && <MyFractionsView wallet={wallet} lots={lots} />}

          {/* Прайс-лист */}
          {view === 'prices' && (
            priceTable.length === 0 ? (
              <div className="p-6 rounded-2xl glass text-center text-[12px] text-slate-400">Нет данных</div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-5 gap-1 px-2 text-[8px] text-slate-500 font-bold">
                  <div>Карат</div><div>Себест.</div><div>Клуб</div><div>Опт</div><div>Рынок</div>
                </div>
                {priceTable.map(p => (
                  <div key={p.caratX100} className="grid grid-cols-5 gap-1 px-2 py-1.5 rounded-lg bg-white/3 text-[9px]">
                    <div className="font-bold text-white">{p.carat} ct</div>
                    <div className="text-slate-400">${p.noCert.cost}</div>
                    <div className="text-emerald-400">${p.noCert.club}</div>
                    <div className="text-blue-400">${p.noCert.wholesale}</div>
                    <div className="text-gold-400">${p.noCert.market}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Модалка покупки фракций */}
      {buyModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setBuyModal(null)}>
          <div className="w-full max-w-sm p-4 rounded-2xl" onClick={e => e.stopPropagation()}
            style={{ background: '#12122a', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="text-center mb-3">
              <div className="text-3xl mb-2">💎</div>
              <div className="text-[14px] font-black text-white">Купить фракции</div>
              <div className="text-[11px] text-slate-500">
                {buyModal.name} • {buyModal.carat} ct • #{buyModal.lotId}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Доступно: {buyModal.totalFractions - buyModal.soldFractions} из {buyModal.totalFractions} • {buyModal.fractionPriceDCT} DCT/фр
              </div>
            </div>
            <div className="mb-3">
              <input type="number" value={buyAmount} onChange={e => setBuyAmount(e.target.value)}
                placeholder="Количество фракций" max={buyModal.totalFractions - buyModal.soldFractions}
                className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-lg font-bold text-white outline-none text-center" />
              {buyAmount && (
                <div className="text-center mt-1 text-[10px] text-emerald-400">
                  Итого: {(parseFloat(buyModal.fractionPriceDCT) * parseInt(buyAmount || 0)).toFixed(2)} DCT
                </div>
              )}
            </div>
            <button onClick={handleBuyFractions} disabled={txPending || !buyAmount}
              className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              style={{ opacity: (!buyAmount || txPending) ? 0.5 : 1 }}>
              {txPending ? '⏳ ...' : `💎 Купить ${buyAmount || 0} фракций`}
            </button>
            <button onClick={() => setBuyModal(null)}
              className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold text-slate-500 border border-white/8">Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Карточка лота
function LotCard({ lot, onBuyFractions, onBuyWhole, onClaimStaking, onVote, onClaimSale, txPending, wallet, STATUS_COLORS }) {
  const available = lot.totalFractions - lot.soldFractions
  const progress = lot.totalFractions > 0 ? (lot.soldFractions / lot.totalFractions * 100) : 0
  const [userInfo, setUserInfo] = useState(null)
  const [claimable, setClaimable] = useState('0')

  useEffect(() => {
    if (!wallet) return
    DCT.getUserLotInfo(lot.lotId, wallet).then(setUserInfo).catch(() => {})
    DCT.getClaimableStaking(lot.lotId, wallet).then(setClaimable).catch(() => {})
  }, [lot.lotId, wallet])

  return (
    <div className="p-3 rounded-2xl glass">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-black text-white">💎 #{lot.lotId}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${STATUS_COLORS[lot.statusName] || ''} bg-white/5`}>
            {lot.statusName}
          </span>
          {lot.certified && (
            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              ✅ {lot.certLab}
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-500">{lot.carat} ct</div>
      </div>

      {/* Name + Image */}
      <div className="text-[12px] font-bold text-slate-200 mb-1">{lot.name}</div>

      {/* Progress */}
      <div className="mb-2">
        <div className="flex justify-between text-[9px] text-slate-500 mb-1">
          <span>{lot.soldFractions}/{lot.totalFractions} фракций</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/5">
          <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-3 gap-1 mb-2 text-center">
        <div className="p-1.5 rounded-lg bg-white/5">
          <div className="text-[10px] font-bold text-emerald-400">{lot.fractionPriceDCT} DCT</div>
          <div className="text-[7px] text-slate-500">Цена/фр</div>
        </div>
        <div className="p-1.5 rounded-lg bg-white/5">
          <div className="text-[10px] font-bold text-gold-400">{lot.stakingAPR}%</div>
          <div className="text-[7px] text-slate-500">APR</div>
        </div>
        <div className="p-1.5 rounded-lg bg-white/5">
          <div className="text-[10px] font-bold text-blue-400">{lot.stakingDays} дн</div>
          <div className="text-[7px] text-slate-500">Период</div>
        </div>
      </div>

      {/* User info */}
      {userInfo && userInfo.fractions > 0 && (
        <div className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/10 mb-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Мои фракции: <b className="text-purple-400">{userInfo.fractions}</b> ({userInfo.ownershipPct}%)</span>
            {parseFloat(claimable) > 0 && (
              <span className="text-emerald-400 font-bold">+${claimable}</span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-1">
        {lot.statusName === 'FUNDRAISING' && available > 0 && (
          <>
            <button onClick={onBuyFractions} disabled={txPending}
              className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              💎 Купить фракции
            </button>
            {available === lot.totalFractions && (
              <button onClick={onBuyWhole} disabled={txPending}
                className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-gold-400/15 text-gold-400 border border-gold-400/20">
                🏆 Купить целиком
              </button>
            )}
          </>
        )}
        {userInfo && userInfo.fractions > 0 && parseFloat(claimable) > 0 && (
          <button onClick={onClaimStaking} disabled={txPending}
            className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            💰 Забрать стейкинг
          </button>
        )}
        {userInfo && userInfo.fractions > 0 && !userInfo.voted && lot.statusName === 'FUNDED' && (
          <button onClick={onVote} disabled={txPending}
            className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
            🗳️ За продажу
          </button>
        )}
        {userInfo && userInfo.fractions > 0 && lot.statusName === 'SOLD' && (
          <button onClick={onClaimSale} disabled={txPending}
            className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-gold-400/15 text-gold-400 border border-gold-400/20">
            💰 Забрать средства
          </button>
        )}
      </div>
    </div>
  )
}

// Мои фракции
function MyFractionsView({ wallet, lots }) {
  const [myLots, setMyLots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wallet || lots.length === 0) { setLoading(false); return }
    setLoading(true)
    Promise.all(lots.map(async lot => {
      const info = await DCT.getUserLotInfo(lot.lotId, wallet).catch(() => null)
      return info && info.fractions > 0 ? { ...lot, userInfo: info } : null
    })).then(results => {
      setMyLots(results.filter(Boolean))
      setLoading(false)
    })
  }, [wallet, lots])

  if (loading) return <Loading />
  if (myLots.length === 0) {
    return (
      <div className="p-6 rounded-2xl glass text-center">
        <div className="text-3xl mb-2">👛</div>
        <div className="text-[12px] text-slate-400">У вас нет фракций</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {myLots.map(lot => (
        <div key={lot.lotId} className="p-3 rounded-2xl glass">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-black text-white">💎 {lot.name}</span>
            <span className="text-[10px] text-slate-500">#{lot.lotId}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[12px] font-black text-purple-400">{lot.userInfo.fractions}</div>
              <div className="text-[8px] text-slate-500">Фракций</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[12px] font-black text-emerald-400">{lot.userInfo.ownershipPct}%</div>
              <div className="text-[8px] text-slate-500">Доля</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[12px] font-black text-gold-400">${lot.userInfo.claimable}</div>
              <div className="text-[8px] text-slate-500">К выплате</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// 4. SHOWCASE — Витрина лотов
// ═════════════════════════════════════════════════════════
function ShowcaseSection() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [listings, setListings] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newLot, setNewLot] = useState({ lotId: '', price: '' })

  const reload = useCallback(async () => {
    setLoading(true)
    const [l, c] = await Promise.all([
      DCT.getGemShowcaseListings().catch(() => []),
      DCT.getGemShowcaseCount().catch(() => 0),
    ])
    setListings(l); setCount(c); setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleCreate = async () => {
    if (!newLot.lotId || !newLot.price) return
    setTxPending(true)
    const r = await safeCall(() => DCT.createGemShowcaseListing(parseInt(newLot.lotId), newLot.price))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Лот выставлен на витрину!'); setShowCreate(false); setNewLot({ lotId: '', price: '' }); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleBuy = async (id) => {
    setTxPending(true)
    const r = await safeCall(() => DCT.buyFromGemShowcase(id))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Куплено с витрины!'); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleCancel = async (id) => {
    setTxPending(true)
    const r = await safeCall(() => DCT.cancelGemShowcaseListing(id))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Снято с витрины'); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  if (loading) return <Loading />

  return (
    <div className="px-3 mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <SectionTitle icon="🏪" text={`Витрина (${listings.filter(l=>l.active).length})`} />
        <button onClick={() => setShowCreate(!showCreate)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${
            showCreate ? 'border-white/10 text-slate-400' : 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10'
          }`}>
          {showCreate ? '✕ Закрыть' : '+ Выставить'}
        </button>
      </div>

      {showCreate && (
        <div className="p-3 rounded-2xl glass space-y-2" style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
          <input type="number" value={newLot.lotId} onChange={e => setNewLot(l => ({ ...l, lotId: e.target.value }))}
            placeholder="ID лота" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          <input type="number" value={newLot.price} onChange={e => setNewLot(l => ({ ...l, price: e.target.value }))}
            placeholder="Цена (USDT)" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          <button onClick={handleCreate} disabled={txPending || !newLot.lotId || !newLot.price}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
            style={{ opacity: txPending ? 0.5 : 1 }}>
            {txPending ? '⏳' : '🏪 Опубликовать'}
          </button>
        </div>
      )}

      {listings.filter(l => l.active && !l.sold).length === 0 ? (
        <div className="p-6 rounded-2xl glass text-center">
          <div className="text-3xl mb-2">🏪</div>
          <div className="text-[12px] text-slate-400">Витрина пуста</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {listings.filter(l => l.active && !l.sold).map((l, i) => {
            const isMine = wallet && l.seller.toLowerCase() === wallet.toLowerCase()
            return (
              <div key={i} className="p-3 rounded-xl glass">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-[12px] font-black text-white">Лот #{l.lotId}</span>
                    <span className="text-[9px] text-slate-500 ml-2">{shortAddress(l.seller)}</span>
                    {isMine && <span className="text-[8px] text-gold-400 ml-1">• вы</span>}
                  </div>
                  <div className="text-[14px] font-black text-gold-400">${parseFloat(l.salePrice).toLocaleString()}</div>
                </div>
                <div className="flex gap-1">
                  {isMine ? (
                    <button onClick={() => handleCancel(i)} disabled={txPending}
                      className="px-3 py-1.5 rounded-lg text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
                      ✕ Снять
                    </button>
                  ) : (
                    <button onClick={() => handleBuy(i)} disabled={txPending}
                      className="px-3 py-1.5 rounded-lg text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      {txPending ? '⏳' : '💰 Купить'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// 5. EXCHANGE — Биржа DCT/USDT
// ═════════════════════════════════════════════════════════
function ExchangeSection() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [stats, setStats] = useState(null)
  const [bestPrices, setBestPrices] = useState(null)
  const [sellOrders, setSellOrders] = useState([])
  const [buyOrders, setBuyOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('book') // book | sell | buy
  const [orderForm, setOrderForm] = useState({ amount: '', price: '' })

  const reload = useCallback(async () => {
    setLoading(true)
    const [s, bp, sell, buy] = await Promise.all([
      DCT.getExchangeStats().catch(() => null),
      DCT.getExchangeBestPrices().catch(() => null),
      DCT.getActiveSellOrders().catch(() => []),
      DCT.getActiveBuyOrders().catch(() => []),
    ])
    setStats(s); setBestPrices(bp); setSellOrders(sell); setBuyOrders(buy); setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleCreateSell = async () => {
    if (!orderForm.amount || !orderForm.price) return
    setTxPending(true)
    const r = await safeCall(() => DCT.createSellOrderDCT(orderForm.amount, orderForm.price))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Ордер на продажу создан!'); setOrderForm({ amount: '', price: '' }); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleCreateBuy = async () => {
    if (!orderForm.amount || !orderForm.price) return
    setTxPending(true)
    const r = await safeCall(() => DCT.createBuyOrderDCT(orderForm.amount, orderForm.price))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Ордер на покупку создан!'); setOrderForm({ amount: '', price: '' }); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleFillSell = async (orderId, amount) => {
    setTxPending(true)
    const r = await safeCall(() => DCT.fillSellOrderDCT(orderId, amount))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Покупка DCT!'); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleFillBuy = async (orderId, amount) => {
    setTxPending(true)
    const r = await safeCall(() => DCT.fillBuyOrderDCT(orderId, amount))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Продажа DCT!'); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleCancel = async (orderId) => {
    setTxPending(true)
    const r = await safeCall(() => DCT.cancelExchangeOrder(orderId))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Ордер отменён'); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  if (loading) return <Loading />

  return (
    <div className="px-3 mt-2 space-y-2">
      {/* Stats */}
      {stats && (
        <div className="p-3 rounded-2xl glass">
          <SectionTitle icon="📈" text="DCT Exchange" color="text-blue-400" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[11px] font-black text-blue-400">{stats.trades}</div>
              <div className="text-[8px] text-slate-500">Сделок</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[11px] font-black text-gold-400">${parseFloat(stats.volumeUSDT).toFixed(0)}</div>
              <div className="text-[8px] text-slate-500">Оборот</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[11px] font-black text-red-400">{parseFloat(stats.burnedDCT).toFixed(0)}</div>
              <div className="text-[8px] text-slate-500">Сожжено</div>
            </div>
          </div>
          {bestPrices && (
            <div className="mt-2 flex gap-2">
              <div className="flex-1 p-2 rounded-lg bg-emerald-500/5 text-center">
                <div className="text-[11px] font-bold text-emerald-400">${parseFloat(bestPrices.bestBid).toFixed(4)}</div>
                <div className="text-[8px] text-slate-500">Bid</div>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-red-500/5 text-center">
                <div className="text-[11px] font-bold text-red-400">${parseFloat(bestPrices.bestAsk).toFixed(4)}</div>
                <div className="text-[8px] text-slate-500">Ask</div>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-gold-400/5 text-center">
                <div className="text-[11px] font-bold text-gold-400">${parseFloat(stats.backingPrice).toFixed(4)}</div>
                <div className="text-[8px] text-slate-500">Backing</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1">
        {[
          { id: 'book', label: '📖 Стакан' },
          { id: 'sell', label: '📤 Продать DCT' },
          { id: 'buy', label: '📥 Купить DCT' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all ${
              tab === t.id ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'border-white/8 text-slate-500'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Order Book */}
      {tab === 'book' && (
        <div className="space-y-2">
          {/* Sell orders (asks) */}
          <div className="p-3 rounded-2xl glass">
            <div className="text-[11px] font-bold text-red-400 mb-1">📤 Продажа ({sellOrders.length})</div>
            {sellOrders.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-2">Нет ордеров</div>
            ) : (
              <div className="space-y-1">
                {sellOrders.slice(0, 10).map(o => {
                  const isMine = wallet && o.maker.toLowerCase() === wallet.toLowerCase()
                  const remaining = (parseFloat(o.dctAmount) - parseFloat(o.dctFilled)).toFixed(2)
                  return (
                    <div key={o.orderId} className="flex items-center justify-between p-1.5 rounded-lg bg-red-500/5">
                      <div>
                        <span className="text-[10px] font-bold text-red-400">${parseFloat(o.pricePerDCT).toFixed(4)}</span>
                        <span className="text-[9px] text-slate-500 ml-2">{remaining} DCT</span>
                        {isMine && <span className="text-[8px] text-gold-400 ml-1">•вы</span>}
                      </div>
                      {isMine ? (
                        <button onClick={() => handleCancel(o.orderId)} disabled={txPending}
                          className="px-2 py-0.5 rounded text-[8px] font-bold text-red-400 bg-red-500/10">✕</button>
                      ) : (
                        <button onClick={() => handleFillSell(o.orderId, remaining)} disabled={txPending}
                          className="px-2 py-0.5 rounded text-[8px] font-bold text-emerald-400 bg-emerald-500/10">
                          Купить
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Buy orders (bids) */}
          <div className="p-3 rounded-2xl glass">
            <div className="text-[11px] font-bold text-emerald-400 mb-1">📥 Покупка ({buyOrders.length})</div>
            {buyOrders.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-2">Нет ордеров</div>
            ) : (
              <div className="space-y-1">
                {buyOrders.slice(0, 10).map(o => {
                  const isMine = wallet && o.maker.toLowerCase() === wallet.toLowerCase()
                  const remaining = (parseFloat(o.dctAmount) - parseFloat(o.dctFilled)).toFixed(2)
                  return (
                    <div key={o.orderId} className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-500/5">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-400">${parseFloat(o.pricePerDCT).toFixed(4)}</span>
                        <span className="text-[9px] text-slate-500 ml-2">{remaining} DCT</span>
                        {isMine && <span className="text-[8px] text-gold-400 ml-1">•вы</span>}
                      </div>
                      {isMine ? (
                        <button onClick={() => handleCancel(o.orderId)} disabled={txPending}
                          className="px-2 py-0.5 rounded text-[8px] font-bold text-red-400 bg-red-500/10">✕</button>
                      ) : (
                        <button onClick={() => handleFillBuy(o.orderId, remaining)} disabled={txPending}
                          className="px-2 py-0.5 rounded text-[8px] font-bold text-red-400 bg-red-500/10">
                          Продать
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Sell */}
      {tab === 'sell' && (
        <div className="p-3 rounded-2xl glass space-y-2">
          <SectionTitle icon="📤" text="Продать DCT" color="text-red-400" />
          <input type="number" value={orderForm.amount} onChange={e => setOrderForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="Количество DCT" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          <input type="number" value={orderForm.price} onChange={e => setOrderForm(f => ({ ...f, price: e.target.value }))}
            placeholder="Цена за 1 DCT (USDT)" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          {orderForm.amount && orderForm.price && (
            <div className="text-center text-[10px] text-gold-400">
              Итого: ${(parseFloat(orderForm.amount) * parseFloat(orderForm.price)).toFixed(2)} USDT
            </div>
          )}
          <button onClick={handleCreateSell} disabled={txPending || !orderForm.amount || !orderForm.price}
            className="w-full py-3 rounded-xl text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/20"
            style={{ opacity: txPending ? 0.5 : 1 }}>
            {txPending ? '⏳' : '📤 Создать ордер на продажу'}
          </button>
        </div>
      )}

      {/* Create Buy */}
      {tab === 'buy' && (
        <div className="p-3 rounded-2xl glass space-y-2">
          <SectionTitle icon="📥" text="Купить DCT" color="text-emerald-400" />
          <input type="number" value={orderForm.amount} onChange={e => setOrderForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="Количество DCT" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          <input type="number" value={orderForm.price} onChange={e => setOrderForm(f => ({ ...f, price: e.target.value }))}
            placeholder="Цена за 1 DCT (USDT)" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          {orderForm.amount && orderForm.price && (
            <div className="text-center text-[10px] text-gold-400">
              Итого: ${(parseFloat(orderForm.amount) * parseFloat(orderForm.price)).toFixed(2)} USDT
            </div>
          )}
          <button onClick={handleCreateBuy} disabled={txPending || !orderForm.amount || !orderForm.price}
            className="w-full py-3 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
            style={{ opacity: txPending ? 0.5 : 1 }}>
            {txPending ? '⏳' : '📥 Создать ордер на покупку'}
          </button>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// 6. DEX — Вторичный рынок фракций
// ═════════════════════════════════════════════════════════
function DEXSection() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [lotId, setLotId] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [sellForm, setSellForm] = useState({ lotId: '', fractions: '', price: '' })
  const [fillAmount, setFillAmount] = useState({})

  const loadOrders = async () => {
    if (!lotId) return
    setLoading(true)
    const o = await DCT.getFractionDEXOrders(parseInt(lotId)).catch(() => [])
    setOrders(o); setLoading(false)
  }

  const handleCreateSell = async () => {
    if (!sellForm.lotId || !sellForm.fractions || !sellForm.price) return
    setTxPending(true)
    const r = await safeCall(() => DCT.createFractionSellOrder(parseInt(sellForm.lotId), parseInt(sellForm.fractions), sellForm.price))
    setTxPending(false)
    if (r.ok) {
      addNotification('✅ Ордер на продажу фракций создан!')
      setSellForm({ lotId: '', fractions: '', price: '' })
      setShowCreate(false)
      if (lotId) loadOrders()
    } else addNotification(`❌ ${r.error}`)
  }

  const handleFill = async (orderId, fractions) => {
    const amount = fillAmount[orderId] || fractions
    setTxPending(true)
    const r = await safeCall(() => DCT.fillFractionSellOrder(orderId, parseInt(amount)))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Фракции куплены!'); loadOrders() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleCancelOrder = async (orderId) => {
    setTxPending(true)
    const r = await safeCall(() => DCT.cancelFractionSellOrder(orderId))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Ордер отменён'); loadOrders() }
    else addNotification(`❌ ${r.error}`)
  }

  return (
    <div className="px-3 mt-2 space-y-2">
      <div className="p-3 rounded-2xl glass">
        <SectionTitle icon="🔄" text="GemFraction DEX" color="text-purple-400" />
        <div className="text-[10px] text-slate-400 mb-2">Вторичный рынок фракций камней за DCT</div>

        {/* Поиск по лоту */}
        <div className="flex gap-2">
          <input type="number" value={lotId} onChange={e => setLotId(e.target.value)}
            placeholder="ID лота" className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          <button onClick={loadOrders} disabled={!lotId || loading}
            className="px-4 py-2 rounded-xl text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20">
            🔍 Ордера
          </button>
        </div>
      </div>

      {/* Кнопка создания */}
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(!showCreate)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${
            showCreate ? 'border-white/10 text-slate-400' : 'border-purple-500/20 text-purple-400 bg-purple-500/10'
          }`}>
          {showCreate ? '✕ Закрыть' : '+ Продать фракции'}
        </button>
      </div>

      {/* Форма создания */}
      {showCreate && (
        <div className="p-3 rounded-2xl glass space-y-2" style={{ border: '1px solid rgba(168,85,247,0.2)' }}>
          <input type="number" value={sellForm.lotId} onChange={e => setSellForm(f => ({ ...f, lotId: e.target.value }))}
            placeholder="ID лота" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          <input type="number" value={sellForm.fractions} onChange={e => setSellForm(f => ({ ...f, fractions: e.target.value }))}
            placeholder="Кол-во фракций" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          <input type="number" value={sellForm.price} onChange={e => setSellForm(f => ({ ...f, price: e.target.value }))}
            placeholder="Цена за фракцию (DCT)" className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          <button onClick={handleCreateSell} disabled={txPending || !sellForm.lotId || !sellForm.fractions || !sellForm.price}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20"
            style={{ opacity: txPending ? 0.5 : 1 }}>
            {txPending ? '⏳' : '📤 Выставить на продажу'}
          </button>
        </div>
      )}

      {/* Ордера */}
      {loading ? <Loading /> : orders.length > 0 && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[11px] font-bold text-purple-400 mb-2">📋 Ордера лота #{lotId} ({orders.length})</div>
          <div className="space-y-1.5">
            {orders.map(o => {
              const isMine = wallet && o.seller.toLowerCase() === wallet.toLowerCase()
              return (
                <div key={o.orderId} className="p-2 rounded-xl bg-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-white">{o.fractions} фр</span>
                      <span className="text-[9px] text-purple-400 ml-2">{o.pricePerFractionDCT} DCT/фр</span>
                      <span className="text-[8px] text-slate-500 ml-2">{shortAddress(o.seller)}</span>
                      {isMine && <span className="text-[8px] text-gold-400 ml-1">•вы</span>}
                    </div>
                    {isMine ? (
                      <button onClick={() => handleCancelOrder(o.orderId)} disabled={txPending}
                        className="px-2 py-1 rounded text-[8px] font-bold text-red-400 bg-red-500/10">✕</button>
                    ) : (
                      <button onClick={() => handleFill(o.orderId, o.fractions)} disabled={txPending}
                        className="px-2 py-1 rounded text-[8px] font-bold text-emerald-400 bg-emerald-500/10">
                        Купить
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// 7. HERITAGE — Наследование
// ═════════════════════════════════════════════════════════
function HeritageSection() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [heritageInfo, setHeritageInfo] = useState(null)
  const [heirs, setHeirs] = useState([])
  const [approvals, setApprovals] = useState({ dctApproved: false, fractionsApproved: false })
  const [constants, setConstants] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [configForm, setConfigForm] = useState({ heirs: [{ wallet: '', share: '', label: '' }], days: '365' })
  const [executeAddr, setExecuteAddr] = useState('')

  const reload = useCallback(async () => {
    if (!wallet) return
    setLoading(true)
    const [info, h, app, con] = await Promise.all([
      DCT.getHeritageInfo(wallet).catch(() => null),
      DCT.getHeirs(wallet).catch(() => []),
      DCT.checkHeritageApprovals(wallet).catch(() => ({ dctApproved: false, fractionsApproved: false })),
      DCT.getHeritageConstants().catch(() => null),
    ])
    setHeritageInfo(info); setHeirs(h); setApprovals(app); setConstants(con); setLoading(false)
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  const addHeir = () => {
    if (configForm.heirs.length >= (constants?.maxHeirs || 10)) return
    setConfigForm(f => ({ ...f, heirs: [...f.heirs, { wallet: '', share: '', label: '' }] }))
  }

  const removeHeir = (idx) => {
    setConfigForm(f => ({ ...f, heirs: f.heirs.filter((_, i) => i !== idx) }))
  }

  const updateHeir = (idx, field, value) => {
    setConfigForm(f => ({
      ...f,
      heirs: f.heirs.map((h, i) => i === idx ? { ...h, [field]: value } : h)
    }))
  }

  const handleConfigure = async () => {
    const wallets = configForm.heirs.map(h => h.wallet).filter(Boolean)
    const shares = configForm.heirs.map(h => parseInt(h.share) * 100) // % → BP
    const labels = configForm.heirs.map(h => h.label || '')
    const totalBP = shares.reduce((s, v) => s + v, 0)
    if (totalBP !== 10000) {
      addNotification('❌ Сумма долей должна быть 100%')
      return
    }
    setTxPending(true)
    const r = await safeCall(() => DCT.configureHeritage(wallets, shares, labels, parseInt(configForm.days)))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Наследование настроено!'); setShowConfig(false); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handlePing = async () => {
    setTxPending(true)
    const r = await safeCall(() => DCT.pingHeritage())
    setTxPending(false)
    if (r.ok) { addNotification('✅ Активность подтверждена!'); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleCancel = async () => {
    setTxPending(true)
    const r = await safeCall(() => DCT.cancelHeritage())
    setTxPending(false)
    if (r.ok) { addNotification('✅ Наследование отменено'); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  const handleExecute = async () => {
    if (!executeAddr) return
    setTxPending(true)
    const r = await safeCall(() => DCT.executeHeritage(executeAddr))
    setTxPending(false)
    if (r.ok) { addNotification('✅ Наследование выполнено!'); setExecuteAddr(''); reload() }
    else addNotification(`❌ ${r.error}`)
  }

  if (loading) return <Loading />

  return (
    <div className="px-3 mt-2 space-y-2">
      <div className="p-4 rounded-2xl glass text-center">
        <div className="text-3xl mb-2">🏛️</div>
        <div className="text-[14px] font-black text-white">DCT Heritage</div>
        <div className="text-[11px] text-slate-400">Наследование DCT токенов и фракций камней</div>
      </div>

      {/* Текущий статус */}
      {heritageInfo && heritageInfo.active ? (
        <div className="p-3 rounded-2xl glass">
          <SectionTitle icon="✅" text="Наследование активно" />
          <div className="grid grid-cols-3 gap-2 text-center mb-2">
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[12px] font-black text-purple-400">{heritageInfo.heirCount}</div>
              <div className="text-[8px] text-slate-500">Наследников</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[12px] font-black text-gold-400">{heritageInfo.inactivityDays} дн</div>
              <div className="text-[8px] text-slate-500">Период</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className={`text-[12px] font-black ${approvals.dctApproved && approvals.fractionsApproved ? 'text-emerald-400' : 'text-red-400'}`}>
                {approvals.dctApproved && approvals.fractionsApproved ? '✅' : '⚠️'}
              </div>
              <div className="text-[8px] text-slate-500">Approve</div>
            </div>
          </div>

          {/* Наследники */}
          {heirs.length > 0 && (
            <div className="space-y-1 mb-2">
              {heirs.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                  <div>
                    <span className="text-[10px] text-white font-mono">{shortAddress(h.wallet)}</span>
                    {h.label && <span className="text-[9px] text-slate-400 ml-2">{h.label}</span>}
                  </div>
                  <span className="text-[11px] font-bold text-gold-400">{h.sharePct}%</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handlePing} disabled={txPending}
              className="flex-1 py-2.5 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              {txPending ? '⏳' : '💚 Я активен'}
            </button>
            <button onClick={handleCancel} disabled={txPending}
              className="px-4 py-2.5 rounded-xl text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-2xl glass text-center">
          <div className="text-[12px] text-slate-400 mb-2">Наследование не настроено</div>
          <button onClick={() => setShowConfig(true)}
            className="px-4 py-2 rounded-xl text-[11px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20">
            ⚙️ Настроить
          </button>
        </div>
      )}

      {/* Форма настройки */}
      {showConfig && (
        <div className="p-3 rounded-2xl glass space-y-2" style={{ border: '1px solid rgba(168,85,247,0.2)' }}>
          <SectionTitle icon="⚙️" text="Настройка наследования" color="text-purple-400" />

          {configForm.heirs.map((h, i) => (
            <div key={i} className="p-2 rounded-xl bg-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Наследник {i + 1}</span>
                {configForm.heirs.length > 1 && (
                  <button onClick={() => removeHeir(i)} className="text-[9px] text-red-400">✕</button>
                )}
              </div>
              <input value={h.wallet} onChange={e => updateHeir(i, 'wallet', e.target.value)}
                placeholder="Адрес (0x...)" className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white outline-none font-mono" />
              <div className="flex gap-2">
                <input type="number" value={h.share} onChange={e => updateHeir(i, 'share', e.target.value)}
                  placeholder="Доля %" className="flex-1 p-2 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white outline-none text-center" />
                <input value={h.label} onChange={e => updateHeir(i, 'label', e.target.value)}
                  placeholder="Метка" className="flex-1 p-2 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white outline-none" />
              </div>
            </div>
          ))}

          <button onClick={addHeir}
            className="w-full py-2 rounded-xl text-[10px] font-bold text-slate-400 border border-white/8">
            + Добавить наследника
          </button>

          <input type="number" value={configForm.days} onChange={e => setConfigForm(f => ({ ...f, days: e.target.value }))}
            placeholder="Дней неактивности"
            className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          <div className="text-[9px] text-slate-500 text-center">
            Мин: {constants?.minInactivityDays || 30} дн • Макс наследников: {constants?.maxHeirs || 10}
          </div>

          <button onClick={handleConfigure} disabled={txPending}
            className="w-full py-3 rounded-xl text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20"
            style={{ opacity: txPending ? 0.5 : 1 }}>
            {txPending ? '⏳' : '🏛️ Настроить наследование'}
          </button>
        </div>
      )}

      {/* Исполнение наследования */}
      <div className="p-3 rounded-2xl glass">
        <SectionTitle icon="⚡" text="Исполнить наследование" color="text-gold-400" />
        <div className="text-[10px] text-slate-400 mb-2">Если владелец неактивен, наследники могут исполнить</div>
        <div className="flex gap-2">
          <input value={executeAddr} onChange={e => setExecuteAddr(e.target.value)}
            placeholder="Адрес владельца (0x...)"
            className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] text-white outline-none font-mono" />
          <button onClick={handleExecute} disabled={txPending || !executeAddr}
            className="px-4 py-2 rounded-xl text-[10px] font-bold bg-gold-400/15 text-gold-400 border border-gold-400/20"
            style={{ opacity: (!executeAddr || txPending) ? 0.5 : 1 }}>
            {txPending ? '⏳' : '⚡'}
          </button>
        </div>
      </div>
    </div>
  )
}
