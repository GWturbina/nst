'use client'
import { useState } from 'react'
import useGameStore from '@/lib/store'

export default function LinksTab() {
  const { wallet, sponsorId, t } = useGameStore()
  const [copied, setCopied] = useState(false)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://nss-azure.vercel.app'

  const inviteLink = sponsorId
    ? `${baseUrl}/invite?ref=${sponsorId}`
    : wallet ? `${baseUrl}/invite?ref=${wallet.slice(2, 10)}` : ''

  const tgBotLink = sponsorId
    ? `https://t.me/MetrKvadratnyBot?start=${sponsorId}`
    : ''

  const shareText = '🏠 Свой дом под 0%! Тапай — копи метры — строй дом! Бесплатный старт! Присоединяйся:'
  const viberText = 'Свой дом под 0%! Тапай - копи метры - строй дом! Бесплатный старт! Присоединяйся:'

  const shareLinks = {
    tg: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`,
    wa: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${inviteLink}`)}`,
    vb: `viber://forward?text=${encodeURIComponent(`${viberText}\n${inviteLink}`)}`,
  }

  const copy = (text) => {
    if (navigator.clipboard) navigator.clipboard.writeText(text)
    else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-3 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black" style={{ color: 'var(--gold)' }}>✂️ {t('tabLinks')}</h2>
      </div>

      {!wallet ? (
        <div className="p-4 rounded-2xl text-center text-[12px] text-slate-400 border border-white/5">
          Подключите кошелёк для получения реферальных ссылок
        </div>
      ) : (
        <div className="space-y-3">

          {/* Ссылка + копирование */}
          <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-[10px] text-slate-500 mb-1">🔗 Реферальная ссылка</div>
            <div className="text-[10px] text-white break-all mb-2 p-2 rounded-lg bg-white/5 font-mono">{inviteLink || '—'}</div>
            <button onClick={() => copy(inviteLink)} disabled={!inviteLink}
              className="w-full py-2.5 rounded-xl text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 transition-all">
              {copied ? '✅ Скопировано!' : '📋 Копировать ссылку'}
            </button>
          </div>

          {/* Шаринг: Telegram / WhatsApp / Viber */}
          {inviteLink && (
            <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-[10px] text-slate-500 mb-2">📤 Отправить приглашение</div>
              <div className="flex gap-2">
                <a href={shareLinks.tg} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center transition-all"
                  style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6' }}>
                  <div className="text-lg mb-0.5">📱</div>
                  Telegram
                </a>
                <a href={shareLinks.wa} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center transition-all"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>
                  <div className="text-lg mb-0.5">💬</div>
                  WhatsApp
                </a>
                <a href={shareLinks.vb} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold text-center transition-all"
                  style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#a855f7' }}>
                  <div className="text-lg mb-0.5">📞</div>
                  Viber
                </a>
              </div>
            </div>
          )}

          {/* Telegram Bot */}
          {tgBotLink && (
            <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-[10px] text-slate-500 mb-1">🤖 Telegram Bot</div>
              <div className="text-[10px] text-white break-all mb-2 p-2 rounded-lg bg-white/5 font-mono">{tgBotLink}</div>
              <button onClick={() => copy(tgBotLink)}
                className="w-full py-2 rounded-xl text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 transition-all">
                📋 Копировать
              </button>
            </div>
          )}

          {/* Бонусы */}
          <div className="p-3 rounded-2xl border" style={{ background: 'rgba(255,215,0,0.04)', borderColor: 'rgba(255,215,0,0.15)' }}>
            <div className="text-[12px] font-bold mb-2" style={{ color: '#ffd700' }}>🎁 Бонусы за приглашение</div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-amber-400">🏠</span>
                <span className="text-slate-300"><b className="text-white">+50 CHT</b> за каждого зарегистрированного</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400">⛏</span>
                <span className="text-slate-300"><b className="text-white">+10%</b> от тапов приглашённых (постоянно)</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ color: '#ffd700' }}>💰</span>
                <span className="text-slate-300"><b className="text-white">9 уровней</b> партнёрки от покупок бизнесов</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">🏡</span>
                <span className="text-slate-300"><b className="text-white">Свой дом</b> при достижении порога заработка</span>
              </div>
            </div>
          </div>

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
