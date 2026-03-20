'use client'
import { useState } from 'react'
import useGameStore from '@/lib/store'
import HelpButton from '@/components/ui/HelpButton'

export default function LinksTab() {
  const { wallet, sponsorId, t } = useGameStore()
  const [copied, setCopied] = useState(false)

  const refLink = sponsorId
    ? `https://dc.globalway.app/?ref=${sponsorId}`
    : wallet ? `https://dc.globalway.app/?ref=${wallet.slice(2, 10)}` : ''

  const tgLink = sponsorId
    ? `https://t.me/DiamondClubNSSBot?start=${sponsorId}`
    : ''

  const copy = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-3 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black" style={{ color: 'var(--gold)' }}>✂️ {t('tabLinks')}</h2>
        <HelpButton section="links" />
      </div>

      {!wallet ? (
        <div className="p-4 rounded-2xl text-center text-[12px] text-slate-400 border border-white/5">
          Подключите кошелёк для получения реферальных ссылок
        </div>
      ) : (
        <div className="space-y-3">
          {/* Web ссылка */}
          <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-[10px] text-slate-500 mb-1">🔗 Реферальная ссылка (Web)</div>
            <div className="text-[11px] text-white break-all mb-2 p-2 rounded-lg bg-white/5">{refLink || '—'}</div>
            <button onClick={() => copy(refLink)} disabled={!refLink}
              className="w-full py-2 rounded-xl text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 transition-all">
              {copied ? '✅ Скопировано!' : '📋 Копировать'}
            </button>
          </div>

          {/* Telegram ссылка */}
          {tgLink && (
            <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-[10px] text-slate-500 mb-1">📱 Telegram Bot</div>
              <div className="text-[11px] text-white break-all mb-2 p-2 rounded-lg bg-white/5">{tgLink}</div>
              <button onClick={() => copy(tgLink)}
                className="w-full py-2 rounded-xl text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 transition-all">
                📋 Копировать
              </button>
            </div>
          )}

          {/* ID */}
          {sponsorId && (
            <div className="p-3 rounded-2xl border text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-[10px] text-slate-500">Ваш ID в GlobalWay</div>
              <div className="text-2xl font-black" style={{ color: 'var(--gold)' }}>#{sponsorId}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
