'use client'
/**
 * AutoRegisterModal — Модал регистрации для новых пользователей
 *
 * Показывается СРАЗУ после подключения кошелька, если адрес не зарегистрирован.
 * ID спонсора подтягивается из реферальной ссылки (dc_ref) и ЗАБЛОКИРОВАН.
 * Подпись кошелька запрашивается ПОСЛЕ регистрации, не до.
 *
 * Шаги:
 *   register → форма ввода спонсора и регистрация в смарт-контракте
 *   telegram → активация Telegram-бота @DiamondClubGWSBot после успеха
 *   (ошибки отображаются через errorMsg прямо в форме register)
 */
import { useState } from 'react'
import useGameStore from '@/lib/store'
import { useBlockchain } from '@/lib/useBlockchain'
import * as C from '@/lib/contracts'
import { shortAddress } from '@/lib/web3'
import { LEVELS } from '@/lib/gameData'

const BOT_USERNAME = 'DiamondClubGWSBot'

export default function AutoRegisterModal() {
  const { wallet, pendingRefId, clearAutoRegister, addNotification, t } = useGameStore()
  const { afterRegistration } = useBlockchain()

  const [sponsorInput, setSponsorInput] = useState(pendingRefId || '')
  const [registering, setRegistering] = useState(false)
  const [step, setStep] = useState('register') // register | telegram
  const [errorMsg, setErrorMsg] = useState('')
  const [botClicked, setBotClicked] = useState(false)

  const hasRefFromLink = !!pendingRefId
  const bnbPrice = useGameStore(s => s.bnbPrice)
  const bnb = useGameStore(s => s.bnb)

  // ★ Deep link в бот — бот при /start свяжет учётки по ID спонсора
  const botLink = `https://t.me/${BOT_USERNAME}?start=${pendingRefId || sponsorInput || '0'}`

  const handleRegister = async () => {
    const sid = parseInt(sponsorInput)
    if (!sid || sid <= 0) {
      setErrorMsg(t('enterValidSponsorId'))
      return
    }

    setRegistering(true)
    setErrorMsg('')
    try {
      // ═══ PRE-CHECK 1: Может адрес УЖЕ зарегистрирован? ═══
      // Без этой проверки контракт ревёртит без сообщения
      // и пользователь видит "missing revert data" вместо понятной фразы.
      const preStatus = await C.getGWUserStatus(wallet).catch(() => null)
      if (preStatus?.isRegistered) {
        addNotification('ℹ️ Этот кошелёк уже зарегистрирован!')
        useGameStore.getState().updateRegistration(true, preStatus.odixId || sid)
        if (preStatus.maxPackage > 0) useGameStore.getState().setLevel(preStatus.maxPackage)
        afterRegistration().catch(() => {})
        setStep('telegram')
        setRegistering(false)
        return
      }

      // ═══ PRE-CHECK 2: Хватает ли BNB на газ? ═══
      // Без газа eth_estimateGas падает с пустым revert => "missing revert data".
      const currentBnb = parseFloat(useGameStore.getState().bnb || '0')
      if (currentBnb < 0.001) {
        setErrorMsg(`Недостаточно BNB на газ. У вас ${currentBnb.toFixed(4)} BNB, нужно минимум 0.005 BNB. Пополните кошелёк.`)
        setRegistering(false)
        return
      }

      addNotification(`⏳ Регистрация с ID #${sid}...`)
      await C.register(sid)

      // Ждём подтверждения из блокчейна
      const confirmed = await C.waitForRegistration(wallet)
      const gwStatus = await C.getGWUserStatus(wallet).catch(() => null)

      // ★ FIX: tx прошла успешно (await C.register выше не упал) → registered=true.
      // НЕ доверяем gwStatus.isRegistered: getGWUserStatus может уйти в Bridge fallback,
      // а Bridge не синхронизируется с GW при прямой регистрации через GW.register().
      // В итоге gwStatus.isRegistered = false, и старый код писал в store false,
      // из-за чего модал регистрации появлялся повторно при заходе в Уровни.
      useGameStore.getState().updateRegistration(true, gwStatus?.odixId || sid)
      if (gwStatus?.maxPackage > 0) useGameStore.getState().setLevel(gwStatus.maxPackage)

      addNotification('✅ Регистрация прошла успешно!')

      // Запускаем подпись + загрузку данных в фоне
      // (не дожидаемся, чтобы пользователь сразу увидел экран бота)
      afterRegistration().catch(() => {})

      // Переходим на шаг активации Telegram
      setStep('telegram')

    } catch (err) {
      const msg = err?.reason || err?.shortMessage || err?.message || 'Ошибка'
      console.error('Register error:', err)

      if (msg.includes('Already registered')) {
        addNotification('ℹ️ Вы уже зарегистрированы!')
        useGameStore.getState().updateRegistration(true, sid)
        afterRegistration().catch(() => {})
        setStep('telegram')
      } else if (msg.includes('user rejected') || msg.includes('User rejected') || msg.includes('User denied')) {
        setErrorMsg('Транзакция отклонена в кошельке. Попробуйте ещё раз.')
      } else if (msg.includes('insufficient funds')) {
        setErrorMsg('Недостаточно BNB для газа. Пополните кошелёк (~0.005 BNB).')
      } else if (msg.includes('Sponsor not found') || msg.includes('Invalid sponsor')) {
        setErrorMsg(`Спонсор #${sid} не найден. Проверьте ID.`)
      } else if (msg.includes('missing revert data') || msg.includes('CALL_EXCEPTION') || msg.includes('execution reverted')) {
        // Контракт ревёртит без причины. Часто это означает что транзакция
        // на самом деле прошла или адрес уже зарегистрирован — перепроверим.
        const recheck = await C.getGWUserStatus(wallet).catch(() => null)
        if (recheck?.isRegistered) {
          addNotification('✅ Регистрация подтверждена!')
          useGameStore.getState().updateRegistration(true, recheck.odixId || sid)
          if (recheck.maxPackage > 0) useGameStore.getState().setLevel(recheck.maxPackage)
          afterRegistration().catch(() => {})
          setStep('telegram')
        } else {
          setErrorMsg(`Контракт отклонил вызов. Возможно: спонсор #${sid} не существует, или сеть не opBNB. Проверьте сеть в SafePal (нужен opBNB Mainnet, chainId 204).`)
        }
      } else {
        setErrorMsg(msg.slice(0, 140))
      }
    }
    setRegistering(false)
  }

  const handleSkip = () => {
    clearAutoRegister()
  }

  const handleBotClick = () => {
    setBotClicked(true)
  }

  const handleFinish = () => {
    clearAutoRegister()
  }

  // ═══ ШАГ 2: АКТИВАЦИЯ TELEGRAM-БОТА ═══
  if (step === 'telegram') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.9)' }}>
        <div className="max-w-[420px] w-full p-5 rounded-3xl"
          style={{ background: 'linear-gradient(180deg, #0d2818 0%, #0a0a20 100%)', border: '1px solid rgba(16,185,129,0.3)' }}>

          {/* Заголовок успеха */}
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">✅</div>
            <h3 className="text-xl font-black text-white mb-1">Регистрация прошла!</h3>
            <p className="text-[13px] text-emerald-400 font-bold mb-1">Кошелёк привязан к Diamond Club</p>
            <p className="text-[12px] text-slate-400">
              Остался один шаг — <b className="text-white">активация Telegram-бота</b>
            </p>
          </div>

          {/* ★ ГЛАВНАЯ КНОПКА — БОТ (яркая, пульсирующая) */}
          <a
            href={botLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleBotClick}
            className="block w-full py-4 rounded-2xl text-center text-[16px] font-black mb-3 relative"
            style={{
              background: botClicked
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, #0088cc, #0066aa)',
              color: '#fff',
              textDecoration: 'none',
              boxShadow: botClicked ? 'none' : '0 0 24px rgba(0,136,204,0.6), 0 6px 16px rgba(0,136,204,0.4)',
              animation: botClicked ? 'none' : 'dc-pulse 2s ease-in-out infinite',
            }}
          >
            {botClicked ? '✅ Откройте Telegram и нажмите Start' : '🚀 Активировать @' + BOT_USERNAME}
          </a>

          {/* Что даст бот */}
          <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(0,136,204,0.2)' }}>
            <div className="text-[12px] text-slate-300 leading-relaxed">
              ✅ Пошаговые инструкции по клубу<br />
              ✅ Уведомления о новых лотах и конференциях<br />
              ✅ Ответы на вопросы<br />
              ✅ Без спама — можно отписаться
            </div>
          </div>

          {/* Пропуск */}
          <button
            onClick={handleFinish}
            className="w-full py-2.5 text-[12px] text-slate-500 text-center"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Позже → перейти в кабинет
          </button>

          {/* Анимация пульсации */}
          <style jsx>{`
            @keyframes dc-pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.02); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  // ═══ ШАГ 1: ФОРМА РЕГИСТРАЦИИ ═══
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.9)' }}>
      <div className="max-w-[420px] w-full rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1a1040 0%, #0c0c1e 100%)', border: '1px solid rgba(255,215,0,0.2)' }}>

        {/* Header */}
        <div className="px-5 pt-5 pb-3 text-center">
          <div className="text-4xl mb-2">💎</div>
          <h3 className="text-xl font-black text-white mb-1">Регистрация в Diamond Club</h3>
          <p className="text-[12px] text-slate-400">
            Регистрация привязывает кошелёк к экосистеме GlobalWay.
            Камни перестанут испаряться, откроется доступ к бизнесу и бонусам.
          </p>
        </div>

        {/* Кошелёк */}
        <div className="mx-5 p-2.5 rounded-xl mb-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-bold">Кошелёк подключён</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">{wallet ? shortAddress(wallet) : ''}</div>
        </div>

        {/* ID Спонсора */}
        <div className="px-5 mb-3">
          <label className="text-[11px] text-slate-400 mb-1.5 block">
            {hasRefFromLink ? '✅ Спонсор определён из ссылки:' : 'ID того, кто тебя пригласил:'}
          </label>

          {hasRefFromLink ? (
            // Из реферальной ссылки — заблокировано
            <div className="p-3.5 rounded-xl text-center" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)' }}>
              <div className="text-2xl font-black" style={{ color: '#ffd700' }}>ID: #{pendingRefId}</div>
              <div className="text-[9px] text-slate-500 mt-1">Привязан из реферальной ссылки</div>
            </div>
          ) : (
            // Без реферальной ссылки — ручной ввод
            <div>
              <input
                value={sponsorInput}
                onChange={e => { setSponsorInput(e.target.value.replace(/\D/g, '')); setErrorMsg('') }}
                placeholder="Например: 12345"
                inputMode="numeric"
                className="w-full p-3.5 rounded-xl text-center text-lg font-bold outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
              />
              <div className="text-[9px] text-slate-500 mt-1.5 text-center">
                💡 Спроси у того, кто дал тебе ссылку. Или попроси ссылку у знакомого из GlobalWay.
              </div>
            </div>
          )}
        </div>

        {/* Ошибка */}
        {errorMsg && (
          <div className="mx-5 mb-3 p-2.5 rounded-xl text-[11px] text-red-400 font-bold text-center"
            style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)' }}>
            ❌ {errorMsg}
          </div>
        )}

        {/* Что даёт регистрация */}
        <div className="mx-5 mb-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-[10px] text-slate-500 mb-1.5">Что даёт регистрация:</div>
          <div className="space-y-1">
            {[
              ['⛏', 'Камни сохраняются навсегда (не испаряются)'],
              ['💎', 'Доступ к бриллиантам со скидкой до 70%'],
              ['📈', 'Стейкинг от 50% годовых'],
              ['👥', '9 уровней партнёрской программы'],
            ].map(([icon, text], i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span>{icon}</span>
                <span className="text-slate-300">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Кнопки */}
        <div className="px-5 pb-5 space-y-2">
          <button
            onClick={handleRegister}
            disabled={registering || (!sponsorInput || parseInt(sponsorInput) <= 0)}
            className="w-full py-4 rounded-2xl text-[15px] font-black transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
            {registering ? '⏳ Регистрация...' : '✅ Зарегистрироваться'}
          </button>

          <button onClick={handleSkip}
            className="w-full py-2.5 text-[11px] text-slate-500 text-center">
            Пропустить (камни будут испаряться через 30 мин)
          </button>
        </div>
      </div>
    </div>
  )
}
