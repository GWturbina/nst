'use client'
/**
 * AutoRegisterModal — Модал регистрации для новых пользователей
 * Показывается СРАЗУ после подключения кошелька, если не зарегистрирован.
 * ID спонсора подтягивается из реферальной ссылки (nss_ref).
 */
import { useState } from 'react'
import useGameStore from '@/lib/store'
import { useBlockchain } from '@/lib/useBlockchain'
import * as C from '@/lib/contracts'
import { shortAddress } from '@/lib/web3'

export default function AutoRegisterModal() {
  const { wallet, pendingRefId, clearAutoRegister, addNotification, t } = useGameStore()
  const { refreshData } = useBlockchain()
  
  const [sponsorInput, setSponsorInput] = useState(pendingRefId || '')
  const [registering, setRegistering] = useState(false)
  const [step, setStep] = useState('register')
  const [errorMsg, setErrorMsg] = useState('')
  
  const hasRefFromLink = !!pendingRefId

  const handleRegister = async () => {
    const sid = parseInt(sponsorInput)
    if (!sid || sid <= 0) {
      setErrorMsg('Введите ID спонсора (число больше 0)')
      return
    }
    
    setRegistering(true)
    setErrorMsg('')
    try {
      addNotification(`⏳ Регистрация с ID #${sid}...`)
      await C.register(sid)
      
      const confirmed = await C.waitForRegistration(wallet)
      const gwStatus = await C.getGWUserStatus(wallet).catch(() => null)
      
      if (gwStatus) {
        useGameStore.getState().updateRegistration(gwStatus.isRegistered, gwStatus.odixId || sid)
        if (gwStatus.maxPackage > 0) useGameStore.getState().setLevel(gwStatus.maxPackage)
      } else {
        useGameStore.getState().updateRegistration(true, sid)
      }
      
      addNotification('✅ Регистрация прошла успешно!')
      setStep('success')
      setTimeout(() => refreshData(), 500)
      
    } catch (err) {
      const msg = err?.reason || err?.shortMessage || err?.message || 'Ошибка'
      if (msg.includes('Already registered')) {
        addNotification('ℹ️ Вы уже зарегистрированы!')
        useGameStore.getState().updateRegistration(true, sid)
        setStep('success')
        setTimeout(() => refreshData(), 500)
      } else if (msg.includes('Sponsor not found') || msg.includes('Invalid sponsor')) {
        setErrorMsg(`Спонсор #${sid} не найден. Проверьте ID.`)
      } else if (msg.includes('user rejected')) {
        setErrorMsg('Транзакция отклонена. Попробуйте ещё раз.')
      } else if (msg.includes('insufficient funds')) {
        setErrorMsg('Недостаточно BNB для газа. Пополните кошелёк.')
      } else {
        setErrorMsg(msg.slice(0, 120))
      }
    }
    setRegistering(false)
  }

  const handleSkip = () => {
    clearAutoRegister()
  }

  if (step === 'success') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.9)' }}>
        <div className="max-w-[400px] w-full p-6 rounded-3xl text-center"
          style={{ background: 'linear-gradient(180deg, #0d2818 0%, #0a0a20 100%)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div className="text-5xl mb-3">✅</div>
          <h3 className="text-xl font-black text-white mb-2">Добро пожаловать!</h3>
          <p className="text-[13px] text-emerald-400 font-bold mb-1">Регистрация прошла успешно</p>
          <p className="text-[11px] text-slate-400 mb-4">
            Ваши CHT токены теперь сохраняются навсегда. Тапайте, копите метры, стройте дом!
          </p>
          <button onClick={handleSkip}
            className="w-full py-3.5 rounded-2xl text-[14px] font-black"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
            🚀 Начать!
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.9)' }}>
      <div className="max-w-[420px] w-full rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1a1040 0%, #0c0c1e 100%)', border: '1px solid rgba(255,215,0,0.2)' }}>
        
        <div className="px-5 pt-5 pb-3 text-center">
          <div className="text-4xl mb-2">🏠</div>
          <h3 className="text-xl font-black text-white mb-1">Регистрация в Метр²</h3>
          <p className="text-[12px] text-slate-400">
            Регистрация привязывает кошелёк к экосистеме GlobalWay.
            CHT токены перестанут испаряться, откроется доступ к бизнесу и клубным домам.
          </p>
        </div>

        <div className="mx-5 p-2.5 rounded-xl mb-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-bold">Кошелёк подключён</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">{wallet ? shortAddress(wallet) : ''}</div>
        </div>

        <div className="px-5 mb-3">
          <label className="text-[11px] text-slate-400 mb-1.5 block">
            {hasRefFromLink ? '✅ Спонсор определён из ссылки:' : 'ID того, кто тебя пригласил:'}
          </label>
          
          {hasRefFromLink ? (
            <div className="p-3.5 rounded-xl text-center" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)' }}>
              <div className="text-2xl font-black" style={{ color: '#ffd700' }}>ID: #{pendingRefId}</div>
              <div className="text-[9px] text-slate-500 mt-1">Привязан из реферальной ссылки</div>
            </div>
          ) : (
            <div>
              <input value={sponsorInput}
                onChange={e => { setSponsorInput(e.target.value.replace(/\D/g, '')); setErrorMsg('') }}
                placeholder="Например: 12345" inputMode="numeric"
                className="w-full p-3.5 rounded-xl text-center text-lg font-bold outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }} />
              <div className="text-[9px] text-slate-500 mt-1.5 text-center">
                💡 Спроси у того, кто дал тебе ссылку.
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mx-5 mb-3 p-2.5 rounded-xl text-[11px] text-red-400 font-bold text-center"
            style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)' }}>
            ❌ {errorMsg}
          </div>
        )}

        <div className="mx-5 mb-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-[10px] text-slate-500 mb-1.5">Что даёт регистрация:</div>
          <div className="space-y-1">
            {[
              ['⛏', 'CHT токены сохраняются навсегда'],
              ['📐', 'Покупка метров² и клубных домов'],
              ['🏠', 'Свой дом под 0% годовых'],
              ['👥', '9 уровней партнёрской программы'],
            ].map(([icon, text], i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span>{icon}</span>
                <span className="text-slate-300">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5 space-y-2">
          <button onClick={handleRegister}
            disabled={registering || (!sponsorInput || parseInt(sponsorInput) <= 0)}
            className="w-full py-4 rounded-2xl text-[15px] font-black transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
            {registering ? '⏳ Регистрация...' : '✅ Зарегистрироваться'}
          </button>

          <button onClick={handleSkip}
            className="w-full py-2.5 text-[11px] text-slate-500 text-center">
            Пропустить (CHT будут испаряться через 30 мин)
          </button>
        </div>
      </div>
    </div>
  )
}
