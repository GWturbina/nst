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

export default function CabinetPage() {
  useBlockchainInit()
  const { activeTab, dayMode, level, showAutoRegister } = useGameStore()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1) Сохраняем ref из URL в localStorage (как было)
    const urlParams = new URLSearchParams(window.location.search)
    const refFromUrl = urlParams.get('ref')
    if (refFromUrl && /^\d+$/.test(refFromUrl)) {
      localStorage.setItem('dc_ref', refFromUrl)
    }

    // 2) Поддержка Telegram start_param (как было)
    const tg = window.Telegram?.WebApp
    if (tg) {
      const startParam = tg.initDataUnsafe?.start_param
      if (startParam && /^\d+$/.test(startParam)) {
        localStorage.setItem('dc_ref', startParam)
      }
    }

    // 3) ★ НОВОЕ: автооткрытие модала регистрации для новых пользователей
    // Если кошелёк ещё не подключён И юзер ещё не зарегистрирован — открываем модал
    // (он покажет шаг 'intro' с объяснением Web3 и развилкой "есть SafePal / нет SafePal")
    // Если кошелёк подключён, useBlockchain.js сам откроет модал с шагом 'register'
    setTimeout(() => {
      const store = useGameStore.getState()
      if (!store.wallet && !store.registered && !store.showAutoRegister) {
        const savedRef = localStorage.getItem('dc_ref')
        store.setAutoRegister(savedRef && /^\d+$/.test(savedRef) ? savedRef : null)
      }
    }, 500) // небольшая задержка чтобы useBlockchainInit успел проверить сохранённую сессию
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
