'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'

const TEMPLATES = {
  house: { emoji: '🏠', title: 'Свой дом под 0%!', sub: 'Заработай 35% — клуб добавит 65%.', color: '#f59e0b', ogImage: 'invite-house.jpg' },
  build: { emoji: '🏗', title: 'Строй дом — зарабатывай!', sub: 'Бесплатный старт. Тапай и копи на метры.', color: '#a855f7', ogImage: 'invite-build.jpg' },
  money: { emoji: '💰', title: '15 источников дохода!', sub: 'Недвижимость, инвестиции, AI — всё в одном.', color: '#10b981', ogImage: 'invite-money.jpg' },
}

const FEATURES = [
  { emoji: '⛏', title: 'Бесплатный старт', desc: 'Тапай руками — зарабатывай CHT токены' },
  { emoji: '📐', title: 'Метры квадратные', desc: 'Покупай м² от $50 — копи на свой дом' },
  { emoji: '🏔', title: '3 бизнеса', desc: 'От $50. Деньги работают в клубной системе' },
  { emoji: '🏠', title: 'Свой дом под 0%', desc: 'Заработай 35% — клуб добавит 65%!' },
  { emoji: '🏗', title: 'Клубные дома', desc: 'Совместное строительство — экономия до 40%' },
  { emoji: '👥', title: 'Партнёрская программа', desc: 'От 10% пожизненно от приглашённых' },
]

// API для захвата контактов (CardGift)
const CAPTURE_API = process.env.NEXT_PUBLIC_CARDGIFT_API || 'https://cgm-brown.vercel.app/api/viral-registration'

function InviteContent() {
  const searchParams = useSearchParams()
  const params = useParams()
  const rawRef = searchParams.get('ref') || '0'
  const ref = /^\d+$/.test(rawRef) ? rawRef : '0'
  const t = params.t || 'house'
  const tpl = TEMPLATES[t] || TEMPLATES.house

  const [registered, setRegistered] = useState(false)
  const [showCaptureModal, setShowCaptureModal] = useState(false)
  const [captureStep, setCaptureStep] = useState(1)
  const [showExitPopup, setShowExitPopup] = useState(false)
  const [showViralPopup, setShowViralPopup] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tempId, setTempId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const BOT_USERNAME = 'MeterKvadratnyBot'

  useEffect(() => {
    const saved = localStorage.getItem('mk_capture_id')
    if (saved) { setTempId(saved); setRegistered(true) }
  }, [])

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://nss-azure.vercel.app'

  const shareRef = tempId || ref
  const myLink = `${baseUrl}/invite/${t}?ref=${shareRef}`
  const shareText = '🏠 Свой дом под 0% годовых! Тапай — копи метры — строй дом. Бесплатный старт! Присоединяйся:'
  const viberText = 'Свой дом под 0% годовых! Тапай, копи метры, строй дом. Бесплатный старт! Присоединяйся:'

  const shareLinks = {
    tg: `https://t.me/share/url?url=${encodeURIComponent(myLink)}&text=${encodeURIComponent(shareText)}`,
    wa: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${myLink}`)}`,
    vb: `viber://forward?text=${encodeURIComponent(`${viberText}\n${myLink}`)}`,
  }

  const copyLink = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(myLink)
    else { const ta = document.createElement('textarea'); ta.value = myLink; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ═══ EXIT / BACK — перехват ═══
  useEffect(() => {
    let triggered = false
    const handleMouseLeave = (e) => {
      if (e.clientY <= 5 && !triggered) {
        triggered = true
        if (registered) setShowViralPopup(true)
        else setShowExitPopup(true)
      }
    }
    document.addEventListener('mouseleave', handleMouseLeave)

    const handleBack = () => {
      if (registered) setShowViralPopup(true)
      else setShowExitPopup(true)
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handleBack)

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('popstate', handleBack)
    }
  }, [registered])

  // ═══ КНОПКА «ПРИСОЕДИНИТЬСЯ» → модалка захвата ═══
  const handleJoin = () => {
    if (ref && ref !== '0') localStorage.setItem('nss_ref', ref)
    setShowExitPopup(false)
    setCaptureStep(1)
    setShowCaptureModal(true)
  }

  // ═══ ОТПРАВКА КОНТАКТА → CardGift API ═══
  const submitCapture = async () => {
    const name = document.getElementById('capName')?.value?.trim() || 'Гость'
    const messenger = document.getElementById('capMessenger')?.value || 'telegram'
    const contact = document.getElementById('capContact')?.value?.trim()
    const pushConsent = document.getElementById('capPush')?.checked || false

    if (!contact) {
      document.getElementById('capContact').style.borderColor = '#ff4444'
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(CAPTURE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrerId: ref,
          name,
          messenger,
          contact,
          pushConsent,
          cardId: 'mk_invite_' + t,
        })
      })
      const data = await res.json()
      if (data.tempId) {
        setTempId(data.tempId)
        localStorage.setItem('mk_capture_id', data.tempId)
      }
    } catch (e) {
      console.error('Capture error:', e)
      const localId = 'MK_TEMP_' + Date.now()
      setTempId(localId)
      localStorage.setItem('mk_capture_id', localId)
    }
    setSubmitting(false)
    setCaptureStep(2)
  }

  const finishCapture = () => {
    setShowCaptureModal(false)
    setCaptureStep(1)
    setRegistered(true)
  }

  const skipCapture = () => {
    setShowCaptureModal(false)
    setRegistered(true)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0a0a20 0%, #1a1040 50%, #0a0a20 100%)' }}>
      <div className="max-w-[430px] mx-auto px-4 py-6">
        <div className="flex justify-center mb-4">
          <img src="/icons/logo.png" alt="Club House" className="w-16 h-16 rounded-2xl" onError={e => { e.target.style.display='none' }} />
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
          <span className="text-4xl">📐</span>
          <span className="text-4xl">🏗</span>
          <span className="text-4xl">🏠</span>
        </div>
        <h2 className="text-center text-lg font-black text-white mb-0.5">Метр Квадратный — Club House</h2>
        <p className="text-center text-[12px] text-slate-500 mb-4">Тапай • Копи метры • Строй дом</p>

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
          <button onClick={handleJoin} className="w-full py-4 rounded-2xl text-lg font-black mb-4" style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
            🎁 Присоединиться — БЕСПЛАТНО
          </button>
        ) : (
          <div className="space-y-3 mb-4">
            {/* Реферал сохранён */}
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="text-center">
                <div className="text-[13px] text-emerald-400 font-bold">✅ Реферал сохранён!</div>
                <div className="text-sm font-black text-white mt-1">Спонсор ID: #{ref}</div>
                <a href="/" className="block w-full py-3 rounded-2xl text-center text-sm font-black mt-3" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
                  🚀 Войти в приложение
                </a>
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

            {/* ═══ ВИРУСНЫЙ БЛОК ═══ */}
            <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(245,166,35,0.08))', border: '1px solid rgba(255,215,0,0.25)' }}>
              <div className="text-center mb-3">
                <div className="text-2xl mb-1">🔥</div>
                <div className="text-[14px] font-black text-white">Хочешь бонус к скидке?</div>
                <div className="text-[11px] font-bold mt-1" style={{ color: '#ffd700' }}>Отправь 5 друзьям → получи от +5% до +10%!</div>
                <div className="text-[10px] text-slate-400 mt-1">Итого до <b className="text-white">40% экономии</b> на клубных домах!</div>
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

              <div className="mt-3 p-2.5 rounded-xl text-[10px] text-slate-400 leading-relaxed" style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.1)' }}>
                💡 <b className="text-white">Как получить бонус:</b><br/>
                1. Скопируй ссылку выше<br/>
                2. Отправь минимум 5 друзьям<br/>
                3. Свяжись со своим спонсором (ID: #{ref})<br/>
                4. Получи персональный бонус +5-10%!
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[10px] text-slate-600 mt-4">
          Метр Квадратный — Club House • Powered by GlobalWay
        </div>
      </div>

      {/* ═══ МОДАЛКА ЗАХВАТА КОНТАКТА ═══ */}
      {showCaptureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{ background: 'linear-gradient(180deg, #1a1040, #0a0a20)', border: '1px solid rgba(245,166,35,0.3)' }}>

            {captureStep === 1 && (<>
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">📩</div>
                <h3 className="text-lg font-black text-white mb-1">Получить инструкции</h3>
                <p className="text-[12px] text-slate-400 leading-relaxed">
                  Укажите контакт — куда прислать подробную информацию о том, как получить свой дом и начать зарабатывать
                </p>
              </div>

              <input type="text" id="capName" placeholder="Имя (необязательно)"
                className="w-full py-3 px-4 rounded-xl mb-3 text-[14px] text-white outline-none"
                style={{ background: '#2a2a4a', border: '1px solid #444' }} />

              <select id="capMessenger"
                className="w-full py-3 px-4 rounded-xl mb-3 text-[14px] text-white outline-none"
                style={{ background: '#2a2a4a', border: '1px solid #444' }}>
                <option value="telegram">📱 Telegram</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="viber">📞 Viber</option>
                <option value="phone">📞 Телефон</option>
                <option value="email">📧 Email</option>
              </select>

              <input type="text" id="capContact" placeholder="@username или +номер"
                className="w-full py-3 px-4 rounded-xl mb-3 text-[14px] text-white outline-none"
                style={{ background: '#2a2a4a', border: '1px solid #444' }} />

              <label className="flex items-start gap-2.5 p-3 rounded-xl mb-4 cursor-pointer" style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.15)' }}>
                <input type="checkbox" id="capPush" defaultChecked className="mt-0.5 w-4 h-4 flex-shrink-0" />
                <span className="text-[11px] text-slate-400 leading-relaxed">
                  Согласен получать уведомления о скидках и новостях Метр Квадратный
                </span>
              </label>

              <button onClick={submitCapture} disabled={submitting}
                className="w-full py-3.5 rounded-2xl text-[15px] font-black mb-2"
                style={{ background: submitting ? '#555' : 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', border: 'none', cursor: submitting ? 'wait' : 'pointer' }}>
                {submitting ? '⏳ Сохраняю...' : '✅ Отправить и продолжить'}
              </button>

              <button onClick={skipCapture} className="w-full text-[12px] text-slate-500 py-2"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                Пропустить →
              </button>
            </>)}

            {captureStep === 2 && (<>
              <div className="text-center mb-4">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="text-lg font-black text-white mb-1">Контакт сохранён!</h3>
                <p className="text-[12px] text-slate-400 leading-relaxed">
                  Скоро вы получите информацию о Метр Квадратный
                </p>
              </div>

              <div className="p-4 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, rgba(245,166,35,0.12), rgba(217,119,6,0.08))', border: '1px solid rgba(245,166,35,0.3)' }}>
                <div className="text-center mb-3">
                  <div className="text-2xl mb-1">🎁</div>
                  <div className="text-[14px] font-black text-white">Получите бонус в Telegram!</div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Запустите бот — получите автоматические инструкции, калькулятор м² и персональные уведомления о клубных домах
                  </p>
                </div>

                <a href={`https://t.me/${BOT_USERNAME}?start=ref_${tempId || ref}`}
                  target="_blank" rel="noopener noreferrer"
                  className="block w-full py-3.5 rounded-2xl text-center text-[15px] font-black mb-2"
                  style={{ background: 'linear-gradient(135deg, #0088cc, #0066aa)', color: '#fff', textDecoration: 'none' }}>
                  🤖 Запустить бот Метр Квадратный
                </a>

                <div className="text-center text-[10px] text-slate-500">
                  Нажмите Start в Telegram — бот пришлёт инструкции
                </div>
              </div>

              <button onClick={finishCapture}
                className="w-full py-3 rounded-2xl text-[14px] font-black"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                🚀 Продолжить
              </button>

              <button onClick={finishCapture}
                className="w-full text-[12px] text-slate-500 py-2 mt-1"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                Пропустить →
              </button>
            </>)}

          </div>
        </div>
      )}

      {/* ═══ EXIT POPUP ═══ */}
      {showExitPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{ background: 'linear-gradient(180deg, #1a1040, #0a0a20)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div className="text-center">
              <div className="text-4xl mb-2">⏳</div>
              <h3 className="text-xl font-black text-white mb-1">Не спеши уходить!</h3>
              <p className="text-[12px] text-slate-400 mb-4">Ты в одном шаге от вступления в клуб</p>
              <div className="space-y-2 mb-4 text-left">
                <div className="flex items-center gap-2 text-[12px]"><span className="text-emerald-400">✓</span><span className="text-slate-300">Бесплатная регистрация</span></div>
                <div className="flex items-center gap-2 text-[12px]"><span className="text-emerald-400">✓</span><span className="text-slate-300">Свой дом под 0% годовых</span></div>
                <div className="flex items-center gap-2 text-[12px]"><span className="text-emerald-400">✓</span><span className="text-slate-300">3 бизнеса от $50</span></div>
                <div className="flex items-center gap-2 text-[12px]"><span className="text-emerald-400">✓</span><span className="text-slate-300">CHT токены — тапай бесплатно</span></div>
              </div>
              <button onClick={handleJoin} className="w-full py-3 rounded-2xl text-base font-black mb-2" style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
                🎁 Присоединиться
              </button>
              <button onClick={() => setShowExitPopup(false)} className="text-[11px] text-slate-500 hover:text-slate-400"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                Нет, спасибо
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ VIRAL POPUP (при уходе после регистрации) ═══ */}
      {showViralPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{ background: 'linear-gradient(180deg, #1a1040, #0a0a20)', border: '1px solid rgba(255,215,0,0.3)' }}>
            <div className="text-center">
              <div className="text-4xl mb-2">🔥</div>
              <h3 className="text-xl font-black text-white mb-1">Не уходи с пустыми руками!</h3>
              <div className="text-[13px] font-bold mb-1" style={{ color: '#ffd700' }}>Получи дополнительные 5-10% бонуса!</div>
              <p className="text-[11px] text-slate-400 mb-4">
                Отправь эту ссылку <b className="text-white">5 друзьям</b> → свяжись с приглашающим → получи <b style={{ color: '#ffd700' }}>до 40% экономии</b>!
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

              <a href="/" className="block w-full py-3 rounded-2xl text-center text-sm font-black mb-2" style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
                🚀 Войти в приложение
              </a>
              <button onClick={() => setShowViralPopup(false)} className="text-[11px] text-slate-500"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Закрыть</button>
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
