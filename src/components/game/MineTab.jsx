'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { LEVELS, LEVEL_BACKGROUNDS } from '@/lib/gameData'
import { useBlockchain } from '@/lib/useBlockchain'
import { useTelegram } from '@/lib/useTelegram'
import * as C from '@/lib/contracts'

export default function MineTab() {
  const bnbPrice = useGameStore(s => s.bnbPrice)
  const { level, localNst, nst, energy, maxEnergy, taps, registered, wallet,
    evapActive, evapSeconds, doTap, tickEvap, news, setTab, addNotification,
    setTxPending, txPending, setLevel, t } = useGameStore()
  const { connect } = useBlockchain()
  const { haptic, isInTelegram } = useTelegram()
  const lv = LEVELS[level]
  const nextLv = LEVELS[level + 1] || null

  // Живой курс: BNB → $
  const fmtUsd = (bnb) => {
    if (!bnb || !bnbPrice) return ''
    const usd = bnb * bnbPrice
    return usd >= 1 ? `~$${Math.round(usd)}` : `~$${usd.toFixed(2)}`
  }
  const tapAreaRef = useRef(null)
  const [effects, setEffects] = useState([])
  const [thoughts, setThoughts] = useState([])
  const tapCountRef = useRef(0)
  const [buyingLevel, setBuyingLevel] = useState(false)
  const [showRegModal, setShowRegModal] = useState(false)
  const [sponsorInput, setSponsorInput] = useState('')
  const [registering, setRegistering] = useState(false)
  const [refFromLink, setRefFromLink] = useState(false) // реф пришёл из ссылки?

  const totalNst = nst + localNst

  // ═══════════════════════════════════════════════════
  // АВТОЗАПОЛНЕНИЕ СПОНСОРА из реферальной ссылки
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedRef = localStorage.getItem('nss_ref')
    if (savedRef && /^\d+$/.test(savedRef)) {
      setSponsorInput(savedRef)
      setRefFromLink(true)
    }
  }, [])

  useEffect(() => {
    if (!evapActive || registered) return
    const interval = setInterval(() => {
      const result = tickEvap()
      if (result === 'expired') {
        showThought(t('stonesEvaporated'), 'ruby', '😱')
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [evapActive, registered, tickEvap, t])

  useEffect(() => {
    const interval = setInterval(() => useGameStore.getState().regenEnergy(), 10000)
    return () => clearInterval(interval)
  }, [])

  const showThought = useCallback((text, color, icon, shape = 'thought-pill') => {
    const id = Date.now() + Math.random()
    setThoughts(prev => [...prev, { id, text, color, icon, shape }])
    setTimeout(() => setThoughts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  const handleTap = useCallback((e) => {
    e.preventDefault()
    const earned = doTap()
    if (!earned) return

    if (isInTelegram) haptic('light')

    tapCountRef.current++
    const rect = tapAreaRef.current?.getBoundingClientRect()
    if (!rect) return
    const touch = e.touches?.[0] || e
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top

    setEffects(prev => [...prev,
      { id: Date.now() + Math.random(), x: `${x}px`, y: `${y - 10}px`, text: `+${earned}`, type: 'number' },
    ])
    setTimeout(() => setEffects(prev => prev.slice(1)), 800)

    if (tapCountRef.current % 25 === 0 && lv.thought) {
      const shapes = ['thought-pill', 'thought-cloud', 'thought-crystal', 'thought-bubble']
      const shape = shapes[Math.floor(Math.random() * shapes.length)]
      showThought(lv.thought, lv.thoughtColor, lv.thoughtIcon, shape)
    }
  }, [doTap, lv, showThought, isInTelegram, haptic])

  // ═══════════════════════════════════════════════════
  // РЕГИСТРАЦИЯ — открытие модала
  // ═══════════════════════════════════════════════════
  const openRegModal = () => {
    if (!wallet) return
    // Подгружаем реф из localStorage (мог появиться после первого рендера)
    const savedRef = typeof window !== 'undefined' ? localStorage.getItem('nss_ref') || '' : ''
    if (savedRef && /^\d+$/.test(savedRef)) {
      setSponsorInput(savedRef)
      setRefFromLink(true)
    }
    setShowRegModal(true)
  }

  // Открыть модал регистрации если НЕ зарегистрирован в GlobalWay, иначе купить уровень
  const handleBuyNextLevel = () => {
    if (!wallet || !nextLv) return
    if (!registered) {
      openRegModal()
      return
    }
    // Уже зарегистрирован в GlobalWay — просто покупаем уровень
    doBuyLevel()
  }

  // ═══════════════════════════════════════════════════
  // РЕГИСТРАЦИЯ — отправка транзакции
  // Идёт сразу через мост в GlobalWay — это правильно и быстро
  // ═══════════════════════════════════════════════════
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
      // register() → NSSPlatform → bridge.registerUser → MatrixRegistry → GlobalWay
      await C.register(sid)
      addNotification('✅ ' + t('registrationSuccess'))
      setShowRegModal(false)

      // Ждём подтверждения регистрации в блокчейне (до 15 сек)
      addNotification(`⏳ ${t('waitingConfirmation')}...`)
      const confirmed = await C.waitForRegistration(wallet)
      if (confirmed) {
        // Обновляем статус из блокчейна
        const gwStatus = await C.getGWUserStatus(wallet).catch(() => null)
        if (gwStatus) {
          useGameStore.getState().updateRegistration(gwStatus.isRegistered, gwStatus.odixId || sid)
          if (gwStatus.maxPackage > 0) useGameStore.getState().setLevel(gwStatus.maxPackage)
        } else {
          useGameStore.getState().updateRegistration(true, sid)
        }
        // Регистрация подтверждена — покупаем уровень
        await doBuyLevel()
      } else {
        // Регистрация прошла но bridge ещё не видит — пробуем купить
        useGameStore.getState().updateRegistration(true, sid)
        addNotification('⚠️ ' + t('slowConfirmation'))
        await doBuyLevel()
      }
    } catch (err) {
      const msg = err?.reason || err?.shortMessage || err?.message || 'Ошибка'
      if (msg.includes('Already registered')) {
        addNotification('ℹ️ ' + t('alreadyRegistered'))
        useGameStore.getState().updateRegistration(true, sid)
        setShowRegModal(false)
        await doBuyLevel()
      } else if (msg.includes('Sponsor not found') || msg.includes('Invalid sponsor')) {
        addNotification(`❌ ${t('sponsorNotFound')} #${sid}`)
      } else {
        addNotification(`❌ ${msg.slice(0, 100)}`)
      }
    }
    setTxPending(false)
    setRegistering(false)
  }

  // Только регистрация БЕЗ покупки уровня
  const handleRegisterOnly = async () => {
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
      // Обновляем статус из блокчейна
      const confirmed = await C.waitForRegistration(wallet)
      const gwStatus = await C.getGWUserStatus(wallet).catch(() => null)
      if (gwStatus) {
        useGameStore.getState().updateRegistration(gwStatus.isRegistered, gwStatus.odixId || sid)
        if (gwStatus.maxPackage > 0) useGameStore.getState().setLevel(gwStatus.maxPackage)
      } else {
        useGameStore.getState().updateRegistration(true, sid)
      }
    } catch (err) {
      const msg = err?.reason || err?.shortMessage || err?.message || 'Ошибка'
      if (msg.includes('Already registered')) {
        addNotification('ℹ️ ' + t('alreadyRegistered'))
        useGameStore.getState().updateRegistration(true, sid)
        setShowRegModal(false)
      } else if (msg.includes('Sponsor not found') || msg.includes('Invalid sponsor')) {
        addNotification(`❌ ${t('sponsorNotFound')} #${sid}`)
      } else {
        addNotification(`❌ ${msg.slice(0, 100)}`)
      }
    }
    setTxPending(false)
    setRegistering(false)
  }

  const doBuyLevel = async () => {
    if (!nextLv) return
    setBuyingLevel(true)
    setTxPending(true)
    try {
      addNotification(`⏳ ${t('buyingLevel')} ${nextLv.name}...`)
      await C.buyLevel(nextLv.id)
      // Обновляем уровень локально сразу
      setLevel(nextLv.id)
      addNotification(`✅ ${nextLv.name} ${t('levelActivated')}`)
      // Подтверждаем из блокчейна через 3 сек
      setTimeout(async () => {
        const gwStatus = await C.getGWUserStatus(wallet).catch(() => null)
        if (gwStatus) {
          if (gwStatus.maxPackage > 0) useGameStore.getState().setLevel(gwStatus.maxPackage)
          useGameStore.getState().updateRegistration(gwStatus.isRegistered, gwStatus.odixId || null)
        }
      }, 3000)
    } catch (err) {
      const msg = err?.reason || err?.shortMessage || err?.message || t('error')
      if (msg.includes('Not registered')) {
        addNotification('❌ ' + t('registrationRequired'))
        openRegModal()
      } else if (msg.includes('insufficient funds') || msg.includes('INSUFFICIENT')) {
        addNotification('❌ ' + t('insufficientBNB'))
      } else {
        addNotification(`❌ ${msg.slice(0, 80)}`)
      }
    }
    setTxPending(false)
    setBuyingLevel(false)
  }

  const evapMin = Math.floor(evapSeconds / 60)
  const evapSec = evapSeconds % 60
  const toolSrc = `/icons/tools/${['hands','shovel','sieve','cart','auto','cutting','jewelry','building','earth','house','village','resort','empire'][level]}.png`
  const lvBg = LEVEL_BACKGROUNDS[level] || LEVEL_BACKGROUNDS[0]
  const bgSrc = `/icons/backgrounds/levels/${lvBg.file}`

  return (
    <div className="flex flex-col flex-1">
      <div className="mx-3 mt-2 p-3 rounded-2xl border flex items-center gap-3" style={{ background: 'linear-gradient(135deg, var(--bg-card), rgba(13,26,46,0.9))', borderColor: `${lv.color}25`, boxShadow: `0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)` }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border-2 flex-shrink-0 overflow-hidden" style={{ borderColor: `${lv.color}50`, background: `${lv.color}12` }}>
          <img src={toolSrc} alt="" className="w-9 h-9 object-contain" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
          <span className="hidden text-2xl">{lv.emoji}</span>
        </div>
        <div className="flex-1">
          <div className="text-sm font-black text-white">{lv.name}</div>
          <div className="text-[10px] text-slate-400">{lv.sub} • Lv.{level}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black font-display" style={{ color: lv.color }}>{totalNst.toFixed(1)}</div>
          <div className="text-[9px] text-slate-500">CHT</div>
        </div>
      </div>

      <div className="px-3 mt-2">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-slate-400">⚡ {t('energy')}</span>
          <span className="text-emerald-400 font-extrabold">{energy}/{maxEnergy}</span>
        </div>
        <div className="h-[7px] rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500 relative overflow-hidden" style={{ width: `${(energy / maxEnergy) * 100}%`, background: `linear-gradient(90deg, ${lv.color}, ${lv.color}cc)` }}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
          </div>
        </div>
      </div>

      <div className="px-3 mt-2 space-y-1.5">
        {/* ═══ КНОПКИ ДЛЯ НЕЗАЛОГИНЕННЫХ ═══ */}
        {!wallet && taps === 0 && (
          <button onClick={connect} className="w-full p-2.5 rounded-xl text-xs font-bold text-center bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/15 transition-all">
            🚀 {t('connectSaveStones')}
          </button>
        )}
        {!wallet && taps > 0 && (
          <button onClick={connect} className="w-full p-2.5 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/25 text-red-400 animate-pulse">
            ⚠️ {t('stonesEvaporating')} <span className="font-display text-lg">{evapMin}:{evapSec < 10 ? '0' : ''}{evapSec}</span> 💨
          </button>
        )}

        {/* ═══ КНОПКА РЕГИСТРАЦИИ (кошелёк есть, регистрации нет) ═══ */}
        {wallet && !registered && !showRegModal && (
          <button onClick={openRegModal}
            className="w-full p-2.5 rounded-xl text-[11px] font-bold text-center bg-yellow-500/8 border border-yellow-500/25 text-yellow-400 hover:bg-yellow-500/12 transition-all">
            🆔 {t('registerInNSS')}
          </button>
        )}

        {/* ═══════════════════════════════════════════════════
            МОДАЛ РЕГИСТРАЦИИ — улучшенный UX
            • Автозаполнение спонсора из реферальной ссылки
            • Объяснение что происходит
            • Подсказка для Telegram-пользователей
            ═══════════════════════════════════════════════════ */}
        {showRegModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-3" style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setShowRegModal(false)}>
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

              {/* Поле спонсора */}
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">{t('sponsorIdLabel')}:</label>
                {refFromLink && sponsorInput ? (
                  // Реф из ссылки — показываем как факт, но даём изменить
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
                  // Ручной ввод
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

              {/* Подсказка для Telegram */}
              {isInTelegram && (
                <div className="p-2.5 rounded-xl text-[10px] leading-relaxed"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <span className="text-blue-400 font-bold">📱 Telegram:</span>{' '}
                  <span className="text-slate-400">
                    {t('telegramWalletHint')}
                  </span>
                </div>
              )}

              {/* Что даёт регистрация */}
              <div className="p-2.5 rounded-xl text-[10px] text-slate-500 leading-relaxed"
                style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.1)' }}>
                ✨ {t('regBenefits')}
              </div>

              {/* Кнопки */}
              <div className="flex gap-2">
                <button onClick={() => setShowRegModal(false)}
                  className="flex-1 py-3 rounded-2xl text-[11px] font-bold text-slate-400 border border-white/10">
                  {t('cancel')}
                </button>
                <button onClick={handleRegisterOnly}
                  disabled={registering || !sponsorInput || parseInt(sponsorInput) <= 0}
                  className="flex-1 py-3 rounded-2xl text-[11px] font-black gold-btn"
                  style={{ opacity: (!sponsorInput || parseInt(sponsorInput) <= 0 || registering) ? 0.5 : 1 }}>
                  {registering ? '⏳ ...' : '✅ ' + t('register')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ КНОПКА ПОКУПКИ СЛЕДУЮЩЕГО РАНГА ═══ */}
        {wallet && nextLv && (
          <button onClick={handleBuyNextLevel} disabled={buyingLevel || txPending}
            className="w-full p-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] border-2 flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${nextLv.color}20, ${nextLv.color}08)`,
              borderColor: `${nextLv.color}50`,
              color: nextLv.color,
              opacity: (buyingLevel || txPending) ? 0.6 : 1,
            }}>
            {buyingLevel ? (
              <span>⏳ {t('buying')}</span>
            ) : (
              <>
                <span className="text-lg">{nextLv.emoji}</span>
                <span>{t('buy')} {nextLv.name}</span>
                <span className="text-[11px] opacity-75">({nextLv.price}{bnbPrice > 0 && nextLv.bnb ? ` ${fmtUsd(nextLv.bnb)}` : ''})</span>
              </>
            )}
          </button>
        )}
        {wallet && !nextLv && level === 12 && (
          <div className="p-2.5 rounded-xl text-[11px] font-bold text-center bg-gold-400/10 border border-gold-400/25 text-gold-400">
            👑 {t('maxLevelReached')}
          </div>
        )}
      </div>

      {nextLv && (
        <div className="px-3 mt-1.5">
          <div className="flex items-center justify-between text-[9px] mb-0.5">
            <span className="text-slate-500">{lv.emoji} Lv.{level} (+{lv.nstPerTap})</span>
            <span style={{ color: nextLv.color }} className="font-bold">{nextLv.emoji} {nextLv.name} (+{nextLv.nstPerTap})</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: '100%', background: `linear-gradient(90deg, ${lv.color}, ${nextLv.color}40)` }} />
          </div>
        </div>
      )}

      <div ref={tapAreaRef} onClick={handleTap} onTouchStart={handleTap}
        className="flex-1 mx-3 my-2 rounded-2xl relative overflow-hidden flex items-center justify-center cursor-pointer select-none min-h-[200px] border transition-all duration-700"
        style={{ borderColor: `${lv.color}20`, background: 'var(--lv-ambient)', boxShadow: `inset 0 0 60px ${lvBg.glow}, 0 0 20px ${lvBg.glow}` }}>
        {/* ═══ Фоновая картинка уровня ═══ */}
        <div className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url(${bgSrc})`, filter: 'brightness(0.85)' }} />
        {/* ═══ Оверлей с цветом уровня ═══ */}
        <div className="absolute inset-0 transition-all duration-700"
          style={{ background: `linear-gradient(180deg, ${lvBg.overlay} 0%, ${lv.color}15 50%, ${lvBg.overlay} 100%)` }} />
        {/* ═══ Виньетка по краям ═══ */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.5) 100%)' }} />

        <div className="relative z-10 active:animate-shake select-none transition-transform w-[100px] h-[100px] flex items-center justify-center drop-shadow-lg">
          <img src={toolSrc} alt={lv.name} className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(255,215,0,0.3)]" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
          <span className="text-6xl hidden">{lv.emoji}</span>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[11px] px-3 py-1 rounded-full"
          style={{ color: '#eee8d5', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          ⛏ {t('tapHint')} • +{lv.nstPerTap} {t('nstPerTap')}
        </div>
        {effects.map(ef => (
          <div key={ef.id} className={`absolute pointer-events-none z-20 ${ef.type === 'number' ? 'animate-tap-up font-black text-base' : 'animate-gem-burst text-lg'}`}
            style={{ left: ef.x, top: ef.y, color: ef.type === 'number' ? 'var(--gold)' : undefined, textShadow: ef.type === 'number' ? '0 0 8px rgba(255,184,0,0.4)' : 'none' }}>
            {ef.text}
          </div>
        ))}
        {thoughts.map(th => (
          <div key={th.id} className={`absolute z-30 px-3 py-2 text-xs font-bold max-w-[85%] pointer-events-none flex items-center gap-2 animate-thought thought-${th.color} ${th.shape}`} style={{ left: '8%', top: '30%' }}>
            <span className="text-xl flex-shrink-0">{th.icon}</span>
            <span className="leading-snug">{th.text}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-3 pb-2">
        <StatCard value={taps} label={t('taps')} color="text-gold-400" />
        <StatCard value={useGameStore.getState().cgt.toFixed(1)} label="CGT" color="text-emerald-400" />
        <StatCard value={parseFloat(useGameStore.getState().usdt || 0).toFixed(0)} label="USDT" color="text-blue-400" />
      </div>

      <div className="px-3 py-1.5 border-t border-white/5 overflow-hidden">
        <div className="flex gap-6 animate-[nscroll_20s_linear_infinite] whitespace-nowrap">
          {[...news, ...news].map((n, i) => (
            <span key={i} className="text-[10px] text-slate-500">📢 <span className="text-gold-400">{n}</span></span>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ value, label, color }) {
  return (
    <div className="glass rounded-xl p-2 text-center">
      <div className={`text-lg font-black font-display ${color}`}>{value}</div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  )
}
