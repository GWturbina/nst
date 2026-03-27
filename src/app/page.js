'use client'
import { useEffect } from 'react'
import useGameStore from '@/lib/store'
import { useBlockchainInit } from '@/lib/useBlockchain'
import Header from '@/components/ui/Header'
import BottomNav from '@/components/ui/BottomNav'
import MineTab from '@/components/game/MineTab'
import LevelsTab from '@/components/game/LevelsTab'
import { StakingTab, HomeTab, ExchangeTab } from '@/components/pages/ContentPages'
import { LinksTab, VaultTab } from '@/components/pages/ExtraPages'
import TeamTab from '@/components/pages/TeamPage'
import LoanTab from '@/components/pages/LoanTab'
import CHTExchangeTab from '@/components/pages/CHTExchangeTab'
import AdminPanel from '@/components/admin/AdminPanel'
import AutoRegisterModal from '@/components/ui/AutoRegisterModal'
import ClubHousesTab from '@/components/pages/ClubHousesTab'

const TAB_COMPONENTS = {
  mine: MineTab,
  staking: StakingTab,
  exchange: ExchangeTab,
  home: HomeTab,
  loan: LoanTab,
  chtExchange: CHTExchangeTab,
  houses: ClubHousesTab,
  levels: LevelsTab,
  team: TeamTab,
  links: LinksTab,
  vault: VaultTab,
  admin: AdminPanel,
}

export default function MainPage() {
  useBlockchainInit()
  const { activeTab, dayMode, level, showAutoRegister } = useGameStore()

  // ═══════════════════════════════════════════════════
  // ЗАХВАТ РЕФЕРАЛЬНОЙ ССЫЛКИ
  // ?ref=12345 из URL  ИЛИ  start_param из Telegram
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1) Из URL: https://nss.globalway.app/?ref=12345
    const urlParams = new URLSearchParams(window.location.search)
    const refFromUrl = urlParams.get('ref')
    if (refFromUrl && /^\d+$/.test(refFromUrl)) {
      localStorage.setItem('nss_ref', String(parseInt(refFromUrl, 10)))
      const cleanUrl = window.location.pathname + window.location.hash
      window.history.replaceState({}, '', cleanUrl)
    }

    // 2) Из Telegram: bot?start=12345
    const tg = window.Telegram?.WebApp
    if (tg) {
      const startParam = tg.initDataUnsafe?.start_param
      if (startParam && /^\d+$/.test(startParam)) {
        localStorage.setItem('nss_ref', String(parseInt(startParam, 10)))
      }
    }
  }, [])

  const ActiveComponent = TAB_COMPONENTS[activeTab] || MineTab

  return (
    <div className="mx-auto w-full max-w-[430px] min-h-screen relative shadow-2xl shadow-black/50"
      style={{ contain: 'layout' }}>
      <div className={`min-h-screen flex flex-col theme-${level} ${dayMode ? 'bg-amber-50 text-stone-900' : 'bg-[#1a1a2e] text-white'}`}>
        <Header />
        <main className="flex-1 overflow-y-auto pb-20">
          <ActiveComponent />
        </main>
        <BottomNav />
      </div>

      {/* AutoRegister — показывается после подключения кошелька если не зарегистрирован */}
      {showAutoRegister && <AutoRegisterModal />}
    </div>
  )
}
