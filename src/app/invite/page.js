'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const FEATURES = [
  { emoji: '⛏', title: 'Бесплатный старт', desc: 'Тапай — зарабатывай GST очки' },
  { emoji: '💎', title: 'Реальные бриллианты', desc: 'От завода со скидкой до 70%' },
  { emoji: '📈', title: 'Стейкинг от 50%', desc: 'До 75% годовых за активность' },
  { emoji: '👥', title: '9 уровней партнёрки', desc: 'До 10% ПОЖИЗНЕННО от приглашённых' },
]

function InviteContent() {
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref') || '0'

  const [registered, setRegistered] = useState(false)
  const [showExitPopup, setShowExitPopup] = useState(false)
  const [showViralPopup, setShowViralPopup] = useState(false)
  const [copied, setCopied] = useState(false)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const myLink = `${baseUrl}/invite?ref=${ref}`
  const shareText = `💎 Бриллианты со скидкой до 70%! Бесплатный старт + стейкинг от 50%! Присоединяйся:`
  const viberText = 'Бриллианты со скидкой до 70%! Бесплатный старт + стейкинг от 50%! Присоединяйся:'

  const shareLinks = {
    tg: `https://t.me/share/url?url=${encodeURIComponent(myLink)}&text=${encodeURIComponent(shareText)}`,
    wa: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${myLink}`)}`,
    vb: `viber://forward?text=${encodeURIComponent(`${viberText}\n${myLink}`)}`,
  }

  useEffect(() => {
    let triggered = false
    const handleMouseLeave = (e) => {
      if (e.clientY <= 5 && !triggered) {
        triggered = true
        if (registered) setShowViralPopup(true)
        else setShowExitPopup(true)
      }
    }
    const handleBack = () => {
      if (registered) setShowViralPopup(true)
      else setShowExitPopup(true)
    }
    document.addEventListener('mouseleave', handleMouseLeave)
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handleBack)
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('popstate', handleBack)
    }
  }, [registered])

  const handleRegister = () => {
    if (ref && ref !== '0') localStorage.setItem('dc_ref', ref)
    setRegistered(true)
    setShowExitPopup(false)
  }

  const copyLink = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(myLink)
    else { const ta = document.createElement('textarea'); ta.value = myLink; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0a0a20 0%, #1a1040 50%, #0a0a20 100%)' }}>
      <div className="max-w-[430px] mx-auto px-4 py-6">
        <div className="flex justify-center mb-4">
          <img src="/icons/logo.png" alt="Diamond Club" className="w-16 h-16 rounded-2xl" onError={e => { e.target.style.display='none' }} />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-white mb-1">💎 Бриллианты со скидкой до 70%!</h1>
          <p className="text-sm text-slate-400">Закрытый клуб. Бесплатный старт.</p>
        </div>

        <div className="p-3 rounded-2xl mb-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-[12px] text-slate-400">Тебя пригласил участник</div>
          <div className="text-lg font-black text-purple-400">ID: {ref}</div>
        </div>

        <div className="flex justify-center gap-3 mb-2">
          <span className="text-4xl">💎</span><span className="text-4xl">⛏</span><span className="text-4xl">💰</span>
        </div>
        <h2 className="text-center text-lg font-black text-white mb-0.5">GST — Искатели Драгоценных Камней</h2>
        <p className="text-center text-[12px] text-slate-500 mb-4">Gem Seekers</p>

        <div className="space-y-2 mb-6">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-xl mt-0.5">{f.emoji}</span>
              <div>
                <div className="text-[13px] font-bold text-white">{f.title}</div>
                <div className="text-[11px] text-slate-400">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {!registered ? (
          <button onClick={handleRegister} className="w-full py-4 rounded-2xl text-lg font-black mb-4" style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
            🎁 Получить подарок — БЕСПЛАТНО
          </button>
        ) : (
          <div className="space-y-3 mb-4">
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="text-center">
                <div className="text-[13px] text-emerald-400 font-bold">✅ Реферал сохранён!</div>
                <div className="text-sm font-black text-white mt-1">Спонсор ID: #{ref}</div>
                <a href="/" className="block w-full py-3 rounded-2xl text-center text-sm font-black mt-3" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
                  🚀 Войти в приложение
                </a>
                {/* SafePal deeplink — для Telegram и мобилы */}
                <a href={`safepalwallet://open?url=${encodeURIComponent(baseUrl)}`}
                  className="block w-full py-3 rounded-2xl text-center text-sm font-black mt-2"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}>
                  🔐 Открыть в SafePal
                </a>
                <div className="text-[9px] text-slate-500 mt-1.5 leading-tight">
                  Из Telegram? Нажми «Открыть в SafePal» — кошелёк подключится автоматически
                </div>
              </div>
            </div>

            {/* Вирусный блок */}
            <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(245,166,35,0.08))', border: '1px solid rgba(255,215,0,0.25)' }}>
              <div className="text-center mb-3">
                <div className="text-2xl mb-1">🔥</div>
                <div className="text-[14px] font-black text-white">Хочешь ещё больше скидку?</div>
                <div className="text-[11px] font-bold mt-1" style={{ color: '#ffd700' }}>Отправь 5 друзьям → получи от +5% до +10%!</div>
                <div className="text-[10px] text-slate-400 mt-1">Итого до <b className="text-white">80% скидки</b> на бриллианты!</div>
              </div>

              <div className="p-2 rounded-xl bg-black/30 text-[9px] text-white break-all mb-2 font-mono">{myLink}</div>
              <button onClick={copyLink} className="w-full py-2 rounded-xl text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 mb-3">
                {copied ? '✅ Скопировано!' : '📋 Копировать ссылку'}
              </button>

              <div className="flex gap-2">
                <a href={shareLinks.tg} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6' }}>
                  📱 Telegram
                </a>
                <a href={shareLinks.wa} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
                  💬 WhatsApp
                </a>
                <a href={shareLinks.vb} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>
                  📞 Viber
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[10px] text-slate-600 mt-4">GST — Искатели Драгоценных Камней • Powered by GlobalWay</div>
      </div>

      {/* Popup 1: До регистрации */}
      {showExitPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{ background: 'linear-gradient(180deg, #1a1040, #0a0a20)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div className="text-center">
              <div className="text-4xl mb-2">⏳</div>
              <h3 className="text-xl font-black text-white mb-1">Не спеши уходить!</h3>
              <p className="text-[12px] text-slate-400 mb-4">Мало <b style={{ color: '#ffd700' }}>-70%</b>? Пригласи друзей и получи ещё!</p>
              <div className="space-y-2 mb-4 text-left">
                <div className="flex items-center gap-2 text-[12px]"><span className="text-emerald-400">✓</span><span className="text-slate-300">Бесплатная регистрация</span></div>
                <div className="flex items-center gap-2 text-[12px]"><span className="text-emerald-400">✓</span><span className="text-slate-300">Бриллианты со скидкой до 70%</span></div>
                <div className="flex items-center gap-2 text-[12px]"><span style={{ color: '#ffd700' }}>🔥</span><span className="text-slate-300"><b style={{ color: '#ffd700' }}>+5-10%</b> если пригласишь 5 друзей</span></div>
                <div className="flex items-center gap-2 text-[12px]"><span className="text-emerald-400">✓</span><span className="text-slate-300">Стейкинг от 50% до 75% годовых</span></div>
              </div>
              <button onClick={handleRegister} className="w-full py-3 rounded-2xl text-base font-black mb-2" style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
                🎁 Получить подарок + бонус!
              </button>
              <button onClick={() => setShowExitPopup(false)} className="text-[11px] text-slate-500">Нет, спасибо</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup 2: После регистрации — вирусный */}
      {showViralPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{ background: 'linear-gradient(180deg, #1a1040, #0a0a20)', border: '1px solid rgba(255,215,0,0.3)' }}>
            <div className="text-center">
              <div className="text-4xl mb-2">🔥</div>
              <h3 className="text-xl font-black text-white mb-1">Не уходи с пустыми руками!</h3>
              <div className="text-[13px] font-bold mb-1" style={{ color: '#ffd700' }}>Получи дополнительные 5-10% скидки!</div>
              <p className="text-[11px] text-slate-400 mb-4">
                Отправь эту ссылку <b className="text-white">5 друзьям</b> → свяжись с приглашающим → получи <b style={{ color: '#ffd700' }}>до 80% скидки</b>!
              </p>

              <div className="p-2.5 rounded-xl bg-black/40 text-[10px] text-white break-all mb-3 font-mono border border-white/10">{myLink}</div>

              <button onClick={copyLink} className="w-full py-2.5 rounded-xl text-[12px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 mb-3">
                {copied ? '✅ Скопировано!' : '📋 Копировать ссылку'}
              </button>

              <div className="flex gap-2 mb-4">
                <a href={shareLinks.tg} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>📱 TG</a>
                <a href={shareLinks.wa} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>💬 WA</a>
                <a href={shareLinks.vb} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>📞 VB</a>
              </div>

              <div className="p-2.5 rounded-xl mb-3 text-[10px] text-slate-400 leading-relaxed" style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.1)' }}>
                💡 <b className="text-white">Как получить бонус:</b><br/>
                1. Скопируй ссылку выше<br/>
                2. Отправь минимум 5 друзьям<br/>
                3. Свяжись со своим спонсором (ID: #{ref})<br/>
                4. Получи персональную скидку +5-10%!
              </div>

              <a href="/" className="block w-full py-3 rounded-2xl text-center text-sm font-black mb-2" style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
                🚀 Войти в приложение
              </a>
              <button onClick={() => setShowViralPopup(false)} className="text-[11px] text-slate-500">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a20' }}><div className="text-white">Loading...</div></div>}>
      <InviteContent />
    </Suspense>
  )
}
