'use client'
import useGameStore from '@/lib/store'

export default function BottomNav() {
  const { activeTab, setTab, isAdmin, wallet, ownerWallet, t } = useGameStore()

  const showAdmin = isAdmin || (wallet && ownerWallet && wallet.toLowerCase() === ownerWallet.toLowerCase())

  const BOTTOM_TABS = [
    { id: 'levels', icon: '🗺', label: t('tabLevels') },
    { id: 'team', icon: '👥', label: t('tabTeam') },
    { id: 'links', icon: '✂️', label: t('tabLinks') },
  ]

  const tabs = showAdmin
    ? [...BOTTOM_TABS, { id: 'admin', icon: '⚙️', label: t('tabAdmin') }]
    : BOTTOM_TABS

  return (
    <div className="sticky bottom-0 z-50 flex border-t"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button key={tab.id} onClick={() => setTab(tab.id)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-all relative"
            style={{ color: isActive ? '#ffd700' : 'var(--muted)' }}>
            <span className="text-base" style={{ filter: isActive ? 'none' : 'grayscale(0.3) opacity(0.6)' }}>{tab.icon}</span>
            <span className="text-[9px] font-bold">{tab.label}</span>
            {isActive && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: '#ffd700' }} />}
          </button>
        )
      })}
    </div>
  )
}
