'use client'
/**
 * Diamond Club v2.3 — главная страница
 * 
 * Изменения от v10.2:
 * - Убраны секции: Boost (UserBoost), Insurance (InsuranceFund), Old Gems (GemVaultV2)
 * - P2P переделан: теперь работает через ClubPools (продажа долей пулов между партнёрами)
 * - Dashboard упрощён: показывает балансы DCT, holdings по пулам, маркетинг-баланс
 * - "Лоты" заменены на "Пулы" (но компонент ClubLotsSection всё ещё назван так — переименуем позже)
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import * as Club from '@/lib/clubV23'
import { safeCall } from '@/lib/contracts'
import { shortAddress } from '@/lib/web3'
import ADDRESSES from '@/contracts/addresses'
import GemConfigurator from '@/components/pages/GemConfigurator'
import DeliverySection from '@/components/pages/DeliverySection'
import ShowcaseNew from '@/components/pages/ShowcaseNew'
import GemGallery from '@/components/pages/GemGallery'
import ClubLotsSection from '@/components/pages/ClubLotsSection'
import MyPurchasesSection from '@/components/pages/MyPurchasesSection'
import HelpButton from '@/components/ui/HelpButton'

// ═════════════════════════════════════════════════════════
// MAIN: DiamondClubTab
// ═════════════════════════════════════════════════════════
export default function DiamondClubTab() {
  const { wallet, t, setTab } = useGameStore()
  const [section, setSection] = useState('dashboard')

  const sections = [
    { id: 'dashboard', icon: '📊', label: 'Обзор' },
    { id: 'lots',      icon: '🎟', label: 'Пулы' },
    { id: 'purchases', icon: '📋', label: 'Мои' },
    { id: 'gems',      icon: '💎', label: 'Камни' },
    { id: 'gallery',   icon: '🧩', label: 'Галерея' },
    { id: 'showcase',  icon: '🏪', label: 'Магазин' },
    { id: 'p2p',       icon: '🤝', label: 'P2P' },
    { id: 'tournaments', icon: '🏆', label: 'Турниры' },
    { id: 'delivery',  icon: '📦', label: 'Доставка' },
  ]

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      {/* Заголовок + кнопка помощи */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gold-400">♦️ Diamond Club</h2>
          <p className="text-[11px] text-slate-500">Инвестиционный клуб</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section={section} />
        </div>
      </div>

      {/* Sub-навигация */}
      <div className="grid grid-cols-5 gap-1 px-3 mt-1">
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${
              section === s.id
                ? 'bg-gold-400/15 border-gold-400/30 text-gold-400'
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
          <div className="text-[11px] text-slate-500 mt-1">SafePal для доступа к Diamond Club</div>
        </div>
      ) : (
        <>
          {section === 'dashboard' && <DashboardSection />}
          {section === 'lots' && <ClubLotsSection />}
          {section === 'purchases' && <MyPurchasesSection />}
          {section === 'gems' && <GemsSection onGoToDCT={() => setTab('exchange')} />}
          {section === 'gallery' && <GemGallery />}
          {section === 'showcase' && <ShowcaseNew />}
          {section === 'p2p' && <P2PSection />}
          {section === 'tournaments' && <TournamentsSection />}
          {section === 'delivery' && <DeliverySection />}
        </>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// DASHBOARD — обзор балансов и статистики
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
  if (!data) return <ErrorCard text="Ошибка загрузки данных" />

  const dctTotal = parseFloat(data.dctInfo?.total || 0)
  const dctFrozen = parseFloat(data.dctInfo?.frozen || 0)
  const dctUnlocked = parseFloat(data.dctInfo?.unlocked || 0)
  const marketingBalance = parseFloat(data.marketingBalance || 0)

  return (
    <div className="px-3 mt-2 space-y-2">
      {/* Балансы DCT */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] text-slate-500">DCT всего</div>
          <div className="text-xl font-black text-gold-400">{dctTotal.toFixed(2)}</div>
          <div className="text-[9px] text-slate-500">токенов</div>
        </div>
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] text-slate-500">Свободно DCT</div>
          <div className="text-xl font-black text-emerald-400">{dctUnlocked.toFixed(2)}</div>
          <div className="text-[9px] text-slate-500">можно потратить</div>
        </div>
      </div>

      {/* Заморожено + резерв */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] text-slate-500">DCT заморожено</div>
          <div className="text-xl font-black text-blue-400">{dctFrozen.toFixed(2)}</div>
          <div className="text-[9px] text-slate-500">разморозка по графику</div>
        </div>
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] text-slate-500">Резерв клуба</div>
          <div className="text-xl font-black text-purple-400">${parseFloat(data.reserveBalance || 0).toFixed(0)}</div>
          <div className="text-[9px] text-slate-500">защитный фонд</div>
        </div>
      </div>

      {/* Holdings по пулам */}
      {data.holdings && data.holdings.length > 0 && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[12px] font-bold text-gold-400 mb-2">💎 Мои доли в пулах ({data.holdings.length})</div>
          <div className="space-y-1.5">
            {data.holdings.slice(0, 5).map((h, i) => <HoldingRow key={i} holding={h} />)}
            {data.holdings.length > 5 && (
              <div className="text-[9px] text-slate-500 text-center">+{data.holdings.length - 5} ещё</div>
            )}
          </div>
        </div>
      )}

      {/* Маркетинг-баланс */}
      {marketingBalance > 0 && (
        <div className="p-3 rounded-2xl glass border border-emerald-500/15">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-bold text-emerald-400">🎁 Партнёрские комиссии</div>
              <div className="text-lg font-black text-emerald-400">${marketingBalance.toFixed(2)}</div>
            </div>
            <ClaimMarketingButton />
          </div>
        </div>
      )}

      {/* Статистика */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-blue-400 mb-2">📈 Статистика клуба</div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 rounded-lg bg-white/5">
            <div className="text-[11px] font-black text-gold-400">{data.poolsCount}</div>
            <div className="text-[9px] text-slate-500">Пулов</div>
          </div>
          <div className="p-2 rounded-lg bg-white/5">
            <div className="text-[11px] font-black text-emerald-400">{data.activeItemCount}</div>
            <div className="text-[9px] text-slate-500">Камней в продаже</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// GEMS — упрощённая секция, перенаправляет в Галерею/Магазин
// ═════════════════════════════════════════════════════════
function GemsSection({ onGoToDCT }) {
  return (
    <div className="px-3 mt-2 space-y-2">
      <div className="p-4 rounded-2xl glass text-center">
        <div className="text-3xl mb-2">💎</div>
        <div className="text-sm font-bold text-gold-400 mb-1">Камни клуба</div>
        <div className="text-[11px] text-slate-400 mb-3">
          В новой системе камни — это активы пулов. Ты получаешь долю в пуле, который покупает камень.
          Когда камень продаётся — прибыль делится между всеми участниками пула.
        </div>
        <div className="flex flex-col gap-2 mt-3">
          <button onClick={onGoToDCT}
            className="px-4 py-2 rounded-xl text-[11px] font-bold bg-gold-400/15 text-gold-400 border border-gold-400/30">
            ♦️ Перейти к DCT и Пулам
          </button>
        </div>
      </div>

      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-blue-400 mb-2">📚 Как это работает</div>
        <div className="text-[10px] text-slate-400 space-y-2">
          <div>1. Партнёры собираются в пул и складывают USDT.</div>
          <div>2. Когда сумма набрана — клуб покупает камень у завода.</div>
          <div>3. Камень выставляется на продажу в Магазине.</div>
          <div>4. После продажи — прибыль делится между участниками пула.</div>
          <div>5. Можно выкупить долю DCT за USDT (redeem) в любой момент.</div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// P2P — продажа долей пулов между партнёрами
// ═════════════════════════════════════════════════════════
function P2PSection() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [pools, setPools] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const allPools = await Club.getAllPools()
      // Показываем только активные пулы (status 0,1,2)
      setPools(allPools.filter(p => p.status <= 2))
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  if (loading) return <Loading />

  return (
    <div className="px-3 mt-2 space-y-2">
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-blue-400 mb-1">💡 Как работает P2P</div>
        <div className="text-[10px] text-slate-400">
          Если у тебя есть доля в пуле и ты не хочешь ждать продажи камня — можешь выставить её на P2P.
          Другой партнёр купит её сразу за USDT, твой DCT перейдёт ему.
          Зайди в «Пулы» → выбери свой пул → кнопка «Продать долю».
        </div>
      </div>

      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-gold-400 mb-2">🤝 Активные пулы для P2P ({pools.length})</div>
        {pools.length === 0 ? (
          <div className="text-[11px] text-slate-500 text-center py-4">Нет активных пулов</div>
        ) : (
          <div className="space-y-1.5">
            {pools.map(p => (
              <div key={p.poolId} className="p-2.5 rounded-xl bg-white/5">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-[11px] font-bold text-white">{p.name}</span>
                    <span className="text-[9px] text-slate-500 ml-2">#{p.poolId}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400">${parseFloat(p.collectedUSDT).toFixed(0)} / ${parseFloat(p.targetUSDT).toFixed(0)}</span>
                </div>
                <div className="text-[9px] text-slate-500">
                  Долей продано: {p.sharesSold} / {p.totalShares} • DCT цена: ${parseFloat(p.sharePrice).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// TOURNAMENTS — без изменений, через API
// ═════════════════════════════════════════════════════════
function TournamentsSection() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tournaments')
      .then(r => r.json())
      .then(data => setTournaments(data.tournaments || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  return (
    <div className="px-3 mt-2 space-y-2">
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-gold-400 mb-2">🏆 Турниры клуба ({tournaments.length})</div>
        {tournaments.length === 0 ? (
          <div className="text-[11px] text-slate-500 text-center py-4">Турниров пока нет</div>
        ) : (
          <div className="space-y-2">
            {tournaments.map(t => (
              <div key={t.id} className="p-2.5 rounded-xl bg-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-bold text-white">{t.name}</div>
                    <div className="text-[10px] text-slate-500">{t.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-black text-gold-400">${t.prize}</div>
                    <div className="text-[9px] text-slate-500">приз</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═════════════════════════════════════════════════════════
function Loading() {
  return <div className="flex items-center justify-center py-12"><div className="text-2xl animate-spin">💎</div></div>
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

function ClaimMarketingButton() {
  const { setTxPending, txPending, addNotification } = useGameStore()
  const handleClaim = async () => {
    setTxPending(true)
    const result = await safeCall(() => Club.claimMarketing())
    setTxPending(false)
    if (result.ok) addNotification('✅ Комиссии получены!')
    else addNotification(`❌ ${result.error}`)
  }
  return (
    <button onClick={handleClaim} disabled={txPending}
      className="px-3 py-2 rounded-xl text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
      {txPending ? '⏳' : '🎁 Забрать'}
    </button>
  )
}
