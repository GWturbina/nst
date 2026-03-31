'use client'
import { useState, useEffect } from 'react'
import useGameStore from '@/lib/store'
import { LEVELS } from '@/lib/gameData'
import * as C from '@/lib/contracts'
import HelpButton from '@/components/ui/HelpButton'

export default function LevelsTab() {
  const { level, wallet, registered, setTab, addNotification, setTxPending, txPending, setLevel, t } = useGameStore()
  const bnbPrice = useGameStore(s => s.bnbPrice)
  const [buying, setBuying] = useState(false)
  const [expandedLv, setExpandedLv] = useState(null)

  // ═══ Модал регистрации (спонсор) ═══
  const [showRegModal, setShowRegModal] = useState(false)
  const [sponsorInput, setSponsorInput] = useState('')
  const [registering, setRegistering] = useState(false)
  const [refFromLink, setRefFromLink] = useState(false)
  const [pendingLevelBuy, setPendingLevelBuy] = useState(null)

  // Автозаполнение спонсора из реферальной ссылки
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedRef = localStorage.getItem('dc_ref')
    if (savedRef && /^\d+$/.test(savedRef)) {
      setSponsorInput(savedRef)
      setRefFromLink(true)
    }
  }, [])

  // Живой курс: BNB → $
  const fmtUsd = (bnb) => {
    if (!bnb || !bnbPrice) return ''
    const usd = bnb * bnbPrice
    return usd >= 1 ? `~$${Math.round(usd)}` : `~$${usd.toFixed(2)}`
  }

  // Динамический расчёт потенциального дохода с уровня
  const calcEarnUsd = (lv) => {
    if (!lv.team || !lv.bnb || !bnbPrice) return null
    // Комиссия: 60% для уровней 0-1, 50% для 2+
    const pct = lv.id <= 1 ? 0.60 : 0.50
    const earnBnb = lv.team * pct * lv.bnb
    const earnUsd = earnBnb * bnbPrice
    if (earnUsd < 1) return `${earnBnb.toFixed(4)} BNB (~$${earnUsd.toFixed(2)})`
    return `${earnBnb.toFixed(3)} BNB (~$${Math.round(earnUsd)})`
  }

  const handleBuy = async (lv) => {
    if (!wallet) { addNotification(`❌ ${t('connectWalletFirst')}`); return }

    // Если не зарегистрирован — сначала показываем модал спонсора
    if (!registered) {
      setPendingLevelBuy(lv)
      const savedRef = typeof window !== 'undefined' ? localStorage.getItem('dc_ref') || '' : ''
      if (savedRef && /^\d+$/.test(savedRef)) {
        setSponsorInput(savedRef)
        setRefFromLink(true)
      }
      setShowRegModal(true)
      return
    }

    // Зарегистрирован — покупаем уровень
    await doBuyLevel(lv)
  }

  // Регистрация + покупка уровня
  const handleRegisterAndBuy = async () => {
    const sid = parseInt(sponsorInput)
    if (!sid || sid <= 0) {
      addNotification('❌ ' + t('enterValidSponsorId'))
      return
    }
    setRegistering(true)
    setTxPending(true)
    try {
      addNotification(`⏳ ${t('registering')} #${sid}...`)
      await C.register(sid)
      addNotification('✅ ' + t('registrationSuccess'))
      setShowRegModal(false)

      // Ждём подтверждения регистрации в блокчейне
      addNotification(`⏳ ${t('waitingConfirmation')}...`)
      const confirmed = await C.waitForRegistration(wallet)
      const gwStatus = await C.getGWUserStatus(wallet).catch(() => null)
      if (gwStatus) {
        useGameStore.getState().updateRegistration(gwStatus.isRegistered, gwStatus.odixId || sid)
        if (gwStatus.maxPackage > 0) useGameStore.getState().setLevel(gwStatus.maxPackage)
      } else {
        useGameStore.getState().updateRegistration(true, sid)
      }

      // Покупаем уровень если был запланирован
      if (pendingLevelBuy) {
        await doBuyLevel(pendingLevelBuy)
        setPendingLevelBuy(null)
      }
    } catch (err) {
      const msg = err?.reason || err?.shortMessage || err?.message || 'Ошибка'
      if (msg.includes('Already registered')) {
        addNotification('ℹ️ ' + t('alreadyRegistered'))
        useGameStore.getState().updateRegistration(true, sid)
        setShowRegModal(false)
        if (pendingLevelBuy) {
          await doBuyLevel(pendingLevelBuy)
          setPendingLevelBuy(null)
        }
      } else if (msg.includes('Sponsor not found') || msg.includes('Invalid sponsor')) {
        addNotification(`❌ ${t('sponsorNotFound')} #${sid}`)
      } else {
        addNotification(`❌ ${msg.slice(0, 100)}`)
      }
    }
    setTxPending(false)
    setRegistering(false)
  }

  const doBuyLevel = async (lv) => {
    if (!lv) return
    setBuying(true)
    setTxPending(true)
    try {
      addNotification(`⏳ ${t('buyingLevel')} ${lv.name}...`)
      await C.buyLevel(lv.id)
      setLevel(lv.id)
      addNotification(`✅ ${lv.name} ${t('levelActivated')}`)
      setTimeout(async () => {
        const gwStatus = await C.getGWUserStatus(wallet).catch(() => null)
        if (gwStatus && gwStatus.maxPackage > 0) {
          useGameStore.getState().setLevel(gwStatus.maxPackage)
        }
      }, 3000)
    } catch (err) {
      const msg = err?.reason || err?.shortMessage || err?.message || t('error')
      if (msg.includes('Not registered')) {
        addNotification('❌ ' + t('registrationRequired'))
        setPendingLevelBuy(lv)
        setShowRegModal(true)
      } else if (msg.includes('insufficient funds') || msg.includes('INSUFFICIENT')) {
        addNotification('❌ ' + t('insufficientBNB'))
      } else {
        addNotification(`❌ ${msg.slice(0, 80)}`)
      }
    }
    setTxPending(false)
    setBuying(false)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gold-400">🗺 {t('levelMap')}</h2>
          <p className="text-[11px] text-slate-500">{t('levelMapDesc')}</p>
        </div>
        <HelpButton section="levels" />
      </div>

      <div className="px-3 mt-1 space-y-2">
        {LEVELS.map((lv, i) => {
          const isActive = level === i
          const isLocked = i > level + 1
          const isNext = i === level + 1
          const isOwned = i <= level
          const isExpanded = expandedLv === i

          return (
            <div key={i} onClick={() => !isLocked && setExpandedLv(isExpanded ? null : i)}
              className={`rounded-2xl border transition-all overflow-hidden ${isLocked ? 'opacity-40' : 'cursor-pointer'}`}
              style={{
                background: isActive ? `${lv.color}15` : 'var(--bg-card)',
                borderColor: isActive ? `${lv.color}40` : isNext ? `${lv.color}25` : 'var(--border)',
              }}>
              <div className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border flex-shrink-0"
                  style={{ borderColor: `${lv.color}40`, background: `${lv.color}15` }}>
                  {lv.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black" style={{ color: isOwned ? lv.color : 'var(--text)' }}>{lv.name}</span>
                    {isOwned && <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 rounded-full font-bold">✓</span>}
                    {isActive && <span className="text-[9px] bg-gold-400/15 text-gold-400 px-1.5 rounded-full font-bold">⛏</span>}
                  </div>
                  <div className="text-[10px] text-slate-500">{lv.sub} • +{lv.nssPerTap} {t('nssPerTap')}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  {i === 0 ? (
                    <div className="text-[11px] font-bold text-slate-500">{t('free')}</div>
                  ) : (
                    <div>
                      <div className="text-[11px] font-bold" style={{ color: lv.color }}>{lv.price}</div>
                      {bnbPrice > 0 && <div className="text-[9px] text-slate-500">{fmtUsd(lv.bnb)}</div>}
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 border-t" style={{ borderColor: `${lv.color}15` }}>
                  <div className="pt-2 text-[11px] text-slate-300 leading-relaxed">{lv.desc}</div>
                  <div className="mt-2 flex gap-2 text-[10px]">
                    <div className="flex-1 p-2 rounded-lg bg-white/5 text-center">
                      <div className="font-bold text-gold-400">{lv.team}</div>
                      <div className="text-slate-500">{t('partners')}</div>
                    </div>
                    <div className="flex-1 p-2 rounded-lg bg-white/5 text-center">
                      <div className="font-bold text-emerald-400">+{lv.nssBonus}</div>
                      <div className="text-slate-500">GST {t('nssBonus')}</div>
                    </div>
                    {bnbPrice > 0 && lv.bnb > 0 && (
                      <div className="flex-1 p-2 rounded-lg bg-white/5 text-center">
                        <div className="font-bold text-purple-400">{fmtUsd(lv.bnb)}</div>
                        <div className="text-slate-500">{t('levelPrice') || 'Цена'}</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    💰 {t('income')}: {lv.team > 0 && bnbPrice > 0 ? calcEarnUsd(lv) : lv.earn}
                  </div>

                  {isNext && (
                    <button onClick={(e) => { e.stopPropagation(); handleBuy(lv) }}
                      disabled={buying || isLocked || txPending}
                      className="mt-2 w-full py-2.5 rounded-xl text-xs font-bold transition-all gold-btn"
                      style={{ opacity: (buying || txPending) ? 0.6 : 1 }}>
                      {buying ? `⏳ ${t('buying')}` : `🛒 ${t('buy')} ${lv.name} — ${lv.price}${bnbPrice > 0 ? ` (${fmtUsd(lv.bnb)})` : ''}`}
                    </button>
                  )}
                  {isOwned && !isActive && (
                    <div className="mt-2 text-center text-[10px] text-emerald-400 font-bold">✅ {t('passed')}</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ═══ МОДАЛ РЕГИСТРАЦИИ ═══ */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-3" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => { setShowRegModal(false); setPendingLevelBuy(null) }}>
          <div className="w-full max-w-[400px] rounded-3xl p-5 space-y-4"
            style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,215,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-2xl mb-1">🆔</div>
              <div className="text-sm font-black text-white">{t('regModalTitle')}</div>
              <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                {t('regModalDesc')}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">{t('sponsorIdLabel')}:</label>
              {refFromLink && sponsorInput ? (
                <div>
                  <div className="w-full p-3 rounded-xl text-sm text-white flex items-center justify-between"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <span>✅ #{sponsorInput}</span>
                    <span className="text-[9px] text-emerald-400">{t('fromReferralLink')}</span>
                  </div>
                  <button onClick={() => setRefFromLink(false)}
                    className="text-[9px] text-slate-500 mt-1 underline">
                    {t('changeSponsor')}
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="number"
                    value={sponsorInput}
                    onChange={e => setSponsorInput(e.target.value)}
                    placeholder={t('sponsorIdPlaceholder')}
                    className="w-full p-3 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,215,0,0.2)' }}
                    autoFocus
                  />
                  {sponsorInput && parseInt(sponsorInput) <= 0 && (
                    <div className="text-[10px] text-red-400 mt-1">❌ {t('invalidSponsorId')}</div>
                  )}
                  {!sponsorInput && (
                    <div className="text-[9px] text-slate-500 mt-1">
                      💡 {t('sponsorIdHint')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {pendingLevelBuy && (
              <div className="p-2.5 rounded-xl text-[10px] text-slate-400 leading-relaxed"
                style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.1)' }}>
                ✨ {t('afterRegBuyLevel')}: <b className="text-white">{pendingLevelBuy.name}</b> ({pendingLevelBuy.price})
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setShowRegModal(false); setPendingLevelBuy(null) }}
                className="flex-1 py-3 rounded-2xl text-[11px] font-bold text-slate-400 border border-white/10">
                {t('cancel')}
              </button>
              <button onClick={handleRegisterAndBuy}
                disabled={registering || !sponsorInput || parseInt(sponsorInput) <= 0}
                className="flex-1 py-3 rounded-2xl text-[11px] font-black gold-btn"
                style={{ opacity: (!sponsorInput || parseInt(sponsorInput) <= 0 || registering) ? 0.5 : 1 }}>
                {registering ? '⏳ ...' : pendingLevelBuy ? `✅ ${t('registerAndBuy')}` : `✅ ${t('register')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
