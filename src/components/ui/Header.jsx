'use client'
import { useState } from 'react'
import useGameStore from '@/lib/store'
import { useBlockchain } from '@/lib/useBlockchain'
import { shortAddress } from '@/lib/web3'
import { languages } from '@/locales'

export default function Header() {
  const {
    localDct, dct, dctFree, bnb, usdt,
    registered, wallet, isConnecting, txPending,
    dayMode, toggleDayMode, unreadCount, notifications, markAllRead,
    activeTab, setTab, dctPrice,
    lang, setLang, t,
  } = useGameStore()
  const { connect, disconnect } = useBlockchain()
  const [showNotif, setShowNotif] = useState(false)
  const [showWallet, setShowWallet] = useState(false)
  const [showLang, setShowLang] = useState(false)

  const totalDct = dct + localDct

  const TOP_TABS = [
    { id: 'mine', icon: '⛏', label: t('tabMine') },
    { id: 'diamond', icon: '♦️', label: t('tabDiamond') },
    { id: 'exchange', icon: '💱', label: t('tabExchange') },
    { id: 'vault', icon: '🔐', label: t('tabVault') },
  ]

  const handleWalletClick = async () => {
    if (wallet) {
      setShowWallet(!showWallet)
      setShowLang(false)
    } else {
      await connect()
    }
  }

  const handleLangClick = () => {
    setShowLang(!showLang)
    setShowWallet(false)
    setShowNotif(false)
  }

  const currentLang = languages.find(l => l.code === lang) || languages[1]

  return (
    <div className="sticky top-0 z-50 border-b" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg border-2"
          style={{ borderColor: 'rgba(255,215,0,0.35)', background: 'linear-gradient(135deg,#1a2744,#0d1520)' }}>
          <img src="/icons/logo.png" alt="" className="w-6 h-6"
            onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = '💎' }} />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-black leading-tight" style={{ color: 'var(--gold)' }}>Diamond Club</h1>
          <p className="text-[9px]" style={{ color: 'var(--muted)' }}>NSS • DCT Token</p>
        </div>

        {txPending && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-spin"
            style={{ border: '2px solid var(--gold)', borderTopColor: 'transparent' }} />
        )}

        <button onClick={handleLangClick}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-card-light)' }}>
          {currentLang.flag}
        </button>

        <button onClick={toggleDayMode}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-card-light)' }}>
          {dayMode ? '☀️' : '🌙'}
        </button>
        <button onClick={() => { setShowNotif(!showNotif); setShowWallet(false); setShowLang(false); if (!showNotif) markAllRead() }}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm relative"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-card-light)' }}>
          🔔{unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">{unreadCount}</span>}
        </button>

        <button onClick={handleWalletClick} disabled={isConnecting}
          className="px-2 py-1 rounded-2xl text-[9px] font-bold transition-all"
          style={{
            background: wallet ? 'rgba(16,185,129,0.12)' : isConnecting ? 'rgba(255,215,0,0.2)' : 'var(--gold-dim)',
            border: `1px solid ${wallet ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
            color: wallet ? '#10b981' : 'var(--gold)',
            opacity: isConnecting ? 0.6 : 1,
          }}>
          {isConnecting ? '⏳...' : wallet ? `● ${shortAddress(wallet)}` : `● ${t('connect')}`}
        </button>
      </div>

      {/* Language dropdown */}
      {showLang && (
        <div className="mx-3 mb-2 rounded-xl overflow-hidden" style={{ background: 'var(--bg-card-light)', border: '1px solid var(--border)' }}>
          <div className="p-2">
            {languages.map(l => (
              <button key={l.code} onClick={() => { setLang(l.code); setShowLang(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-bold transition-all ${lang === l.code ? 'bg-gold-400/15 text-gold-400' : 'text-slate-400 hover:bg-white/5'}`}>
                <span className="text-lg">{l.flag}</span>
                <span>{l.name}</span>
                {lang === l.code && <span className="ml-auto">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Wallet dropdown */}
      {showWallet && wallet && (
        <div className="mx-3 mb-2 rounded-xl overflow-hidden" style={{ background: 'var(--bg-card-light)', border: '1px solid var(--border)' }}>
          <div className="p-3">
            <div className="text-[11px] font-bold text-emerald-400 mb-2">💳 {t('wallet')}</div>
            <div className="text-[10px] text-slate-400 break-all mb-2">{wallet}</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-sm font-black text-gold-400">{bnb.toFixed(4)}</div>
                <div className="text-[9px] text-slate-500">BNB</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-sm font-black text-emerald-400">{parseFloat(usdt).toFixed(2)}</div>
                <div className="text-[9px] text-slate-500">USDT</div>
              </div>
            </div>
            <button onClick={() => { disconnect(); setShowWallet(false) }}
              className="w-full py-2 rounded-xl text-[11px] font-bold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
              ✕ {t('disconnect')}
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {showNotif && (
        <div className="mx-3 mb-2 rounded-xl overflow-hidden" style={{ background: 'var(--bg-card-light)', border: '1px solid var(--border)' }}>
          <div className="p-2 text-xs font-bold" style={{ color: 'var(--gold)', borderBottom: '1px solid var(--border)' }}>🔔 {t('notifications')}</div>
          {notifications.length === 0 && <div className="p-3 text-[11px]" style={{ color: 'var(--muted)' }}>{t('noNotifications')}</div>}
          {notifications.slice(0, 5).map(n => (
            <div key={n.id} className="px-3 py-2 text-[11px]" style={{ borderBottom: '1px solid var(--border-light)', opacity: n.read ? 0.5 : 1 }}>
              <div style={{ color: 'var(--text)' }}>{n.text}</div>
              <div className="text-[9px]" style={{ color: 'var(--muted)' }}>{n.time}</div>
            </div>
          ))}
        </div>
      )}

      {/* Token bar — DCT focused */}
      <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-hide">
        {[
          ['gold', 'DCT', totalDct.toFixed(2), '💎'],
          ['emerald', 'USDT', parseFloat(usdt).toFixed(0), '💵'],
          ['purple', 'BNB', bnb.toFixed(3), '🔶'],
        ].map(([c, l, v, i]) => {
          const s = {
            gold: { bg: 'rgba(255,215,0,0.12)', bc: 'rgba(255,215,0,0.25)', tc: '#ffd700' },
            emerald: { bg: 'rgba(16,185,129,0.12)', bc: 'rgba(16,185,129,0.25)', tc: '#10b981' },
            purple: { bg: 'rgba(168,85,247,0.12)', bc: 'rgba(168,85,247,0.25)', tc: '#a855f7' },
          }[c]
          return (
            <div key={l} className="flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-extrabold whitespace-nowrap"
              style={{ background: s.bg, border: `1px solid ${s.bc}`, color: s.tc }}>
              {i} {v} {l}
            </div>
          )
        })}
        {dctPrice > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-extrabold whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--muted)' }}>
            📊 1 DCT = ${parseFloat(dctPrice).toFixed(4)}
          </div>
        )}
      </div>

      {/* Top tabs */}
      <div className="flex border-t" style={{ borderColor: 'var(--border)' }}>
        {TOP_TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setTab(tab.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-all relative"
              style={{ color: isActive ? '#ffd700' : 'var(--muted)' }}>
              {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: '#ffd700' }} />}
              <span className="text-base" style={{ filter: isActive ? 'none' : 'grayscale(0.3) opacity(0.6)' }}>{tab.icon}</span>
              <span className="text-[9px] font-bold">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
