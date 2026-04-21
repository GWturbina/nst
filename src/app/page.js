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

// Проверяем, есть ли у пользователя сохранённый кошелёк в Zustand-store
// Ключ 'dc-storage-v3' = имя persist store (см. store.js внизу файла)
function hasStoredWallet() {
  try {
    const raw = localStorage.getItem('dc-storage-v3')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    // Zustand persist хранит структуру { state: {...}, version: N }
    return !!(parsed?.state?.wallet)
  } catch (e) {
    return false
  }
}

export default function MainPage() {
  useBlockchainInit()
  const { activeTab, dayMode, level, showAutoRegister } = useGameStore()
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
    const isTelegramWebApp = !!tg
    if (tg) {
      const startParam = tg.initDataUnsafe?.start_param
      if (startParam && /^\d+$/.test(startParam)) {
        localStorage.setItem('dc_ref', startParam)
      }
    }

    // 3. Проверяем: есть ли у юзера сохранённый кошелёк?
    const walletExists = hasStoredWallet()

    // 4. Параметр ?cabinet=1 — принудительно открыть кабинет (для отладки/партнёров)
    const forceCabinet = urlParams.get('cabinet') === '1'

    // 5. Решение:
    //    — Есть кошелёк → свой → кабинет
    //    — Telegram WebApp → всегда кабинет (внутри бота)
    //    — ?cabinet=1 → всегда кабинет (ручной override)
    //    — Иначе → гость → на лендинг (с ref если был)
    const shouldShowCabinet = walletExists || isTelegramWebApp || forceCabinet

    if (!shouldShowCabinet) {
      const refParam = refFromUrl ? `?ref=${refFromUrl}` : ''
      window.location.replace('/landing.html' + refParam)
      return
    }

    // Чистим ?ref= из URL (чтобы не светился в адресной строке)
    if (refFromUrl && window.history) {
      const cleanUrl = window.location.pathname + window.location.hash
      window.history.replaceState({}, '', cleanUrl)
    }

    setRedirecting(false)
  }, [])

  // Пока идёт проверка — пустой экран (чтобы не мигало содержимое кабинета перед редиректом)
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
