'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import useGameStore from '@/lib/store'
import { LEVELS, LEADERBOARD } from '@/lib/gameData'
import { shortAddress } from '@/lib/web3'
import HelpButton from '@/components/ui/HelpButton'

// ═════════════════════════════════════════════════════════
// TEAM PAGE — Команда + Лидерборд + Соревнования + Профиль
// ═════════════════════════════════════════════════════════

const AVATARS = ['👨‍💼','👩‍💻','🧔','👩‍🔬','👨‍🚀','👩‍🎨','🧑‍🔧','👩‍🏫','👨‍🌾','👩‍⚕️','🦸‍♂️','🦸‍♀️','🧙‍♂️','🧙‍♀️','🥷','🤴','👸']

export default function TeamTab() {
  const { wallet, registered, sponsorId, level, taps, localNss, dct, addNotification, t } = useGameStore()
  const [section, setSection] = useState('team')
  const [referralLink, setReferralLink] = useState('')
  const [copied, setCopied] = useState(false)
  
  // Профиль
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState('👨‍💼')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [editingNick, setEditingNick] = useState(false)
  const [tempNick, setTempNick] = useState('')
  const fileInputRef = useRef(null)

  // Загрузка фото — обрезка до 200x200, сохранение в localStorage
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 200
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        // Обрезка по центру (квадрат)
        const min = Math.min(img.width, img.height)
        const sx = (img.width - min) / 2
        const sy = (img.height - min) / 2

        // Круглая маска
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()

        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)

        const base64 = canvas.toDataURL('image/jpeg', 0.85)
        setAvatar(base64)
        localStorage.setItem('nss_avatar', base64)
        setShowAvatarPicker(false)
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
    // Очистить input чтобы можно было загрузить тот же файл
    e.target.value = ''
  }

  const removePhoto = () => {
    setAvatar('👨‍💼')
    localStorage.setItem('nss_avatar', '👨‍💼')
  }

  const isCustomPhoto = avatar.startsWith('data:')

  // Загрузка профиля
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNickname(localStorage.getItem('nss_nickname') || '')
      setAvatar(localStorage.getItem('nss_avatar') || '👨‍💼')
    }
  }, [])

  useEffect(() => {
    if (wallet && sponsorId) {
      // sponsorId = реальный odixId из GlobalWay (заполняется после регистрации)
      const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/gems?ref=${sponsorId}`
      setReferralLink(link)
    } else {
      setReferralLink('')
    }
  }, [wallet, sponsorId])

  const saveNickname = () => {
    if (tempNick.trim()) {
      setNickname(tempNick.trim())
      localStorage.setItem('nss_nickname', tempNick.trim())
    }
    setEditingNick(false)
  }

  const selectAvatar = (av) => {
    setAvatar(av)
    localStorage.setItem('nss_avatar', av)
    setShowAvatarPicker(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareLinks = {
    tg: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('💎 NSS — Natural Stone Seekers!')}`,
    wa: `https://wa.me/?text=${encodeURIComponent(`💎 NSS — Join! ${referralLink}`)}`,
    vb: `viber://forward?text=${encodeURIComponent(`💎 NSS — Join! ${referralLink}`)}`,
  }

  const lv = LEVELS[level] || LEVELS[0]
  const totalNss = localNss

  const sections = [
    { id: 'profile', icon: '👤', label: t('profile') },
    { id: 'team', icon: '👥', label: t('team') },
    { id: 'leaders', icon: '🏆', label: t('leaderboard') },
    { id: 'contest', icon: '⚔️', label: t('contests') },
  ]

  // Конец текущей недели
  const now = new Date()
  const endOfWeek = new Date(now)
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
  endOfWeek.setHours(23, 59, 59)
  const daysLeft = Math.ceil((endOfWeek - now) / (1000 * 60 * 60 * 24))

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gold-400">👥 {t('team')}</h2>
          <p className="text-[11px] text-slate-500">{t('teamDesc')}</p>
        </div>
        <HelpButton section="team" />
      </div>

      {/* Табы */}
      <div className="flex gap-1 px-3 mt-1 overflow-x-auto scrollbar-hide">
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-bold border whitespace-nowrap ${section === s.id ? 'bg-gold-400/15 border-gold-400/30 text-gold-400' : 'border-white/8 text-slate-500'}`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* ═══ ПРОФИЛЬ ═══ */}
      {section === 'profile' && (
        <div className="px-3 mt-2 space-y-2">
          <div className="p-4 rounded-2xl glass text-center">
            {/* Аватарка */}
            <div className="relative inline-block mb-2">
              <div onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                className="w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-105 overflow-hidden"
                style={{ border: `3px solid ${lv.color}60`, background: `${lv.color}15` }}>
                {isCustomPhoto ? (
                  <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">{avatar}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-sm border-2"
                style={{ background: `${lv.color}30`, borderColor: lv.color, color: lv.color }}>
                {level}
              </div>
              {/* Маленькая иконка камеры */}
              <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] bg-white/10 border border-white/20 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                📷
              </div>
            </div>

            {/* Скрытый input для загрузки фото */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

            {showAvatarPicker && (
              <div className="p-3 rounded-xl bg-white/5 mb-3">
                {/* Кнопка загрузки фото */}
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 rounded-xl text-[11px] font-bold mb-2 bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition-all">
                  📷 {t('uploadPhoto')}
                </button>

                {/* Удалить фото если есть */}
                {isCustomPhoto && (
                  <button onClick={removePhoto}
                    className="w-full py-2 rounded-xl text-[10px] font-bold mb-2 bg-red-500/10 text-red-400 border border-red-500/20">
                    ✕ {t('removePhoto')}
                  </button>
                )}

                {/* Эмодзи-аватарки */}
                <div className="text-[9px] text-slate-500 mb-1.5 text-center">{t('orChooseEmoji')}</div>
                <div className="grid grid-cols-6 gap-2">
                  {AVATARS.map((av, i) => (
                    <button key={i} onClick={() => selectAvatar(av)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${avatar === av ? 'bg-gold-400/20 border border-gold-400/40' : 'hover:bg-white/10'}`}>
                      {av}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Никнейм */}
            {editingNick ? (
              <div className="flex gap-2 justify-center mb-2">
                <input value={tempNick} onChange={e => setTempNick(e.target.value)}
                  placeholder={t('enterNickname')} maxLength={20}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-sm text-white text-center outline-none w-40" />
                <button onClick={saveNickname} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold">✓</button>
              </div>
            ) : (
              <div onClick={() => { setTempNick(nickname); setEditingNick(true) }} className="cursor-pointer mb-1">
                <div className="text-lg font-black text-white">{nickname || t('setNickname')}</div>
                <div className="text-[9px] text-slate-500">{t('tapToEdit')}</div>
              </div>
            )}

            <div className="text-[10px] text-slate-500">
              {wallet ? shortAddress(wallet) : t('notConnected')}
              {sponsorId ? ` • ID: ${sponsorId}` : ''}
            </div>
          </div>

          {/* Статистика профиля */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl glass text-center">
              <div className="text-lg font-black" style={{ color: lv.color }}>{lv.emoji}</div>
              <div className="text-[11px] font-bold text-white">{lv.name}</div>
              <div className="text-[9px] text-slate-500">Lv.{level}</div>
            </div>
            <div className="p-3 rounded-2xl glass text-center">
              <div className="text-lg font-black text-amber-400">{totalNss.toFixed(0)}</div>
              <div className="text-[9px] text-slate-500">⛏ NSS</div>
            </div>
            <div className="p-3 rounded-2xl glass text-center">
              <div className="text-lg font-black text-purple-400">{taps}</div>
              <div className="text-[9px] text-slate-500">{t('taps')}</div>
            </div>
          </div>

          {/* Достижения */}
          <div className="p-3 rounded-2xl glass">
            <div className="text-[12px] font-bold text-gold-400 mb-2">🏅 {t('achievements')}</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: '⛏', name: t('firstTap'), done: taps > 0 },
                { icon: '💎', name: t('collector100'), done: totalNss >= 100 },
                { icon: '🛒', name: t('firstTool'), done: level >= 1 },
                { icon: '💍', name: t('jeweler'), done: level >= 6 },
                { icon: '🏗', name: t('builder'), done: level >= 7 },
                { icon: '🏠', name: t('homeowner'), done: level >= 9 },
                { icon: '👑', name: t('emperor'), done: level >= 12 },
                { icon: '🔥', name: t('taps1000'), done: taps >= 1000 },
              ].map((a, i) => (
                <div key={i} className={`p-2 rounded-xl text-center border ${a.done ? 'bg-gold-400/10 border-gold-400/20' : 'bg-white/3 border-white/5 opacity-40'}`}>
                  <div className="text-lg">{a.icon}</div>
                  <div className="text-[8px] text-slate-400 leading-tight mt-0.5">{a.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ КОМАНДА ═══ */}
      {section === 'team' && (
        <div className="px-3 mt-2 space-y-2">
          {/* Реферальная ссылка */}
          <div className="p-3 rounded-2xl glass">
            <div className="text-[12px] font-bold text-gold-400 mb-2">🔗 {t('myLink')}</div>
            {!wallet ? (
              <div className="text-center py-3">
                <div className="text-2xl mb-1">🔐</div>
                <div className="text-[11px] text-slate-400">{t('connectWalletForLink')}</div>
              </div>
            ) : !referralLink ? (
              // Кошелёк подключён, но нет odixId — значит не зарегистрирован в GlobalWay
              <div className="text-center py-3">
                <div className="text-2xl mb-1">⛏</div>
                <div className="text-[11px] text-slate-400">
                  Купи первый уровень — получишь реферальный ID из GlobalWay
                </div>
              </div>
            ) : (
              <>
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-[10px] text-slate-300 break-all">{referralLink}</div>
                <div className="text-[10px] text-slate-500 mt-1">ID: {sponsorId}</div>
                <div className="flex gap-1.5 mt-2">
                  <button onClick={copyLink}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${copied ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'gold-btn'}`}>
                    {copied ? `✅ ${t('copied')}` : `📋 ${t('copy')}`}
                  </button>
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  <a href={shareLinks.tg} target="_blank" rel="noopener" className="flex-1 py-2 rounded-xl text-[10px] font-bold text-center bg-blue-500/10 text-blue-400 border border-blue-500/20">📱 Telegram</a>
                  <a href={shareLinks.wa} target="_blank" rel="noopener" className="flex-1 py-2 rounded-xl text-[10px] font-bold text-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">💬 WhatsApp</a>
                  <a href={shareLinks.vb} target="_blank" rel="noopener" className="flex-1 py-2 rounded-xl text-[10px] font-bold text-center bg-purple-500/10 text-purple-400 border border-purple-500/20">📞 Viber</a>
                </div>
              </>
            )}
          </div>

          {/* 9 линий партнёрки — проценты из контракта GemVaultV2 */}
          <div className="p-3 rounded-2xl glass">
            <div className="text-[12px] font-bold text-emerald-400 mb-2">📊 9 {t('partnerLines')}</div>
            <div className="space-y-1">
              {[
                { pct: 20, label: '1 линия' },
                { pct: 15, label: '2 линия' },
                { pct: 10, label: '3 линия' },
                { pct: 10, label: '4 линия' },
                { pct: 9,  label: '5 линия' },
                { pct: 8,  label: '6 линия' },
                { pct: 7,  label: '7 линия' },
                { pct: 6,  label: '8 линия' },
                { pct: 5,  label: '9 линия' },
              ].map((line, i) => (
                <div key={i} className="flex items-center gap-2 py-1 border-b border-white/5">
                  <span className="text-[10px] font-bold text-gold-400 w-6">{i + 1}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${line.pct * 5}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 w-10 text-right">{line.pct}%</span>
                  <span className="text-[9px] text-slate-500 w-8 text-right">—</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[9px] text-slate-500 text-center">
              Итого маркетинг: 90% от пула → 9 линий GlobalWay
            </div>
            <div className="mt-1 text-[8px] text-slate-600 text-center">
              + 2% авторские + 3% тех + 5% токеномика = 100%
            </div>
          </div>
        </div>
      )}

      {/* ═══ ЛИДЕРБОРД ═══ */}
      {section === 'leaders' && (
        <div className="px-3 mt-2 space-y-2">
          {/* Демо-данные */}
          <div className="px-3 py-2 rounded-xl border flex items-center gap-2" style={{background:'rgba(245,158,11,0.06)',borderColor:'rgba(245,158,11,0.2)'}}>
            <span className="text-base">🚧</span>
            <div className="text-[10px] leading-tight" style={{color:'rgba(251,191,36,0.7)'}}>
              Демо-данные. Реальный лидерборд появится после старта платформы.
            </div>
          </div>
          {/* Топ-3 */}
          <div className="flex gap-2 items-end justify-center py-3">
            {[1, 0, 2].map(idx => {
              const p = LEADERBOARD[idx]
              if (!p) return null
              const isFirst = idx === 0
              return (
                <div key={idx} className={`text-center ${isFirst ? 'order-1' : idx === 1 ? 'order-0' : 'order-2'}`}>
                  <div className={`${isFirst ? 'w-16 h-16' : 'w-12 h-12'} rounded-full flex items-center justify-center mx-auto mb-1 border-2`}
                    style={{
                      borderColor: isFirst ? '#ffd700' : idx === 1 ? '#c0c0c0' : '#cd7f32',
                      background: isFirst ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)',
                      fontSize: isFirst ? '1.5rem' : '1.2rem',
                    }}>
                    {p.avatar}
                  </div>
                  <div className="text-[11px] font-bold text-white">{p.name}</div>
                  <div className="text-[9px] text-gold-400 font-bold">{p.dct.toLocaleString()} DCT</div>
                  <div className={`text-xs font-black mt-0.5 ${isFirst ? 'text-gold-400' : idx === 1 ? 'text-slate-300' : 'text-orange-400'}`}>
                    {isFirst ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Остальные */}
          <div className="p-3 rounded-2xl glass">
            <div className="space-y-1">
              {LEADERBOARD.slice(3).map((p, i) => (
                <div key={i} className="flex items-center gap-2 py-2 border-b border-white/5">
                  <span className="text-[11px] font-bold text-slate-500 w-5">{i + 4}</span>
                  <span className="text-lg">{p.avatar}</span>
                  <div className="flex-1">
                    <div className="text-[11px] font-bold text-white">{p.name}</div>
                    <div className="text-[9px] text-slate-500">Lv.{p.level} • {p.refs} {t('referrals')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-bold text-gold-400">{p.dct.toLocaleString()}</div>
                    <div className="text-[8px] text-slate-500">DCT</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Моя позиция */}
          {wallet && (
            <div className="p-3 rounded-2xl glass border-gold-400/20">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gold-400 w-5">—</span>
                {isCustomPhoto ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <span className="text-lg">{avatar}</span>
                )}
                <div className="flex-1">
                  <div className="text-[11px] font-bold text-gold-400">{nickname || shortAddress(wallet)} ({t('you')})</div>
                  <div className="text-[9px] text-slate-500">Lv.{level}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold text-amber-400">{totalNss.toFixed(0)}</div>
                  <div className="text-[8px] text-slate-500">⛏ NSS</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ СОРЕВНОВАНИЯ ═══ */}
      {section === 'contest' && (
        <div className="px-3 mt-2 space-y-2">
          {/* Еженедельное */}
          <div className="p-3 rounded-2xl glass border-purple-500/15">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-bold text-purple-400">⚔️ {t('weeklyContest')}</div>
              <div className="text-[10px] text-slate-500">{daysLeft} {t('daysLeft')}</div>
            </div>
            <div className="text-[11px] text-slate-300 mb-3">{t('weeklyContestDesc')}</div>

            <div className="space-y-1.5">
              {[
                { place: '🥇', prize: '500 DCT + 50 DCT', name: LEADERBOARD[0]?.name, dct: LEADERBOARD[0]?.dct },
                { place: '🥈', prize: '300 DCT + 30 DCT', name: LEADERBOARD[1]?.name, dct: LEADERBOARD[1]?.dct },
                { place: '🥉', prize: '150 DCT + 15 DCT', name: LEADERBOARD[2]?.name, dct: LEADERBOARD[2]?.dct },
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
                  <span className="text-lg">{p.place}</span>
                  <div className="flex-1">
                    <div className="text-[11px] font-bold text-white">{p.name}</div>
                    <div className="text-[9px] text-slate-500">{p.dct?.toLocaleString()} DCT</div>
                  </div>
                  <div className="text-[10px] font-bold text-purple-400">{p.prize}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ежемесячное */}
          <div className="p-3 rounded-2xl glass border-emerald-500/15">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-bold text-emerald-400">🏆 {t('monthlyContest')}</div>
              <div className="text-[10px] text-slate-500">{t('february')} 2026</div>
            </div>
            <div className="text-[11px] text-slate-300 mb-3">{t('monthlyContestDesc')}</div>

            <div className="space-y-1.5">
              {[
                { place: '🥇', prize: '2000 DCT + 200 DCT', criteria: t('mostReferrals') },
                { place: '🥈', prize: '1000 DCT + 100 DCT', criteria: t('mostTaps') },
                { place: '🥉', prize: '500 DCT + 50 DCT', criteria: t('mostVolume') },
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
                  <span className="text-lg">{p.place}</span>
                  <div className="flex-1">
                    <div className="text-[11px] font-bold text-white">{p.criteria}</div>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-400">{p.prize}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Правила */}
          <div className="p-3 rounded-2xl glass">
            <div className="text-[12px] font-bold text-gold-400 mb-2">📋 {t('contestRules')}</div>
            <div className="space-y-1.5 text-[11px] text-slate-300">
              <p>1. {t('contestRule1')}</p>
              <p>2. {t('contestRule2')}</p>
              <p>3. {t('contestRule3')}</p>
              <p>4. {t('contestRule4')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
