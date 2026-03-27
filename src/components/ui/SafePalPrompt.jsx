'use client'
/**
 * SafePalPrompt — Кнопка SafePal deeplink + инструкция
 * 
 * Показывается когда window.ethereum не обнаружен:
 *   - В Telegram WebApp (встроенный браузер без кошельков)
 *   - В обычном мобильном браузере без SafePal
 *   - На десктопе без расширения SafePal
 */
import { useState } from 'react'
import useGameStore from '@/lib/store'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nss-azure.vercel.app'

export default function SafePalPrompt({ compact = false, onClose }) {
  const { t } = useGameStore()
  const [showSteps, setShowSteps] = useState(false)

  const deeplink = `safepalwallet://open?url=${encodeURIComponent(SITE_URL)}`

  const isInTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  if (compact) {
    return (
      <div className="p-3 rounded-2xl border" style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)' }}>
        <div className="text-[11px] text-slate-300 mb-2">
          {isInTelegram
            ? '⚠️ Telegram не поддерживает Web3-кошельки напрямую.'
            : '⚠️ Кошелёк не обнаружен.'}
        </div>
        <a href={deeplink}
          className="block w-full py-2.5 rounded-xl text-center text-[12px] font-bold transition-all"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}>
          🔐 Открыть в SafePal
        </a>
        <button onClick={() => setShowSteps(!showSteps)}
          className="w-full mt-1.5 text-[10px] text-blue-400 text-center">
          {showSteps ? '▲ Скрыть' : '▼ Как установить SafePal?'}
        </button>
        {showSteps && <InstallSteps isMobile={isMobile} />}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="max-w-[400px] w-full p-5 rounded-3xl"
        style={{ background: 'linear-gradient(180deg, #1a1040, #0a0a20)', border: '1px solid rgba(59,130,246,0.3)' }}>
        <div className="text-center">
          <div className="text-4xl mb-2">🔐</div>
          <h3 className="text-lg font-black text-white mb-1">
            {isInTelegram ? 'Откройте в SafePal' : 'Установите SafePal'}
          </h3>
          <p className="text-[12px] text-slate-400 mb-4">
            {isInTelegram
              ? 'Telegram открывает ссылки во встроенном браузере — кошелёк SafePal туда не подключается. Нажмите кнопку ниже, чтобы открыть приложение в SafePal.'
              : 'Для работы с клубными домами и CHT токенами нужен криптокошелёк SafePal.'}
          </p>

          <a href={deeplink}
            className="block w-full py-3.5 rounded-2xl text-center text-[14px] font-black transition-all mb-3"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}>
            🔐 Открыть в SafePal Browser
          </a>

          <button onClick={() => setShowSteps(!showSteps)}
            className="w-full py-2 text-[11px] text-blue-400 font-bold mb-2">
            {showSteps ? '▲ Скрыть инструкцию' : '📋 Первый раз? Пошаговая инструкция'}
          </button>

          {showSteps && <InstallSteps isMobile={isMobile} isInTelegram={isInTelegram} />}

          <div className="mt-3 p-2.5 rounded-xl text-[9px] text-slate-500 leading-relaxed"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            💡 Если кнопка не открыла SafePal — скопируйте ссылку и вставьте в SafePal Browser вручную:
            <div className="mt-1 p-1.5 rounded bg-black/30 text-white break-all font-mono text-[9px] select-all">
              {SITE_URL}
            </div>
          </div>

          {onClose && (
            <button onClick={onClose} className="mt-3 text-[11px] text-slate-500">
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function InstallSteps({ isMobile, isInTelegram }) {
  return (
    <div className="mt-2 p-3 rounded-xl text-left text-[11px] space-y-2"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {!isMobile ? (
        <>
          <Step n={1} text="Установите SafePal на телефон (App Store / Google Play)" />
          <Step n={2} text="Создайте или импортируйте кошелёк в SafePal" />
          <Step n={3} text="Откройте Browser внутри SafePal (иконка 🌐 внизу)" />
          <Step n={4} text={`Вставьте ссылку: ${SITE_URL}`} />
          <Step n={5} text="Подключите кошелёк — готово!" />
        </>
      ) : (
        <>
          {!isInTelegram && <Step n={1} text="Установите SafePal из App Store / Google Play" />}
          {!isInTelegram && <Step n={2} text="Создайте или импортируйте кошелёк" />}
          <Step n={isInTelegram ? 1 : 3} text='Нажмите кнопку "Открыть в SafePal Browser" выше' />
          <Step n={isInTelegram ? 2 : 4} text="Если SafePal установлен — приложение откроется автоматически" />
          <Step n={isInTelegram ? 3 : 5} text="Подключите кошелёк — готово!" />
        </>
      )}
      <div className="mt-2 pt-2 text-[10px] text-slate-500" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        ⚠️ MetaMask и другие кошельки не поддерживаются. Только SafePal.
      </div>
    </div>
  )
}

function Step({ n, text }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
        style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>
        {n}
      </span>
      <span className="text-slate-300 leading-tight">{text}</span>
    </div>
  )
}
