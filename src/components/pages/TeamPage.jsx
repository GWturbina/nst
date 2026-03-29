'use client'
/**
 * TeamPage.jsx — Команда Diamond Club
 * Адаптировано из Метр Квадратный
 * Профиль + 9 линий GlobalWay + Баланс GW + Маркетинг DC + Турниры
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import { LEVELS } from '@/lib/gameData'
import * as Team from '@/lib/teamContracts'
import HelpButton from '@/components/ui/HelpButton'

const AVATARS = ['👨‍💼','👩‍💻','🧔','👩‍🔬','👨‍🚀','👩‍🎨','🧑‍🔧','👩‍🏫','👨‍🌾','👩‍⚕️','🦸‍♂️','🦸‍♀️','🧙‍♂️','🧙‍♀️','🥷','🤴','👸']

export default function TeamTab() {
  const { wallet, sponsorId, level, localNss, dct, bnbPrice, registered, addNotification, t } = useGameStore()
  const [section, setSection] = useState('profile')
  const [copied, setCopied] = useState(false)
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState('👨‍💼')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [editingNick, setEditingNick] = useState(false)
  const [tempNick, setTempNick] = useState('')
  const fileInputRef = useRef(null)

  // Данные с блокчейна
  const [gwFullStats, setGwFullStats] = useState(null)
  const [gwBalances, setGwBalances] = useState(null)

  // 9 ЛИНИЙ
  const [lines, setLines] = useState({})
  const [expandedLine, setExpandedLine] = useState(null)
  const [expandedPartner, setExpandedPartner] = useState(null)
  const [loadingLine, setLoadingLine] = useState(null)
  const [totalPartners, setTotalPartners] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNickname(localStorage.getItem('nss_nickname') || '')
      setAvatar(localStorage.getItem('nss_avatar') || '👨‍💼')
    }
  }, [])

  useEffect(() => {
    if (!wallet) return
    Team.getUserFullStats(wallet).then(setGwFullStats).catch(() => {})
    Team.getUserGWBalances(wallet).then(setGwBalances).catch(() => {})
    loadLine1()
  }, [wallet])

  const loadLine1 = async () => {
    if (!wallet) return
    setLoadingLine(0)
    const addresses = await Team.getDirectReferrals(wallet)
    const details = await Team.loadLineDetails(addresses)
    setLines(prev => ({ ...prev, 0: { addresses, details, loaded: true } }))
    setTotalPartners(addresses.length)
    setLoadingLine(null)
  }

  const loadLine = useCallback(async (lineNum) => {
    if (lines[lineNum]?.loaded) return
    const prevLine = lines[lineNum - 1]
    if (!prevLine?.addresses?.length) return
    setLoadingLine(lineNum)
    const addresses = await Team.getNextLineAddresses(prevLine.addresses)
    const details = await Team.loadLineDetails(addresses)
    setLines(prev => ({ ...prev, [lineNum]: { addresses, details, loaded: true } }))
    setLoadingLine(null)
  }, [lines])

  const toggleLine = async (lineNum) => {
    if (expandedLine === lineNum) { setExpandedLine(null); return }
    if (!lines[lineNum]?.loaded) await loadLine(lineNum)
    setExpandedLine(lineNum)
    setExpandedPartner(null)
  }

  // Профиль
  const lv = LEVELS[level] || LEVELS[0]
  const isCustomPhoto = avatar.startsWith('data:')
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const referralLink = sponsorId ? `${baseUrl}/invite/gems?ref=${sponsorId}` : ''
  const shareText = '💎 Бриллианты со скидкой до 70%! Стейкинг от 50% годовых. Diamond Club!'
  const shareLinks = {
    tg: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`,
    wa: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${referralLink}`)}`,
    vb: `viber://forward?text=${encodeURIComponent(`Brillianty so skidkoy do 70%! Diamond Club!\n${referralLink}`)}`,
  }

  const fmtUsd = (bnb) => {
    if (!bnb || !bnbPrice) return '$0.00'
    return `$${(parseFloat(bnb) * bnbPrice).toFixed(2)}`
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 200; canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')
        const min = Math.min(img.width, img.height)
        const sx = (img.width - min) / 2, sy = (img.height - min) / 2
        ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); ctx.clip()
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
        const base64 = canvas.toDataURL('image/jpeg', 0.85)
        setAvatar(base64); localStorage.setItem('nss_avatar', base64); setShowAvatarPicker(false)
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file); e.target.value = ''
  }

  const saveNickname = () => { if(tempNick.trim()){setNickname(tempNick.trim());localStorage.setItem('nss_nickname',tempNick.trim())}; setEditingNick(false) }
  const selectAvatar = (av) => { setAvatar(av); localStorage.setItem('nss_avatar', av); setShowAvatarPicker(false) }
  const copyLink = () => { navigator.clipboard.writeText(referralLink); setCopied(true); setTimeout(()=>setCopied(false),2000) }

  const rankEmoji = gwFullStats ? (Team.RANK_EMOJIS[gwFullStats.matrixRank] || '⚪') : '⚪'
  const rankName = gwFullStats ? (Team.RANK_NAMES[gwFullStats.matrixRank] || 'Без ранга') : 'Без ранга'
  const rankColor = gwFullStats ? (Team.RANK_COLORS[gwFullStats.matrixRank] || '#94a3b8') : '#94a3b8'

  const now = new Date()
  const endOfWeek = new Date(now); endOfWeek.setDate(endOfWeek.getDate()+(7-endOfWeek.getDay())); endOfWeek.setHours(23,59,59)
  const daysLeft = Math.ceil((endOfWeek - now) / 86400000)

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gold-400">👥 Команда</h2>
          <p className="text-[11px] text-slate-500">Партнёры • Маркетинг • Турниры</p>
        </div>
        <HelpButton section="team" />
      </div>

      {/* Табы */}
      <div className="flex gap-1 px-3 mt-1 overflow-x-auto scrollbar-hide">
        {[
          { id: 'profile', icon: '👤', label: 'Профиль' },
          { id: 'marketing', icon: '💰', label: 'Маркетинг' },
          { id: 'contest', icon: '🏆', label: 'Турниры' },
        ].map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-bold border whitespace-nowrap ${section === s.id ? 'bg-gold-400/15 border-gold-400/30 text-gold-400' : 'border-white/8 text-slate-500'}`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ПРОФИЛЬ + КОМАНДА + БАЛАНС GW */}
      {/* ═══════════════════════════════════════════════════ */}
      {section === 'profile' && (
        <div className="px-3 mt-2 space-y-2">

          {/* Аватар + Ник */}
          <div className="p-4 rounded-2xl glass text-center">
            <div className="relative inline-block mb-2">
              <div onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                className="w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-105 overflow-hidden"
                style={{ border: `3px solid ${lv.color}60`, background: `${lv.color}15` }}>
                {isCustomPhoto ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-4xl">{avatar}</span>}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-sm border-2"
                style={{ background: `${lv.color}30`, borderColor: lv.color, color: lv.color }}>{level}</div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] bg-white/10 border border-white/20 cursor-pointer"
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>📷</div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            {showAvatarPicker && (
              <div className="flex flex-wrap gap-2 justify-center mb-3 p-3 rounded-xl bg-white/5">
                {AVATARS.map(av => <button key={av} onClick={() => selectAvatar(av)} className="text-2xl p-1 hover:scale-125 transition-transform">{av}</button>)}
                {isCustomPhoto && <button onClick={() => { setAvatar('👨‍💼'); localStorage.setItem('nss_avatar','👨‍💼') }} className="text-[10px] text-red-400 px-2 py-1 rounded bg-red-500/10">✕ Убрать фото</button>}
              </div>
            )}

            {editingNick ? (
              <div className="flex gap-2 justify-center mb-1">
                <input value={tempNick} onChange={e => setTempNick(e.target.value)} maxLength={20} autoFocus
                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center w-32"
                  onKeyDown={e => e.key==='Enter' && saveNickname()} />
                <button onClick={saveNickname} className="text-[11px] text-emerald-400 font-bold">✓</button>
                <button onClick={() => setEditingNick(false)} className="text-[11px] text-slate-500">✕</button>
              </div>
            ) : (
              <div className="text-sm font-black text-white cursor-pointer" onClick={() => { setTempNick(nickname); setEditingNick(true) }}>
                {nickname || 'Задать ник'}
              </div>
            )}
            <div className="text-[10px] text-slate-500">{editingNick ? '' : 'нажми чтобы изменить'}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {wallet ? shortAddress(wallet) : '—'} • ID: {sponsorId || '—'}
            </div>
            <div className="mt-1 px-3 py-1 rounded-full inline-block" style={{ background: `${rankColor}15`, border: `1px solid ${rankColor}30` }}>
              <span className="text-[11px] font-bold" style={{ color: rankColor }}>{rankEmoji} {rankName}</span>
            </div>
          </div>

          {/* Реферальная ссылка */}
          {referralLink && (
            <div className="p-3 rounded-2xl glass">
              <div className="text-[11px] font-bold text-gold-400 mb-2">🔗 Реферальная ссылка</div>
              <input readOnly value={referralLink} className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[10px] text-slate-300 outline-none mb-2" />
              <button onClick={copyLink} className="w-full py-2.5 rounded-xl text-[12px] font-black gold-btn">
                {copied ? '✅ Скопировано!' : '📋 Копировать'}
              </button>
              <div className="flex gap-2 mt-2">
                <a href={shareLinks.tg} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-xl text-center text-[11px] font-bold bg-blue-500/15 border border-blue-500/25 text-blue-400">📨 TG</a>
                <a href={shareLinks.wa} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-xl text-center text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">👁 WA</a>
                <a href={shareLinks.vb} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-xl text-center text-[11px] font-bold bg-purple-500/15 border border-purple-500/25 text-purple-400">📞 VB</a>
              </div>
            </div>
          )}

          {/* 9 ЛИНИЙ КОМАНДЫ */}
          <div className="p-3 rounded-2xl glass">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-gold-400">👥 Команда ({totalPartners} чел.)</div>
              <button onClick={loadLine1} className="text-[10px] text-slate-500 hover:text-white">🔄</button>
            </div>
            <div className="space-y-0.5">
              {Array.from({ length: 9 }, (_, i) => {
                const lineNum = i
                const line = lines[lineNum]
                const count = line?.addresses?.length || 0
                const isOpen = expandedLine === lineNum
                const isLoading = loadingLine === lineNum
                const canLoad = lineNum === 0 || (lines[lineNum - 1]?.addresses?.length > 0)

                return (
                  <div key={lineNum}>
                    <button onClick={() => canLoad && toggleLine(lineNum)}
                      className={`w-full flex items-center gap-2 py-2.5 px-3 rounded-xl text-left transition-all ${
                        isOpen ? 'bg-gold-400/8 border border-gold-400/20' : canLoad ? 'hover:bg-white/3 border border-transparent' : 'opacity-40 border border-transparent'
                      }`}>
                      <span className="text-[12px] font-black w-5" style={{ color: count > 0 ? '#ffd700' : '#4a5568' }}>{lineNum + 1}</span>
                      <div className="flex-1 text-[11px] font-bold" style={{ color: count > 0 ? '#e2e8f0' : '#4a5568' }}>
                        Линия {lineNum + 1}
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: count > 0 ? '#10b981' : '#4a5568' }}>
                        {isLoading ? '⏳' : line?.loaded ? `${count} чел.` : canLoad ? '→' : ''}
                      </span>
                    </button>

                    {isOpen && line?.loaded && (
                      <div className="ml-2 mt-1 mb-2 space-y-0.5">
                        {count === 0 && <div className="py-2 text-[10px] text-slate-500 text-center">Пусто</div>}
                        {line.details.map((p, pi) => {
                          const pLv = LEVELS[p.maxLevel] || LEVELS[0]
                          const pRankE = Team.RANK_EMOJIS[p.matrixRank] || '⚪'
                          const isExpP = expandedPartner === `${lineNum}-${pi}`
                          return (
                            <div key={pi}>
                              <button onClick={() => setExpandedPartner(isExpP ? null : `${lineNum}-${pi}`)}
                                className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-left hover:bg-white/3">
                                <span className="text-[9px] text-slate-600 w-4">{pi+1}</span>
                                <span className="text-xs">{pLv.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[10px] font-bold text-white">{shortAddress(p.address)}</span>
                                  <span className="text-[8px] text-slate-500 ml-1">ID:{p.userId||'—'} Lv.{p.maxLevel} {pRankE}</span>
                                </div>
                                <span className="text-[9px]" style={{color:p.quarterlyActive?'#10b981':'#94a3b8'}}>{p.quarterlyActive?'✅':'⏸'}</span>
                              </button>
                              {isExpP && (
                                <div className="ml-6 mr-1 mb-1 p-2 rounded-lg text-[9px]" style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)'}}>
                                  <div className="grid grid-cols-2 gap-1">
                                    <div><span className="text-slate-500">ID: </span><span className="text-white font-bold">{p.userId||'—'}</span></div>
                                    <div><span className="text-slate-500">Спонсор: </span><span className="text-white">{p.sponsorId||'—'}</span></div>
                                    <div><span className="text-slate-500">Уровень: </span><span className="text-gold-400 font-bold">{p.maxLevel}/12</span></div>
                                    <div><span className="text-slate-500">Ранг: </span><span style={{color:Team.RANK_COLORS[p.matrixRank]}}>{Team.RANK_NAMES[p.matrixRank]}</span></div>
                                    <div><span className="text-slate-500">Партнёры: </span><span className="text-white">{p.personalInvites}</span></div>
                                    <div><span className="text-slate-500">Quarterly: </span><span className={p.quarterlyActive?'text-emerald-400':'text-red-400'}>{p.quarterlyActive?'Да':'Нет'}</span></div>
                                    <div><span className="text-slate-500">Партнёрка: </span><span className="text-emerald-400">{parseFloat(p.partnerEarnings).toFixed(4)} BNB</span></div>
                                    <div><span className="text-slate-500">Матричные: </span><span className="text-blue-400">{parseFloat(p.matrixEarnings).toFixed(4)} BNB</span></div>
                                  </div>
                                  <div className="mt-1 text-[8px] text-slate-600 font-mono break-all">{p.address}</div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Баланс GlobalWay */}
          {gwBalances && (
            <div className="p-3 rounded-2xl glass">
              <div className="text-[11px] font-bold text-gold-400 mb-2">💰 Баланс GlobalWay</div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 rounded-lg bg-white/5 text-center">
                  <div className="font-black text-emerald-400">{fmtUsd(gwBalances.partnerFromSponsor)}</div>
                  <div className="text-[8px] text-slate-500">От спонсора</div>
                </div>
                <div className="p-2 rounded-lg bg-white/5 text-center">
                  <div className="font-black text-emerald-400">{fmtUsd(gwBalances.partnerFromUpline)}</div>
                  <div className="text-[8px] text-slate-500">От аплайн</div>
                </div>
                <div className="p-2 rounded-lg bg-white/5 text-center">
                  <div className="font-black text-blue-400">{fmtUsd(gwBalances.matrixEarnings)}</div>
                  <div className="text-[8px] text-slate-500">Матричные</div>
                </div>
                <div className="p-2 rounded-lg bg-white/5 text-center">
                  <div className="font-black text-purple-400">{fmtUsd(gwBalances.pensionBalance)}</div>
                  <div className="text-[8px] text-slate-500">Пенсия</div>
                </div>
              </div>
              <div className="mt-2 p-2 rounded-lg text-center" style={{background:'rgba(255,215,0,0.06)'}}>
                <span className="text-[13px] font-black text-gold-400">{fmtUsd(gwBalances.totalBalance)}</span>
                <span className="text-[9px] text-slate-500 ml-2">Итого</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* МАРКЕТИНГ DIAMOND CLUB */}
      {/* ═══════════════════════════════════════════════════ */}
      {section === 'marketing' && (
        <div className="px-3 mt-2 space-y-3">
          <div className="text-center text-[11px] text-slate-400 mb-1">
            Маркетинг Diamond Club • 9 линий глубины
          </div>

          {/* Маркетинг план */}
          <div className="p-4 rounded-2xl" style={{background:'rgba(21,21,48,0.8)',border:'1px solid rgba(212,168,67,0.15)'}}>
            <div className="text-[13px] font-black text-gold-400 mb-3">💎 Маркетинг Diamond Club</div>
            <div className="text-[11px] text-slate-300 mb-3 leading-relaxed">
              Партнёрская программа 9 уровней глубины. Доход от каждой покупки доли в клубных лотах и от всех операций с DCT токеном.
            </div>

            <div className="space-y-1">
              {Team.DC_MARKETING_LINES.map((ml, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/5">
                  <span className="text-[11px] font-black text-gold-400 w-5">{ml.line}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${ml.pct * 5}%`, background: `linear-gradient(90deg, #d4a843, #e8c96a)` }} />
                  </div>
                  <span className="text-[11px] font-black text-emerald-400 w-10 text-right">{ml.pct}%</span>
                  <span className="text-[9px] text-slate-500 w-12 text-right">Lv.{ml.minLevel}+</span>
                </div>
              ))}
            </div>

            <div className="mt-3 p-2.5 rounded-xl text-center" style={{background:'rgba(255,215,0,0.06)',border:'1px solid rgba(255,215,0,0.15)'}}>
              <div className="text-[12px] font-black text-gold-400">Итого: 90% от маркетинг-пула</div>
              <div className="text-[9px] text-slate-500 mt-0.5">+ 2% авторские + 3% тех + 5% токеномика = 100%</div>
            </div>
          </div>

          {/* Откуда доход */}
          <div className="p-4 rounded-2xl glass">
            <div className="text-[12px] font-black text-emerald-400 mb-2">📊 Источники дохода</div>
            <div className="space-y-2">
              {[
                { icon: '🎟', title: 'Клубные лоты', desc: 'Реферальный % от каждой покупки доли партнёром' },
                { icon: '💎', title: 'Покупка камней', desc: 'Маркетинговый % от заказов через конфигуратор' },
                { icon: '💱', title: 'DCT Exchange', desc: 'Комиссия биржи распределяется по линиям' },
                { icon: '🏪', title: 'Витрина / P2P', desc: 'Комиссия от продаж на витрине и P2P' },
                { icon: '📈', title: 'Уровни (пакеты)', desc: 'Партнёрские выплаты при покупке уровней' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-2 rounded-xl bg-white/3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <div className="text-[11px] font-bold text-white">{item.title}</div>
                    <div className="text-[10px] text-slate-400">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Как начать */}
          <div className="p-4 rounded-2xl glass">
            <div className="text-[12px] font-black text-blue-400 mb-2">🚀 Как начать зарабатывать</div>
            <div className="space-y-1.5 text-[11px] text-slate-300">
              <div className="flex gap-2"><span className="text-gold-400 font-bold">1.</span> Зарегистрируйтесь (бесплатно)</div>
              <div className="flex gap-2"><span className="text-gold-400 font-bold">2.</span> Купите уровень (от 0.0015 BNB)</div>
              <div className="flex gap-2"><span className="text-gold-400 font-bold">3.</span> Поделитесь реферальной ссылкой</div>
              <div className="flex gap-2"><span className="text-gold-400 font-bold">4.</span> Получайте % с 9 линий глубины</div>
              <div className="flex gap-2"><span className="text-gold-400 font-bold">5.</span> Чем выше уровень — тем больше линий открыто</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ТУРНИРЫ */}
      {/* ═══════════════════════════════════════════════════ */}
      {section === 'contest' && (
        <div className="px-3 mt-2 space-y-2">
          <div className="p-3 rounded-2xl glass border-purple-500/15">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-bold text-purple-400">⚔️ Еженедельный</div>
              <div className="text-[10px] text-slate-500">{daysLeft} дн.</div>
            </div>
            <div className="text-[11px] text-slate-300 mb-3">Набери больше всех GST за неделю!</div>
            <div className="space-y-1.5">
              {[{p:'🥇',r:'500 GST + 50 DCT'},{p:'🥈',r:'300 GST + 30 DCT'},{p:'🥉',r:'150 GST + 15 DCT'}].map((x,i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
                  <span className="text-lg">{x.p}</span>
                  <div className="flex-1 text-[11px] text-white font-bold">Место {i+1}</div>
                  <div className="text-[10px] font-bold text-purple-400">{x.r}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-2xl glass border-emerald-500/15">
            <div className="text-[12px] font-bold text-emerald-400 mb-2">🏆 Ежемесячный</div>
            <div className="space-y-1.5">
              {[{p:'🥇',r:'2000 GST + 200 DCT',c:'Рефералы'},{p:'🥈',r:'1000 GST + 100 DCT',c:'Тапы'},{p:'🥉',r:'500 GST + 50 DCT',c:'Объём покупок'}].map((x,i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
                  <span className="text-lg">{x.p}</span>
                  <div className="flex-1 text-[11px] font-bold text-white">{x.c}</div>
                  <div className="text-[10px] font-bold text-emerald-400">{x.r}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-2xl glass">
            <div className="text-[12px] font-bold text-gold-400 mb-2">📋 Правила</div>
            <div className="space-y-1 text-[11px] text-slate-300">
              <p>1. Только зарегистрированные участники</p>
              <p>2. Обновление раз в сутки</p>
              <p>3. Призы автоматически</p>
              <p>4. Накрутка = бан</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
