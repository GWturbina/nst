'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'

const TEMPLATES = {
  gems: { emoji: '💎', title: 'Бриллианты по клубной цене!', sub: 'Экономия до 64%. Стейкинг от 50% годовых.', color: '#a855f7', ogImage: 'invite-gems.jpg' },
  house: { emoji: '🏠', title: 'Свой дом под 0%!', sub: 'Заработай 35% — клуб добавит 65%.', color: '#f59e0b', ogImage: 'invite-house.jpg' },
  money: { emoji: '💰', title: '15 источников дохода!', sub: 'Бриллианты, стейкинг, токены — всё в одном.', color: '#10b981', ogImage: 'invite-money.jpg' },
}

const FEATURES = [
  { emoji: '💎', title: 'Реальные бриллианты', desc: 'От завода по клубной цене — экономия до 70%' },
  { emoji: '📈', title: 'Стейкинг Бриллиантов', desc: 'От 50% до 75% годовых на ваших активах' },
  { emoji: '🪙', title: 'DCT токен', desc: 'Обеспечен реальными бриллиантами' },
  { emoji: '🏠', title: 'Свой дом под 0%', desc: 'Заработай 35% — клуб добавит 65%!' },
  { emoji: '🧩', title: 'Доли камней', desc: 'Инвестируй от малой суммы в дорогие камни' },
  { emoji: '👥', title: 'Партнёрская программа', desc: 'До 10% пожизненно от приглашённых' },
]

function InviteContent() {
  const searchParams = useSearchParams()
  const params = useParams()
  const ref = searchParams.get('ref') || '0'
  const t = params.t || 'gems'
  const tpl = TEMPLATES[t] || TEMPLATES.gems

  const [registered, setRegistered] = useState(false)
  const [showExitPopup, setShowExitPopup] = useState(false)

  useEffect(() => {
    let triggered = false
    const handleMouseLeave = (e) => {
      if (e.clientY <= 5 && !triggered && !registered) {
        triggered = true
        setShowExitPopup(true)
      }
    }
    document.addEventListener('mouseleave', handleMouseLeave)

    const handleBack = () => {
      if (!registered) setShowExitPopup(true)
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handleBack)

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('popstate', handleBack)
    }
  }, [registered])

  const handleRegister = () => {
    if (ref && ref !== '0') {
      localStorage.setItem('dc_ref', ref)
    }
    setRegistered(true)
    setShowExitPopup(false)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0a0a20 0%, #1a1040 50%, #0a0a20 100%)' }}>
      <div className="max-w-[430px] mx-auto px-4 py-6">
        <div className="flex justify-center mb-4">
          <img src="/icons/logo.png" alt="NSS" className="w-16 h-16 rounded-2xl" onError={e => { e.target.style.display='none' }} />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-white mb-1">
            <span className="mr-2">{tpl.emoji}</span>{tpl.title}
          </h1>
          <p className="text-sm text-slate-400">{tpl.sub}</p>
        </div>

        <div className="p-3 rounded-2xl mb-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-[12px] text-slate-400">Тебя пригласил участник</div>
          <div className="text-lg font-black" style={{ color: tpl.color }}>ID: {ref}</div>
        </div>

        <div className="flex justify-center gap-3 mb-2">
          <span className="text-4xl">💎</span>
          <span className="text-4xl">🪙</span>
          <span className="text-4xl">🏠</span>
        </div>
        <h2 className="text-center text-lg font-black text-white mb-0.5">NSS Diamond Club</h2>
        <p className="text-center text-[12px] text-slate-500 mb-4">Бриллианты • Инвестиции • Доход</p>

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
            🎁 Присоединиться — БЕСПЛАТНО
          </button>
        ) : (
          <div className="p-4 rounded-2xl mb-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="text-center mb-3">
              <div className="text-[13px] text-emerald-400 font-bold">✅ Реферал сохранён!</div>
              <div className="text-sm font-black text-white mt-1">Спонсор ID: #{ref}</div>
              <div className="text-[11px] text-slate-400 mt-1">Подключи кошелёк в приложении — регистрация пройдёт автоматически с этим спонсором</div>
              <a href="/" className="block w-full py-3 rounded-2xl text-center text-sm font-black mt-3" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
                🚀 Войти в приложение
              </a>
              {/* SafePal deeplink — для Telegram и мобилы */}
              <a href={`safepalwallet://open?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://nst-murex.vercel.app')}`}
                className="block w-full py-3 rounded-2xl text-center text-sm font-black mt-2"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}>
                🔐 Открыть в SafePal
              </a>
              <div className="text-[9px] text-slate-500 mt-1.5 leading-tight">
                Из Telegram? Нажми «Открыть в SafePal» — кошелёк подключится автоматически
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[10px] text-slate-600 mt-4">
          NSS Diamond Club • Powered by GlobalWay
        </div>
      </div>

      {showExitPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{ background: 'linear-gradient(180deg, #1a1040, #0a0a20)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div className="text-center">
              <div className="text-4xl mb-2">⏳</div>
              <h3 className="text-xl font-black text-white mb-1">Не спеши уходить!</h3>
              <p className="text-[12px] text-slate-400 mb-4">Ты в одном шаге от вступления в клуб</p>
              <div className="space-y-2 mb-4 text-left">
                <div className="flex items-center gap-2 text-[12px]"><span className="text-emerald-400">✓</span><span className="text-slate-300">Бесплатная регистрация</span></div>
                <div className="flex items-center gap-2 text-[12px]"><span className="text-emerald-400">✓</span><span className="text-slate-300">Бриллианты со скидкой до 64%</span></div>
                <div className="flex items-center gap-2 text-[12px]"><span className="text-emerald-400">✓</span><span className="text-slate-300">Стейкинг от 50% годовых</span></div>
                <div className="flex items-center gap-2 text-[12px]"><span className="text-emerald-400">✓</span><span className="text-slate-300">Свой дом под 0% годовых</span></div>
              </div>
              <button onClick={handleRegister} className="w-full py-3 rounded-2xl text-base font-black mb-2" style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
                🎁 Присоединиться
              </button>
              <button onClick={() => setShowExitPopup(false)} className="text-[11px] text-slate-500 hover:text-slate-400">
                Нет, спасибо
              </button>
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
