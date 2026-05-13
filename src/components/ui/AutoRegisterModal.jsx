'use client'
/**
 * AutoRegisterModal — Модал регистрации для новых пользователей
 *
 * Шаги:
 *   intro        — образовательный экран. Развилка: «Есть SafePal» / «Нет SafePal»
 *                  Показывается если кошелёк ещё не подключён.
 *   noSafePal    — SafePal не обнаружен в браузере. Инструкция как открыть через DApp.
 *   wrongNetwork — кошелёк подключён, но сеть не opBNB. Кнопка автопереключения.
 *   register     — форма ввода спонсора и регистрация в смарт-контракте
 *   telegram     — активация Telegram-бота @DiamondClubGWSBot после успеха
 */
import { useState, useEffect } from 'react'
import useGameStore from '@/lib/store'
import { useBlockchain } from '@/lib/useBlockchain'
import { gwadTrackRegistration } from '@/lib/gwadTracking'
import * as C from '@/lib/contracts'
import { shortAddress } from '@/lib/web3'
import { LEVELS } from '@/lib/gameData'

// ═══ БОТЫ ═══
const BOT_USERNAME = 'DiamondClubGWSBot'      // старый — для post-регистрации (новости, лоты)
const ONBOARDING_BOT = 'gwad_diamond_bot'      // новый — для тех у кого нет SafePal

// ═══ СЕТЬ ═══
const OPBNB_CHAIN_ID = 204
const OPBNB_CHAIN_HEX = '0xCC'

// ═══ ДЕТЕКЦИЯ КОШЕЛЬКА ═══
// Поддерживается ТОЛЬКО SafePal. MetaMask, Trust, Coinbase и др. — не подходят.
// Возвращаем провайдер только если это SafePal, иначе null.
function detectSafePalProvider() {
  if (typeof window === 'undefined') return null

  // 1. Прямой SafePal-провайдер (мобильное приложение SafePal Wallet)
  if (window.safepalProvider) return window.safepalProvider

  const eth = window.ethereum
  if (!eth) return null

  // 2. window.ethereum с явным флагом SafePal (extension)
  if (eth.isSafePal || eth.isSafePalWallet) return eth

  // 3. EIP-5749 / EIP-1193: множество провайдеров (например, SafePal extension рядом с MetaMask)
  if (Array.isArray(eth.providers)) {
    const safepal = eth.providers.find(p => p?.isSafePal || p?.isSafePalWallet)
    if (safepal) return safepal
  }

  // Если есть window.ethereum, но он НЕ SafePal — отказываем
  return null
}

export default function AutoRegisterModal() {
  const { wallet, pendingRefId, clearAutoRegister, addNotification, t } = useGameStore()
  const { afterRegistration } = useBlockchain()

  const [sponsorInput, setSponsorInput] = useState(pendingRefId || '')
  const [registering, setRegistering] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [botClicked, setBotClicked] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [currentChainId, setCurrentChainId] = useState(null)

  const hasRefFromLink = !!pendingRefId

  // Deep link в onboarding-бот (для тех у кого нет SafePal)
  const onboardingBotLink = `https://t.me/${ONBOARDING_BOT}?start=ref_${pendingRefId || 'none'}_diamond`

  // Deep link в активационный бот (после регистрации)
  const botLink = `https://t.me/${BOT_USERNAME}?start=${pendingRefId || sponsorInput || '0'}`

  // ═══ Определяем стартовый шаг ═══
  // Если wallet ещё не подключён — показываем intro
  // Если подключён, но сеть не opBNB — показываем wrongNetwork
  // Если всё ок — register
  const determineStep = () => {
    if (!wallet) return 'intro'
    if (currentChainId !== null && currentChainId !== OPBNB_CHAIN_ID) return 'wrongNetwork'
    return 'register'
  }
  const [step, setStep] = useState(determineStep())

  // ═══ Чтение текущей сети ═══
  useEffect(() => {
    async function readChain() {
      try {
        const provider = detectSafePalProvider()
        if (!provider) return
        const cid = await provider.request({ method: 'eth_chainId' })
        const num = parseInt(cid, 16)
        setCurrentChainId(num)
      } catch (e) {
        // игнорируем
      }
    }
    readChain()

    const provider = detectSafePalProvider()
    if (!provider) return
    const handler = (newCid) => {
      const num = parseInt(newCid, 16)
      setCurrentChainId(num)
    }
    provider.on?.('chainChanged', handler)
    return () => provider.removeListener?.('chainChanged', handler)
  }, [])

  // ═══ Переход между шагами при изменении wallet/network ═══
  useEffect(() => {
    if (step === 'telegram') return // после успешной регистрации не сбрасываем
    if (!wallet) {
      setStep('intro')
    } else if (currentChainId !== null && currentChainId !== OPBNB_CHAIN_ID) {
      setStep('wrongNetwork')
    } else if (step === 'intro' || step === 'wrongNetwork') {
      setStep('register')
    }
  }, [wallet, currentChainId])

  // ═══ Действия ═══
  const handleConnectWallet = async () => {
    setConnecting(true)
    try {
      const provider = detectSafePalProvider()
      if (!provider) {
        // SafePal не найден → показываем шаг с инструкцией (не открываем бот молча)
        setStep('noSafePal')
        setConnecting(false)
        return
      }
      await provider.request({ method: 'eth_requestAccounts' })
      // wallet попадёт в store через accountsChanged listener
      // step переключится автоматически через useEffect
    } catch (e) {
      addNotification('❌ ' + (e?.message || 'Ошибка подключения'))
    }
    setConnecting(false)
  }

  const handleSwitchNetwork = async () => {
    setSwitching(true)
    try {
      const provider = detectSafePalProvider()
      if (!provider) {
        addNotification('❌ SafePal не найден')
        setStep('noSafePal')
        setSwitching(false)
        return
      }
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: OPBNB_CHAIN_HEX }]
        })
      } catch (switchError) {
        // сеть не добавлена — добавляем
        if (switchError?.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: OPBNB_CHAIN_HEX,
              chainName: 'opBNB Mainnet',
              nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
              rpcUrls: ['https://opbnb-mainnet-rpc.bnbchain.org'],
              blockExplorerUrls: ['https://opbnb.bscscan.com']
            }]
          })
        } else {
          throw switchError
        }
      }
    } catch (e) {
      addNotification('❌ ' + (e?.message || 'Не удалось переключить сеть'))
    }
    setSwitching(false)
  }

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
      const currentBnb = parseFloat(useGameStore.getState().bnb || '0')
      if (currentBnb < 0.001) {
        setErrorMsg(`Недостаточно BNB на газ. У вас ${currentBnb.toFixed(4)} BNB, нужно минимум 0.005 BNB. Пополните кошелёк.`)
        setRegistering(false)
        return
      }

      addNotification(`⏳ Регистрация с ID #${sid}...`)
      await C.register(sid)

      const confirmed = await C.waitForRegistration(wallet)
      const gwStatus = await C.getGWUserStatus(wallet).catch(() => null)

      useGameStore.getState().updateRegistration(true, gwStatus?.odixId || sid)
      if (gwStatus?.maxPackage > 0) useGameStore.getState().setLevel(gwStatus.maxPackage)

      addNotification('✅ Регистрация прошла успешно!')

      afterRegistration().catch(() => {})
      gwadTrackRegistration(wallet).catch(() => {})

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

  const handleSkip = () => clearAutoRegister()
  const handleBotClick = () => setBotClicked(true)
  const handleFinish = () => clearAutoRegister()

  // ═══════════════════════════════════════════════════════════════
  // ШАГ INTRO — образовательный экран с развилкой
  // ═══════════════════════════════════════════════════════════════
  if (step === 'intro') {
    return (
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3"
        style={{ background: 'rgba(0,0,0,0.92)' }}>
        <div className="max-w-[440px] w-full rounded-3xl overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #1a1040 0%, #0c0c1e 100%)', border: '1px solid rgba(255,215,0,0.25)' }}>

          {/* Header */}
          <div className="px-5 pt-5 pb-3 text-center">
            <div className="text-4xl mb-2">💎</div>
            <h3 className="text-xl font-black text-white mb-1">Регистрация в Diamond Club</h3>
            {hasRefFromLink && (
              <p className="text-[11px] mb-1" style={{ color: '#ffd700' }}>
                ✅ Спонсор #{pendingRefId} из реферальной ссылки
              </p>
            )}
          </div>

          {/* Объяснение Web3 */}
          <div className="mx-5 mb-3 p-3 rounded-xl" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)' }}>
            <div className="text-[11px] font-black text-sky-300 mb-1.5">💡 Это Web3-регистрация</div>
            <div className="text-[11px] text-slate-300 mb-1.5">
              Мы НЕ собираем твои данные. Регистрация анонимная — без email, имени, телефона, документов.
            </div>
          </div>

          {/* Что нужно */}
          <div className="mx-5 mb-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[11px] font-black text-white mb-1.5">Для регистрации нужно:</div>
            <div className="space-y-1 text-[11px] text-slate-300">
              <div>✅ SafePal-кошелёк (бесплатное приложение)</div>
              <div>✅ Сеть opBNB</div>
              <div>✅ ~$2 в BNB на одну транзакцию</div>
            </div>
          </div>

          {/* Что НЕ нужно */}
          <div className="mx-5 mb-4 p-3 rounded-xl" style={{ background: 'rgba(225,29,72,0.04)', border: '1px solid rgba(225,29,72,0.12)' }}>
            <div className="text-[10px] font-black text-rose-300/80 mb-1">НЕ нужно:</div>
            <div className="text-[10px] text-slate-400">
              ❌ Email&nbsp;&nbsp;❌ Имя&nbsp;&nbsp;❌ Телефон&nbsp;&nbsp;❌ Документы&nbsp;&nbsp;❌ Карты
            </div>
          </div>

          {/* Развилка */}
          <div className="px-5 pb-5 space-y-2.5">
            <button
              onClick={handleConnectWallet}
              disabled={connecting}
              className="w-full py-4 rounded-2xl text-[15px] font-black transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
              {connecting ? '⏳ Подключение...' : '🦊 У меня есть SafePal — подключить'}
            </button>

            <a
              href={onboardingBotLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3.5 rounded-2xl text-center text-[13px] font-black"
              style={{
                background: 'linear-gradient(135deg, #0088cc, #0066aa)',
                color: '#fff',
                textDecoration: 'none',
                boxShadow: '0 0 20px rgba(0,136,204,0.4)',
              }}>
              📱 Не знаю что это — получи инструкцию в Telegram
            </a>

            <div className="text-[10px] text-slate-500 text-center mt-2">
              Telegram-бот пошагово объяснит как установить SafePal и пройти регистрацию.
              Это займёт 5-10 минут.
            </div>

            <button onClick={handleSkip}
              className="w-full pt-2 text-[10px] text-slate-600 text-center">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // ШАГ NO SAFEPAL — SafePal не обнаружен в браузере
  // ═══════════════════════════════════════════════════════════════
  if (step === 'noSafePal') {
    const refForLink = pendingRefId || ''
    const directUrl = `gws.ink/cabinet${refForLink ? '?ref=' + refForLink : ''}`
    return (
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3"
        style={{ background: 'rgba(0,0,0,0.92)' }}>
        <div className="max-w-[440px] w-full rounded-3xl overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #2a1a0d 0%, #0c0c1e 100%)', border: '1px solid rgba(245,166,35,0.4)' }}>

          {/* Header */}
          <div className="px-5 pt-5 pb-3 text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <h3 className="text-xl font-black text-white mb-1">SafePal не обнаружен</h3>
            <p className="text-[12px] text-slate-400">
              В этом браузере нет SafePal-кошелька.<br />
              <b className="text-amber-300">Поддерживается только SafePal</b> — другие кошельки не работают с экосистемой.
            </p>
          </div>

          {/* Что делать */}
          <div className="mx-5 mb-3 p-3 rounded-xl" style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)' }}>
            <div className="text-[11px] font-black text-amber-300 mb-2">📱 Открой сайт через приложение SafePal:</div>
            <ol className="text-[11px] text-slate-300 space-y-1.5 ml-4 list-decimal">
              <li>Открой <b className="text-white">SafePal</b> на телефоне</li>
              <li>Нажми <b className="text-white">DApp</b> внизу экрана</li>
              <li>В поиске или адресной строке вбей:</li>
            </ol>
            <div className="mt-2 p-2 rounded-lg text-[11px] text-center font-mono"
                 style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,166,35,0.3)', color: '#fbbf24' }}>
              {directUrl}
            </div>
            <button
              onClick={() => {
                try {
                  navigator.clipboard.writeText('https://' + directUrl)
                  addNotification('✅ Ссылка скопирована')
                } catch {}
              }}
              className="w-full mt-2 py-1.5 text-[10px] text-amber-300/80"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
              📋 Скопировать ссылку
            </button>
          </div>

          {/* Нет SafePal вообще */}
          <div className="mx-5 mb-4 p-3 rounded-xl" style={{ background: 'rgba(0,136,204,0.06)', border: '1px solid rgba(0,136,204,0.2)' }}>
            <div className="text-[11px] font-black text-sky-300 mb-1">SafePal не установлен?</div>
            <div className="text-[11px] text-slate-300">
              В Telegram-боте мы пошагово покажем как установить SafePal, настроить сеть opBNB и пройти регистрацию.
            </div>
          </div>

          {/* Кнопки */}
          <div className="px-5 pb-5 space-y-2.5">
            <a
              href={onboardingBotLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3.5 rounded-2xl text-center text-[13px] font-black"
              style={{
                background: 'linear-gradient(135deg, #0088cc, #0066aa)',
                color: '#fff',
                textDecoration: 'none',
                boxShadow: '0 0 20px rgba(0,136,204,0.4)',
              }}>
              📱 Получить полную инструкцию в Telegram
            </a>

            <button
              onClick={() => setStep('intro')}
              className="w-full py-2.5 text-[11px] text-slate-500 text-center">
              ← Назад
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // ШАГ WRONG NETWORK — переключение сети
  // ═══════════════════════════════════════════════════════════════
  if (step === 'wrongNetwork') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.92)' }}>
        <div className="max-w-[420px] w-full p-5 rounded-3xl"
          style={{ background: 'linear-gradient(180deg, #2a1a0d 0%, #0c0c1e 100%)', border: '1px solid rgba(245,166,35,0.4)' }}>

          <div className="text-center mb-4">
            <div className="text-5xl mb-2">🔀</div>
            <h3 className="text-xl font-black text-white mb-1">Неправильная сеть</h3>
            <p className="text-[12px] text-slate-400">
              Для регистрации нужна сеть <b className="text-white">opBNB Mainnet</b>.<br />
              Сейчас твой кошелёк подключён к другой сети.
            </p>
          </div>

          <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Кошелёк:</span>
              <span className="text-white font-mono">{wallet ? shortAddress(wallet) : ''}</span>
            </div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Сейчас сеть:</span>
              <span className="text-rose-400 font-bold">chainId {currentChainId ?? '?'}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Нужна сеть:</span>
              <span className="text-emerald-400 font-bold">opBNB ({OPBNB_CHAIN_ID})</span>
            </div>
          </div>

          <button
            onClick={handleSwitchNetwork}
            disabled={switching}
            className="w-full py-4 rounded-2xl text-[15px] font-black transition-all disabled:opacity-40 mb-2"
            style={{ background: 'linear-gradient(135deg, #ffd700, #f5a623)', color: '#000' }}>
            {switching ? '⏳ Переключение...' : '🔀 Переключить на opBNB автоматически'}
          </button>

          <div className="text-[10px] text-slate-500 text-center leading-relaxed">
            Если кнопка не сработала — открой SafePal вручную:<br />
            Settings → Networks → opBNB Mainnet (или добавь её)
          </div>

          <button onClick={handleSkip}
            className="w-full pt-3 text-[10px] text-slate-600 text-center">
            Закрыть
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // ШАГ TELEGRAM — после успешной регистрации (БЕЗ ИЗМЕНЕНИЙ)
  // ═══════════════════════════════════════════════════════════════
  if (step === 'telegram') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.9)' }}>
        <div className="max-w-[420px] w-full p-5 rounded-3xl"
          style={{ background: 'linear-gradient(180deg, #0d2818 0%, #0a0a20 100%)', border: '1px solid rgba(16,185,129,0.3)' }}>

          <div className="text-center mb-4">
            <div className="text-5xl mb-2">✅</div>
            <h3 className="text-xl font-black text-white mb-1">Регистрация прошла!</h3>
            <p className="text-[13px] text-emerald-400 font-bold mb-1">Кошелёк привязан к Diamond Club</p>
            <p className="text-[12px] text-slate-400">
              Остался один шаг — <b className="text-white">активация Telegram-бота</b>
            </p>
          </div>

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

          <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(0,136,204,0.2)' }}>
            <div className="text-[12px] text-slate-300 leading-relaxed">
              ✅ Пошаговые инструкции по клубу<br />
              ✅ Уведомления о новых лотах и конференциях<br />
              ✅ Ответы на вопросы<br />
              ✅ Без спама — можно отписаться
            </div>
          </div>

          <button
            onClick={handleFinish}
            className="w-full py-2.5 text-[12px] text-slate-500 text-center"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Позже → перейти в кабинет
          </button>

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

  // ═══════════════════════════════════════════════════════════════
  // ШАГ REGISTER — форма регистрации (БЕЗ ИЗМЕНЕНИЙ)
  // ═══════════════════════════════════════════════════════════════
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
            <div className="p-3.5 rounded-xl text-center" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)' }}>
              <div className="text-2xl font-black" style={{ color: '#ffd700' }}>ID: #{pendingRefId}</div>
              <div className="text-[9px] text-slate-500 mt-1">Привязан из реферальной ссылки</div>
            </div>
          ) : (
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
                💡 Спроси у того, кто дал тебе ссылку. Нет ссылки? →{' '}
                <a href={onboardingBotLink} target="_blank" rel="noopener noreferrer"
                   style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                  получи в Telegram
                </a>
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
