'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'

const TEMPLATES = {
  gems: { emoji: '💎', title: 'Бриллианты по клубной цене!', sub: 'Экономия до 64%. Стейкинг от 50% годовых.', color: '#a855f7' },
  house: { emoji: '🏠', title: 'Свой дом под 0%!', sub: 'Заработай 35% — клуб добавит 65%.', color: '#f59e0b' },
  money: { emoji: '💰', title: '15 источников дохода!', sub: 'Бриллианты, стейкинг, токены — всё в одном.', color: '#10b981' },
}

const FEATURES = [
  { emoji: '💎', title: 'Реальные бриллианты', desc: 'От завода по клубной цене — экономия до 70%' },
  { emoji: '📈', title: 'Стейкинг Бриллиантов', desc: 'От 50% до 75% годовых на ваших активах' },
  { emoji: '🪙', title: 'DCT токен', desc: 'Обеспечен реальными бриллиантами' },
  { emoji: '🏠', title: 'Свой дом под 0%', desc: 'Заработай 35% — клуб добавит 65%!' },
  { emoji: '🧩', title: 'Доли камней', desc: 'Инвестируй от малой суммы в дорогие камни' },
  { emoji: '👥', title: 'Партнёрская программа', desc: 'До 10% пожизненно от приглашённых' },
]

function validateContact(value) {
  const v = value.trim()
  if (!v) return { valid: false, hint: 'Введите контакт' }
  if (v.startsWith('+')) {
    if (/^\+\d{10,15}$/.test(v)) return { valid: true, hint: '✅ Телефон' }
    return { valid: false, hint: 'Формат: +380987654321 (10-15 цифр после +)' }
  }
  if (v.startsWith('@')) {
    if (/^@[a-zA-Z0-9_]{3,32}$/.test(v)) return { valid: true, hint: '✅ Telegram' }
    return { valid: false, hint: 'Формат: @username (3-32 символа)' }
  }
  if (v.includes('#')) {
    if (/^#[a-zA-Z0-9_]{2,32}$/.test(v) || /^[a-zA-Z0-9_]{2,32}#\d{1,6}$/.test(v)) return { valid: true, hint: '✅ Ник' }
    return { valid: false, hint: 'Формат: #ник или ник#1234' }
  }
  return { valid: false, hint: 'Начните с + (телефон), @ (Telegram) или # (ник)' }
}

function validateName(value) {
  const v = value.trim()
  if (v.length < 2) return { valid: false, hint: 'Минимум 2 символа' }
  if (v.length > 50) return { valid: false, hint: 'Максимум 50 символов' }
  return { valid: true, hint: '' }
}

function InviteContent() {
  const searchParams = useSearchParams()
  const params = useParams()
  const ref = searchParams.get('ref') || '0'
  const t = params.t || 'gems'
  const tpl = TEMPLATES[t] || TEMPLATES.gems

  const [step, setStep] = useState('landing')
  const [showExitPopup, setShowExitPopup] = useState(false)
  const [showViralPopup, setShowViralPopup] = useState(false)
  const [copied, setCopied] = useState(false)

  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState('')

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://nst-murex.vercel.app'
  const myLink = `${baseUrl}/invite/${t}?ref=${ref}`
  const shareText = `💎 Бриллианты со скидкой до 70%! Стейкинг от 50% годовых. Бесплатный старт! Присоединяйся:`
  const viberText = 'Бриллианты со скидкой до 70%! Стейкинг от 50% годовых. Бесплатный старт! Присоединяйся:'

  const shareLinks = {
    tg: `https://t.me/share/url?url=${encodeURIComponent(myLink)}&text=${encodeURIComponent(shareText)}`,
    wa: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${myLink}`)}`,
    vb: `viber://forward?text=${encodeURIComponent(`${viberText}\n${myLink}`)}`,
  }

  useEffect(() => {
    let triggered = false
    const handleMouseLeave = (e) => { if (e.clientY <= 5 && !triggered) { triggered = true; if (step === 'done') setShowViralPopup(true); else setShowExitPopup(true) } }
    const handleBack = () => { if (step === 'done') setShowViralPopup(true); else setShowExitPopup(true) }
    document.addEventListener('mouseleave', handleMouseLeave)
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handleBack)
    return () => { document.removeEventListener('mouseleave', handleMouseLeave); window.removeEventListener('popstate', handleBack) }
  }, [step])

  const handleGetGift = () => { setStep('contact'); setShowExitPopup(false) }

  const handleSubmitContact = async () => {
    const nameCheck = validateName(name)
    const contactCheck = validateContact(contact)
    if (!nameCheck.valid) { setFormError(nameCheck.hint); return }
    if (!contactCheck.valid) { setFormError(contactCheck.hint); return }
    setSending(true); setFormError('')
    try {
      const res = await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), refId: ref, template: t, source: 'invite' }) })
      const data = await res.json()
      if (!data.ok && !data.duplicate) { setFormError(data.error || 'Ошибка'); setSending(false); return }
    } catch { setFormError('Ошибка сети'); setSending(false); return }
    if (ref && ref !== '0') localStorage.setItem('dc_ref', ref)
    setStep('done'); setSending(false)
  }

  const copyLink = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(myLink)
    else { const ta = document.createElement('textarea'); ta.value = myLink; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const nameValid = validateName(name)
  const contactValid = validateContact(contact)
  const canSubmit = nameValid.valid && contactValid.valid && !sending

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0a0a20 0%, #1a1040 50%, #0a0a20 100%)' }}>
      <div className="max-w-[430px] mx-auto px-4 py-6">
        <div className="flex justify-center mb-4">
          <img src="/icons/logo.png" alt="Diamond Club" className="w-16 h-16 rounded-2xl" onError={e => { e.target.style.display='none' }} />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-white mb-1"><span className="mr-2">{tpl.emoji}</span>{tpl.title}</h1>
          <p className="text-sm text-slate-400">{tpl.sub}</p>
        </div>

        <div className="p-3 rounded-2xl mb-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-[12px] text-slate-400">Тебя пригласил участник</div>
          <div className="text-lg font-black" style={{ color: tpl.color }}>ID: {ref}</div>
        </div>

        <div className="flex justify-center gap-3 mb-2">
          <span className="text-4xl">💎</span><span className="text-4xl">🪙</span><span className="text-4xl">🏠</span>
        </div>
        <h2 className="text-center text-lg font-black text-white mb-0.5">Diamond Club</h2>
        <p className="text-center text-[12px] text-slate-500 mb-4">Бриллианты • Инвестиции • Доход</p>

        <div className="space-y-2 mb-6">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-xl mt-0.5">{f.emoji}</span>
              <div><div className="text-[13px] font-bold text-white">{f.title}</div><div className="text-[11px] text-slate-400">{f.desc}</div></div>
            </div>
          ))}
        </div>

        {/* ЭТАП 1 */}
        {step === 'landing' && (
          <button onClick={handleGetGift} className="w-full py-4 rounded-2xl text-lg font-black mb-4" style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
            🎁 Присоединиться — БЕСПЛАТНО
          </button>
        )}

        {/* ЭТАП 2: Форма контактов */}
        {step === 'contact' && (
          <div className="p-5 rounded-2xl mb-4" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.25)' }}>
            <div className="text-center mb-4">
              <div className="text-2xl mb-1">📋</div>
              <div className="text-[15px] font-black text-white">Оставьте контакт для связи</div>
              <div className="text-[11px] text-slate-400 mt-1">Мы свяжемся с вами для активации бонуса</div>
            </div>
            <div className="mb-3">
              <label className="text-[10px] text-slate-500 mb-1 block">Ваше имя *</label>
              <input value={name} onChange={e => { setName(e.target.value); setFormError('') }} placeholder="Иван Петров"
                className="w-full p-3.5 rounded-xl text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${nameValid.valid || !name ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.5)'}` }} />
              {name && !nameValid.valid && <div className="text-[9px] text-red-400 mt-1">{nameValid.hint}</div>}
            </div>
            <div className="mb-3">
              <label className="text-[10px] text-slate-500 mb-1 block">Контакт (телефон, Telegram или ник) *</label>
              <input value={contact} onChange={e => { setContact(e.target.value); setFormError('') }} placeholder="+380987654321  или  @username  или  #ник"
                className="w-full p-3.5 rounded-xl text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${contactValid.valid || !contact ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.5)'}` }} />
              {contact ? <div className={`text-[9px] mt-1 ${contactValid.valid ? 'text-emerald-400' : 'text-red-400'}`}>{contactValid.hint}</div>
                : <div className="text-[9px] text-slate-500 mt-1">📱 +380... &nbsp; 📨 @user &nbsp; 🏷 #name</div>}
            </div>
            {formError && <div className="p-2 rounded-xl text-[11px] text-red-400 text-center mb-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>❌ {formError}</div>}
            <button onClick={handleSubmitContact} disabled={!canSubmit} className="w-full py-4 rounded-2xl text-base font-black transition-all"
              style={{ background: canSubmit ? 'linear-gradient(135deg, #ffd700, #f5a623)' : 'rgba(255,255,255,0.1)', color: canSubmit ? '#000' : '#666', opacity: sending ? 0.6 : 1 }}>
              {sending ? '⏳ Отправка...' : '✅ Получить подарок'}
            </button>
            <div className="text-center text-[9px] text-slate-600 mt-2">🔒 Данные используются только для связи.</div>
          </div>
        )}

        {/* ЭТАП 3: Успех */}
        {step === 'done' && (
          <div className="space-y-3 mb-4">
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="text-center">
                <div className="text-[13px] text-emerald-400 font-bold">✅ Контакт сохранён! Реферал привязан!</div>
                <div className="text-sm font-black text-white mt-1">Спонсор ID: #{ref}</div>
                <a href="/" className="block w-full py-3 rounded-2xl text-center text-sm font-black mt-3" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>🚀 Войти в приложение</a>
                <a href={`safepalwallet://open?url=${encodeURIComponent(baseUrl)}`} className="block w-full py-3 rounded-2xl text-center text-sm font-black mt-2" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}>🔐 Открыть в SafePal</a>
                <div className="text-[9px] text-slate-500 mt-1.5">Из Telegram? Нажми «Открыть в SafePal»</div>
              </div>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(245,166,35,0.08))', border: '1px solid rgba(255,215,0,0.25)' }}>
              <div className="text-center mb-3">
                <div className="text-2xl mb-1">🔥</div>
                <div className="text-[14px] font-black text-white">Хочешь ещё больше скидку?</div>
                <div className="text-[11px] font-bold mt-1" style={{ color: '#ffd700' }}>Отправь 5 друзьям → получи от +5% до +10%!</div>
              </div>
              <div className="p-2 rounded-xl bg-black/30 text-[9px] text-white break-all mb-2 font-mono">{myLink}</div>
              <button onClick={copyLink} className="w-full py-2 rounded-xl text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 mb-3">{copied ? '✅ Скопировано!' : '📋 Копировать ссылку'}</button>
              <div className="flex gap-2">
                <a href={shareLinks.tg} target="_blank" rel="noopener noreferrer" className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6' }}>📱 Telegram</a>
                <a href={shareLinks.wa} target="_blank" rel="noopener noreferrer" className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>💬 WhatsApp</a>
                <a href={shareLinks.vb} target="_blank" rel="noopener noreferrer" className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>📞 Viber</a>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[10px] text-slate-600 mt-4">Diamond Club • Powered by GlobalWay</div>
      </div>

      {showExitPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{ background: 'linear-gradient(180deg, #1a1040, #0a0a20)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div className="text-center">
              <div className="text-4xl mb-2">⏳</div>
              <h3 className="text-xl font-black text-white mb-1">Не спеши уходить!</h3>
              <p className="text-[12px] text-slate-400 mb-4">Ты в одном шаге от вступления в клуб</p>
              <button onClick={handleGetGift} className="w-full py-3 rounded-2xl text-base font-black mb-2" style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>🎁 Присоединиться</button>
              <button onClick={() => setShowExitPopup(false)} className="text-[11px] text-slate-500">Нет, спасибо</button>
            </div>
          </div>
        </div>
      )}

      {showViralPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{ background: 'linear-gradient(180deg, #1a1040, #0a0a20)', border: '1px solid rgba(255,215,0,0.3)' }}>
            <div className="text-center">
              <div className="text-4xl mb-2">🔥</div>
              <h3 className="text-xl font-black text-white mb-1">Не уходи с пустыми руками!</h3>
              <div className="text-[13px] font-bold mb-1" style={{ color: '#ffd700' }}>+5-10% скидки за 5 друзей!</div>
              <div className="p-2.5 rounded-xl bg-black/40 text-[10px] text-white break-all mb-3 font-mono border border-white/10">{myLink}</div>
              <button onClick={copyLink} className="w-full py-2.5 rounded-xl text-[12px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 mb-3">{copied ? '✅ Скопировано!' : '📋 Копировать ссылку'}</button>
              <div className="flex gap-2 mb-4">
                <a href={shareLinks.tg} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>📱 TG</a>
                <a href={shareLinks.wa} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>💬 WA</a>
                <a href={shareLinks.vb} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-center" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>📞 VB</a>
              </div>
              <a href="/" className="block w-full py-3 rounded-2xl text-center text-sm font-black mb-2" style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>🚀 Войти в приложение</a>
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
