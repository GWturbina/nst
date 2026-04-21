'use client'
import { useEffect } from 'react'
import useGameStore from '@/lib/store'
import { useBlockchainInit } from '@/lib/useBlockchain'
import Header from '@/components/ui/Header'
import BottomNav from '@/components/ui/BottomNav'
import MineTab from '@/components/game/MineTab'
import LevelsTab from '@/components/game/LevelsTab'
import TeamTab from '@/components/pages/TeamPage'
import DiamondClubTab from '@/components/pages/DiamondClubPage'
import DCTPage from '@/components/pages/DCTPage'
import LinksTab from '@/components/pages/LinksTab'
import VaultTab from '@/components/pages/VaultTab'
import AdminPanel from '@/components/admin/AdminPanel'
import AutoRegisterModal from '@/components/ui/AutoRegisterModal'

const TAB_COMPONENTS = {
  mine: MineTab,
  diamond: DiamondClubTab,
  exchange: DCTPage,
  vault: VaultTab,
  levels: LevelsTab,
  team: TeamTab,
  links: LinksTab,
  admin: AdminPanel,
}

export default function MainPage() {
  useBlockchainInit()
  const { activeTab, dayMode, level, showAutoRegister } = useGameStore()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Захватываем ?ref=X из URL
    const urlParams = new URLSearchParams(window.location.search)
    const refFromUrl = urlParams.get('ref')
    if (refFromUrl && /^\d+$/.test(refFromUrl)) {
      localStorage.setItem('dc_ref', refFromUrl)
    }

    // 2. Telegram WebApp start_param
    const tg = window.Telegram?.WebApp
    if (tg) {
      const startParam = tg.initDataUnsafe?.start_param
      if (startParam && /^\d+$/.test(startParam)) {
        localStorage.setItem('dc_ref', startParam)
      }
    }

    // 3. Ставим cookie dc_session=1 — чтобы middleware знал что юзер уже "свой"
    //    и в следующий раз не редиректил на лендинг
    //    Cookie живёт 30 дней
    document.cookie = 'dc_session=1; path=/; max-age=2592000; SameSite=Lax'

    // 4. Чистим ?ref= из URL
    if (refFromUrl && window.history) {
      const cleanUrl = window.location.pathname + window.location.hash
      window.history.replaceState({}, '', cleanUrl)
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
      {showAutoRegister && <AutoRegisterModal />}
    </div>
  )
}
