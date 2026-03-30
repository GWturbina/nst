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

const CAPTURE_API = process.env.NEXT_PUBLIC_CARDGIFT_API || 'https://cgm-brown.vercel.app/api/viral-registration'

const PLACEHOLDERS = {
  telegram: '@username (латиница, мин. 5 символов)',
  whatsapp: '+380501234567 (международный формат)',
  viber: '+380501234567 (международный формат)',
  phone: '+380501234567 (международный формат)',
  email: 'name@example.com',
}

function validateContact(messenger, contact) {
  if (!contact || contact.trim().length < 2) return { valid: false, error: 'Контакт слишком короткий', normalized: contact }
  switch (messenger) {
    case 'phone': case 'whatsapp': case 'viber': {
      const clean = contact.replace(/[\s\-\(\)]/g, ''); if (!clean.startsWith('+')) return { valid: false, error: 'Номер должен начинаться с +', normalized: contact }
      const digits = clean.replace(/\D/g, ''); if (digits.length < 10 || digits.length > 15) return { valid: false, error: 'Неверный формат (10-15 цифр)', normalized: contact }
      return { valid: true, error: '', normalized: '+' + digits }
    }
    case 'email': return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? { valid: false, error: 'Неверный email', normalized: contact } : { valid: true, error: '', normalized: contact.toLowerCase() }
    case 'telegram': {
      let tg = contact.startsWith('@') ? contact : '@' + contact
      if (tg.length < 6) return { valid: false, error: 'Мин. 5 символов после @', normalized: contact }
      if (!/^@[a-zA-Z0-9_]+$/.test(tg)) return { valid: false, error: 'Только буквы, цифры и _', normalized: contact }
      return { valid: true, error: '', normalized: tg.toLowerCase() }
    }
    default: return { valid: true, error: '', normalized: contact.trim() }
  }
}

function InviteContent() {
  const searchParams = useSearchParams(); const params = useParams()
  const rawRef = searchParams.get('ref') || '0'; const ref = /^\d+$/.test(rawRef) ? rawRef : '0'
  const t = params.t || 'gems'; const tpl = TEMPLATES[t] || TEMPLATES.gems

  const [registered, setRegistered] = useState(false)
  const [showCaptureModal, setShowCaptureModal] = useState(false)
  const [captureStep, setCaptureStep] = useState(1)
  const [showExitPopup, setShowExitPopup] = useState(false)
  const [showViralPopup, setShowViralPopup] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tempId, setTempId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [contactError, setContactError] = useState('')
  const BOT_USERNAME = 'DiamondClubNSSBot'

  useEffect(() => { const s = localStorage.getItem('dc_capture_id'); if (s) { setTempId(s); setRegistered(true) } }, [])

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://nst-murex.vercel.app'
  const shareRef = tempId || ref; const myLink = `${baseUrl}/invite/${t}?ref=${shareRef}`
  const shareText = '💎 Бриллианты со скидкой до 70%! Стейкинг от 50% годовых. Присоединяйся:'
  const shareLinks = {
    tg: `https://t.me/share/url?url=${encodeURIComponent(myLink)}&text=${encodeURIComponent(shareText)}`,
    wa: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${myLink}`)}`,
    vb: `viber://forward?text=${encodeURIComponent(`Brillianty so skidkoy do 70%! Diamond Club!\n${myLink}`)}`,
  }
  const copyLink = () => { if(navigator.clipboard)navigator.clipboard.writeText(myLink);else{const ta=document.createElement('textarea');ta.value=myLink;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta)};setCopied(true);setTimeout(()=>setCopied(false),2000) }

  useEffect(() => {
    let triggered = false
    const ml = (e) => { if(e.clientY<=5&&!triggered){triggered=true;if(registered)setShowViralPopup(true);else setShowExitPopup(true)} }
    const hb = () => { if(registered)setShowViralPopup(true);else setShowExitPopup(true) }
    document.addEventListener('mouseleave',ml); window.history.pushState(null,'',window.location.href); window.addEventListener('popstate',hb)
    return () => { document.removeEventListener('mouseleave',ml); window.removeEventListener('popstate',hb) }
  }, [registered])

  const handleJoin = () => { if(ref&&ref!=='0')localStorage.setItem('dc_ref',ref); setShowExitPopup(false); setCaptureStep(1); setShowCaptureModal(true) }

  const submitCapture = async () => {
    const name = document.getElementById('capName')?.value?.trim()||''; const messenger = document.getElementById('capMessenger')?.value||'telegram'
    const rawContact = document.getElementById('capContact')?.value?.trim(); const pushConsent = document.getElementById('capPush')?.checked||false
    const v = validateContact(messenger, rawContact); if(!v.valid){setContactError(v.error);document.getElementById('capContact').style.borderColor='#ff4444';return}
    setContactError(''); document.getElementById('capContact').style.borderColor='#444'; setSubmitting(true)
    try {
      const res = await fetch(CAPTURE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({referrerId:ref,name:name||'Гость',messenger,contact:v.normalized,pushConsent,cardId:'dc_invite_'+t})})
      const data = await res.json(); if(data.tempId){setTempId(data.tempId);localStorage.setItem('dc_capture_id',data.tempId)}
    } catch(e) { console.error('Capture:',e); const lid='DC_TEMP_'+Date.now(); setTempId(lid); localStorage.setItem('dc_capture_id',lid) }
    setSubmitting(false); setCaptureStep(2)
  }
  const finishCapture = () => { setShowCaptureModal(false); setCaptureStep(1); setRegistered(true) }
  const skipCapture = () => { setShowCaptureModal(false); setRegistered(true) }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0a0a20 0%, #1a1040 50%, #0a0a20 100%)' }}>
      <div className="max-w-[430px] mx-auto px-4 py-6">
        <div className="flex justify-center mb-4"><img src="/icons/logo.png" alt="DC" className="w-16 h-16 rounded-2xl" onError={e=>{e.target.style.display='none'}} /></div>
        <div className="text-center mb-6"><h1 className="text-2xl font-black text-white mb-1"><span className="mr-2">{tpl.emoji}</span>{tpl.title}</h1><p className="text-sm text-slate-400">{tpl.sub}</p></div>
        <div className="p-3 rounded-2xl mb-4 text-center" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)'}}><div className="text-[12px] text-slate-400">Тебя пригласил участник</div><div className="text-lg font-black" style={{color:tpl.color}}>ID: {ref}</div></div>
        <div className="flex justify-center gap-3 mb-2"><span className="text-4xl">💎</span><span className="text-4xl">🪙</span><span className="text-4xl">🏠</span></div>
        <h2 className="text-center text-lg font-black text-white mb-0.5">Diamond Club</h2>
        <p className="text-center text-[12px] text-slate-500 mb-4">Бриллианты • Инвестиции • Доход</p>
        <div className="space-y-2 mb-6">{FEATURES.map((f,i)=>(<div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}><span className="text-xl mt-0.5">{f.emoji}</span><div><div className="text-[13px] font-bold text-white">{f.title}</div><div className="text-[11px] text-slate-400">{f.desc}</div></div></div>))}</div>

        {!registered ? (
          <button onClick={handleJoin} className="w-full py-4 rounded-2xl text-lg font-black mb-4" style={{background:'linear-gradient(135deg, #ffd700, #f5a623)',color:'#000'}}>🎁 Присоединиться — БЕСПЛАТНО</button>
        ) : (
          <div className="space-y-3 mb-4">
            <div className="p-4 rounded-2xl" style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)'}}>
              <div className="text-center">
                <div className="text-[13px] text-emerald-400 font-bold">✅ Реферал сохранён!</div><div className="text-sm font-black text-white mt-1">Спонсор ID: #{ref}</div>
                <a href="/" className="block w-full py-3 rounded-2xl text-center text-sm font-black mt-3" style={{background:'linear-gradient(135deg, #10b981, #059669)',color:'#fff'}}>🚀 Войти в приложение</a>
                <a href={`safepalwallet://open?url=${encodeURIComponent(baseUrl)}`} className="block w-full py-3 rounded-2xl text-center text-sm font-black mt-2" style={{background:'linear-gradient(135deg, #3b82f6, #2563eb)',color:'#fff'}}>🔐 Открыть в SafePal</a>
                <div className="text-[9px] text-slate-500 mt-1.5">Из Telegram? Нажми «Открыть в SafePal»</div>
              </div>
            </div>
            <div className="p-4 rounded-2xl" style={{background:'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(245,166,35,0.08))',border:'1px solid rgba(255,215,0,0.25)'}}>
              <div className="text-center mb-3"><div className="text-2xl mb-1">🔥</div><div className="text-[14px] font-black text-white">Хочешь ещё больше скидку?</div><div className="text-[11px] font-bold mt-1" style={{color:'#ffd700'}}>Отправь 5 друзьям → получи от +5% до +10%!</div></div>
              <div className="p-2 rounded-xl bg-black/30 text-[9px] text-white break-all mb-2 font-mono">{myLink}</div>
              <button onClick={copyLink} className="w-full py-2 rounded-xl text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 mb-3">{copied?'✅ Скопировано!':'📋 Копировать ссылку'}</button>
              <div className="flex gap-2">
                <a href={shareLinks.tg} target="_blank" rel="noopener noreferrer" className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center" style={{background:'rgba(59,130,246,0.15)',border:'1px solid rgba(59,130,246,0.3)',color:'#3b82f6'}}>📱 Telegram</a>
                <a href={shareLinks.wa} target="_blank" rel="noopener noreferrer" className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center" style={{background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.3)',color:'#22c55e'}}>💬 WhatsApp</a>
                <a href={shareLinks.vb} target="_blank" rel="noopener noreferrer" className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center" style={{background:'rgba(168,85,247,0.15)',border:'1px solid rgba(168,85,247,0.3)',color:'#a855f7'}}>📞 Viber</a>
              </div>
            </div>
          </div>
        )}
        <div className="text-center text-[10px] text-slate-600 mt-4">Diamond Club • Powered by GlobalWay</div>
      </div>

      {showCaptureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.9)'}}>
          <div className="max-w-[380px] w-full p-5 rounded-3xl" style={{background:'linear-gradient(180deg, #1a1040, #0a0a20)',border:'1px solid rgba(168,85,247,0.3)'}}>
            {captureStep===1&&(<>
              <div className="text-center mb-4"><div className="text-3xl mb-2">📩</div><h3 className="text-lg font-black text-white mb-1">Получить инструкции</h3><p className="text-[12px] text-slate-400">Укажите контакт — пришлём информацию о Diamond Club</p></div>
              <input type="text" id="capName" placeholder="Имя (необязательно)" className="w-full py-3 px-4 rounded-xl mb-3 text-[14px] text-white outline-none" style={{background:'#2a2a4a',border:'1px solid #444'}} />
              <select id="capMessenger" onChange={()=>{const m=document.getElementById('capMessenger')?.value||'telegram';const inp=document.getElementById('capContact');if(inp){inp.placeholder=PLACEHOLDERS[m]||'';inp.style.borderColor='#444'};setContactError('')}}
                className="w-full py-3 px-4 rounded-xl mb-3 text-[14px] text-white outline-none" style={{background:'#2a2a4a',border:'1px solid #444'}}>
                <option value="telegram">📱 Telegram</option><option value="whatsapp">💬 WhatsApp</option><option value="viber">📞 Viber</option><option value="phone">📞 Телефон</option><option value="email">📧 Email</option>
              </select>
              <input type="text" id="capContact" placeholder="@username (латиница, мин. 5 символов)" onFocus={()=>{document.getElementById('capContact').style.borderColor='#a855f7';setContactError('')}}
                className="w-full py-3 px-4 rounded-xl text-[14px] text-white outline-none" style={{background:'#2a2a4a',border:'1px solid #444'}} />
              {contactError?<div className="text-[11px] text-red-400 mt-1 mb-2 px-1">⚠️ {contactError}</div>:<div className="h-2 mb-1"></div>}
              <label className="flex items-start gap-2.5 p-3 rounded-xl mb-4 cursor-pointer" style={{background:'rgba(168,85,247,0.08)',border:'1px solid rgba(168,85,247,0.15)'}}>
                <input type="checkbox" id="capPush" defaultChecked className="mt-0.5 w-4 h-4 flex-shrink-0" /><span className="text-[11px] text-slate-400">Согласен получать уведомления Diamond Club</span>
              </label>
              <button onClick={submitCapture} disabled={submitting} className="w-full py-3.5 rounded-2xl text-[15px] font-black mb-2" style={{background:submitting?'#555':'linear-gradient(135deg, #a855f7, #7c3aed)',color:'#fff',border:'none'}}>{submitting?'⏳ Сохраняю...':'✅ Отправить и продолжить'}</button>
              <button onClick={skipCapture} className="w-full text-[12px] text-slate-500 py-2" style={{background:'none',border:'none',cursor:'pointer'}}>Пропустить →</button>
            </>)}
            {captureStep===2&&(<>
              <div className="text-center mb-4"><div className="text-4xl mb-3">🎉</div><h3 className="text-lg font-black text-white mb-1">Контакт сохранён!</h3><p className="text-[12px] text-slate-400">Скоро вы получите информацию о Diamond Club</p></div>
              <div className="p-4 rounded-2xl mb-4" style={{background:'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(124,58,237,0.08))',border:'1px solid rgba(168,85,247,0.3)'}}>
                <div className="text-center mb-3"><div className="text-2xl mb-1">🎁</div><div className="text-[14px] font-black text-white">Получите бонус в Telegram!</div><p className="text-[11px] text-slate-400 mt-1">Запустите бот — получите инструкции и персональные уведомления</p></div>
                <a href={`https://t.me/DiamondClubNSSBot?start=ref_${tempId||ref}`} target="_blank" rel="noopener noreferrer" className="block w-full py-3.5 rounded-2xl text-center text-[15px] font-black mb-2" style={{background:'linear-gradient(135deg, #0088cc, #0066aa)',color:'#fff',textDecoration:'none'}}>🤖 Запустить бот Diamond Club</a>
                <div className="text-center text-[10px] text-slate-500">Нажмите Start в Telegram</div>
              </div>
              <button onClick={finishCapture} className="w-full py-3 rounded-2xl text-[14px] font-black" style={{background:'linear-gradient(135deg, #10b981, #059669)',color:'#fff',border:'none'}}>🚀 Продолжить</button>
              <button onClick={finishCapture} className="w-full text-[12px] text-slate-500 py-2 mt-1" style={{background:'none',border:'none',cursor:'pointer'}}>Пропустить →</button>
            </>)}
          </div>
        </div>
      )}

      {showExitPopup&&(<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.85)'}}><div className="max-w-[380px] w-full p-5 rounded-3xl" style={{background:'linear-gradient(180deg, #1a1040, #0a0a20)',border:'1px solid rgba(255,215,0,0.2)'}}><div className="text-center"><div className="text-4xl mb-2">⏳</div><h3 className="text-xl font-black text-white mb-1">Не спеши уходить!</h3><p className="text-[12px] text-slate-400 mb-4">Ты в одном шаге от вступления в клуб</p><button onClick={handleJoin} className="w-full py-3 rounded-2xl text-base font-black mb-2" style={{background:'linear-gradient(135deg, #ffd700, #f5a623)',color:'#000'}}>🎁 Присоединиться</button><button onClick={()=>setShowExitPopup(false)} className="text-[11px] text-slate-500" style={{background:'none',border:'none',cursor:'pointer'}}>Нет, спасибо</button></div></div></div>)}

      {showViralPopup&&(<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.9)'}}><div className="max-w-[380px] w-full p-5 rounded-3xl" style={{background:'linear-gradient(180deg, #1a1040, #0a0a20)',border:'1px solid rgba(255,215,0,0.3)'}}><div className="text-center"><div className="text-4xl mb-2">🔥</div><h3 className="text-xl font-black text-white mb-1">Не уходи с пустыми руками!</h3><div className="text-[13px] font-bold mb-1" style={{color:'#ffd700'}}>+5-10% скидки за 5 друзей!</div><div className="p-2.5 rounded-xl bg-black/40 text-[10px] text-white break-all mb-3 font-mono border border-white/10">{myLink}</div><button onClick={copyLink} className="w-full py-2.5 rounded-xl text-[12px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 mb-3">{copied?'✅':'📋 Копировать'}</button><div className="flex gap-2 mb-4"><a href={shareLinks.tg} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-center" style={{background:'rgba(59,130,246,0.15)',color:'#3b82f6'}}>📱 TG</a><a href={shareLinks.wa} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-center" style={{background:'rgba(34,197,94,0.15)',color:'#22c55e'}}>💬 WA</a><a href={shareLinks.vb} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-center" style={{background:'rgba(168,85,247,0.15)',color:'#a855f7'}}>📞 VB</a></div><a href="/" className="block w-full py-3 rounded-2xl text-center text-sm font-black mb-2" style={{background:'linear-gradient(135deg, #ffd700, #f5a623)',color:'#000'}}>🚀 Войти</a><button onClick={()=>setShowViralPopup(false)} className="text-[11px] text-slate-500" style={{background:'none',border:'none',cursor:'pointer'}}>Закрыть</button></div></div></div>)}
    </div>
  )
}

export default function InvitePage() {
  return (<Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{background:'#0a0a20'}}><div className="text-white">Loading...</div></div>}><InviteContent /></Suspense>)
}
