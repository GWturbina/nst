'use client'
import { useEffect, useState } from 'react'
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
  const { activeTab, dayMode, level, showAutoRegister, wallet } = useGameStore()
  const [redirecting, setRedirecting] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Захватываем ?ref=X из URL и сохраняем в localStorage
    const urlParams = new URLSearchParams(window.location.search)
    const refFromUrl = urlParams.get('ref')
    if (refFromUrl && /^\d+$/.test(refFromUrl)) {
      localStorage.setItem('dc_ref', refFromUrl)
    }

    // 2. Захватываем start_param из Telegram WebApp (если открыт из бота)
    const tg = window.Telegram?.WebApp
    if (tg) {
      const startParam = tg.initDataUnsafe?.start_param
      if (startParam && /^\d+$/.test(startParam)) {
        localStorage.setItem('dc_ref', startParam)
      }
    }

    // 3. Смотрим: был ли юзер уже в кабинете? (флаг ставится после входа)
    const hasVisitedCabinet = localStorage.getItem('dc_visited_cabinet') === '1'

    // 4. Решаем куда пускать:
    //    — Если есть кошелёк → он свой, пускаем в кабинет
    //    — Если нет кошелька, но был раньше → тоже пускаем (возвращающийся)
    //    — Если нет кошелька и никогда не был → отправляем на лендинг
    //    — Исключение: Telegram WebApp (внутри бота) всегда показывает кабинет
    const isTelegramWebApp = !!tg
    const shouldShowCabinet = wallet || hasVisitedCabinet || isTelegramWebApp

    if (!shouldShowCabinet) {
      // Гость без кошелька — на лендинг (с сохранением ref если был)
      const refParam = refFromUrl ? `?ref=${refFromUrl}` : ''
      window.location.replace('/landing.html' + refParam)
      return
    }

    // Помечаем что юзер в кабинете — чтобы в следующий раз сразу пускало
    localStorage.setItem('dc_visited_cabinet', '1')

    // Чистим ?ref= из URL (чтобы не мешал)
    if (refFromUrl && window.history) {
      const cleanUrl = window.location.pathname + window.location.hash
      window.history.replaceState({}, '', cleanUrl)
    }

    setRedirecting(false)
  }, [wallet])

  // Пока идёт проверка — показываем пустой экран (чтобы не мигало)
  if (redirecting) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#666', fontSize: 14 }}>Загрузка...</div>
      </div>
    )
  }

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
