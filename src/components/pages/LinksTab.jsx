'use client'
import { useState } from 'react'
import useGameStore from '@/lib/store'
import HelpButton from '@/components/ui/HelpButton'

export default function LinksTab() {
  const { wallet, sponsorId, t } = useGameStore()
  const [copiedType, setCopiedType] = useState(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gws.ink'

  const inviteLink = sponsorId
    ? `${baseUrl}/invite?ref=${sponsorId}`
    : wallet ? `${baseUrl}/invite?ref=${wallet.slice(2, 10)}` : ''

  // Рекламная ссылка — с лендингом и превью-картинкой
  const adLink = sponsorId
    ? `${baseUrl}/?ref=${sponsorId}`
    : wallet ? `${baseUrl}/?ref=${wallet.slice(2, 10)}` : ''

  const tgBotLink = sponsorId
    ? `https://t.me/DiamondClubGWSBot?start=${sponsorId}`
    : ''

  const shareText = `💎 Бриллианты со скидкой до 70%! Стейкинг от 50% годовых. Бесплатный старт! Присоединяйся:`
  const adText = `💎 Diamond Club — Бриллианты от $50 за долю. Доходность до +420% за год. Закрытый клуб.`
  const viberText = shareText.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|[\u{FE00}-\u{FEFF}]|[\u{1F900}-\u{1F9FF}]|[\u{200D}\u{20E3}\u{FE0F}]/gu, '').replace(/\s{2,}/g, ' ').trim()
  const adViberText = adText.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|[\u{FE00}-\u{FEFF}]|[\u{1F900}-\u{1F9FF}]|[\u{200D}\u{20E3}\u{FE0F}]/gu, '').replace(/\s{2,}/g, ' ').trim()

  const shareLinks = {
    tg: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`,
    wa: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${inviteLink}`)}`,
    vb: `viber://forward?text=${encodeURIComponent(`${viberText}\n${inviteLink}`)}`,
  }

  // Кнопки шаринга для рекламной ссылки (с лендингом и превью)
  const adShareLinks = {
    tg: `https://t.me/share/url?url=${encodeURIComponent(adLink)}&text=${encodeURIComponent(adText)}`,
    wa: `https://wa.me/?text=${encodeURIComponent(`${adText}\n${adLink}`)}`,
    vb: `viber://forward?text=${encodeURIComponent(`${adViberText}\n${adLink}`)}`,
  }

  const copy = (text, type) => {
    if (navigator.clipboard) navigator.clipboard.writeText(text)
    else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) }
    setCopiedType(type)
    setTimeout(() => setCopiedType(null), 2000)
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

          {/* ═══ РЕКЛАМНАЯ ССЫЛКА (с лендингом и превью) ═══ */}
          <div className="p-3 rounded-2xl border"
            style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(37,99,235,0.04))', borderColor: 'rgba(59,130,246,0.3)' }}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] font-bold" style={{ color: '#60a5fa' }}>📢 Рекламная ссылка</div>
              <div className="text-[9px] text-slate-500">с красивым превью</div>
            </div>
            <div className="text-[10px] text-slate-400 mb-2">Для рекламы, соц.сетей, холодной аудитории. Показывается лендинг с картинкой.</div>
            <div className="text-[10px] text-white break-all mb-2 p-2 rounded-lg bg-black/30 font-mono">{adLink || '—'}</div>
            <button onClick={() => copy(adLink, 'ad')} disabled={!adLink}
              className="w-full py-2.5 rounded-xl text-[11px] font-bold text-blue-300 bg-blue-500/15 border border-blue-500/30 transition-all mb-2">
              {copiedType === 'ad' ? '✅ Скопировано!' : '📋 Копировать рекламную ссылку'}
            </button>
            <div className="flex gap-2">
              <a href={adShareLinks.tg} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl text-[10px] font-bold text-center transition-all"
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
                📱 Telegram
              </a>
              <a href={adShareLinks.wa} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl text-[10px] font-bold text-center transition-all"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
                💬 WhatsApp
              </a>
              <a href={adShareLinks.vb} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl text-[10px] font-bold text-center transition-all"
                style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>
                📞 Viber
              </a>
            </div>
          </div>

          {/* ═══ ЛИЧНАЯ ССЫЛКА (сразу регистрация без лендинга) ═══ */}
          <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-[11px] font-bold mb-1" style={{ color: '#10b981' }}>🔗 Личная ссылка (быстрая регистрация)</div>
            <div className="text-[10px] text-slate-400 mb-2">Для друзей, родных. Сразу форма контакта, без лендинга.</div>
            <div className="text-[10px] text-white break-all mb-2 p-2 rounded-lg bg-white/5 font-mono">{inviteLink || '—'}</div>
            <button onClick={() => copy(inviteLink, 'invite')} disabled={!inviteLink}
              className="w-full py-2.5 rounded-xl text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 transition-all mb-2">
              {copiedType === 'invite' ? '✅ Скопировано!' : '📋 Копировать личную ссылку'}
            </button>
            <div className="flex gap-2">
              <a href={shareLinks.tg} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl text-[10px] font-bold text-center transition-all"
                style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6' }}>
                📱 Telegram
              </a>
              <a href={shareLinks.wa} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl text-[10px] font-bold text-center transition-all"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>
                💬 WhatsApp
              </a>
              <a href={shareLinks.vb} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl text-[10px] font-bold text-center transition-all"
                style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#a855f7' }}>
                📞 Viber
              </a>
            </div>
          </div>

          {/* ═══ Telegram Bot — одна кнопка запуска ═══ */}
          {tgBotLink && (
            <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-[10px] text-slate-500 mb-2">🤖 Diamond Club Bot · рассылка и новости клуба</div>

              <a href={tgBotLink} target="_blank" rel="noopener noreferrer"
                className="block w-full py-3.5 rounded-xl text-[13px] font-bold text-center mb-2 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(59,130,246,0.35)'
                }}>
                🚀 Активировать бот → нажми Start
              </a>

              <div className="flex items-center gap-2">
                <div className="text-[9px] text-slate-400 break-all flex-1 p-2 rounded-lg bg-white/5 font-mono">{tgBotLink}</div>
                <button onClick={() => copy(tgBotLink, 'bot')}
                  className="shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 transition-all">
                  {copiedType === 'bot' ? '✅' : '📋'}
                </button>
              </div>
            </div>
          )}

          {/* Бонусы */}
          <div className="p-3 rounded-2xl border" style={{ background: 'rgba(255,215,0,0.04)', borderColor: 'rgba(255,215,0,0.15)' }}>
            <div className="text-[12px] font-bold mb-2" style={{ color: '#ffd700' }}>🎁 Бонусы за приглашение</div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-amber-400">⛏</span>
                <span className="text-slate-300"><b className="text-white">+50 GST</b> за каждого зарегистрированного</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400">⛏</span>
                <span className="text-slate-300"><b className="text-white">+10%</b> от тапов приглашённых (постоянно)</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ color: '#ffd700' }}>💎</span>
                <span className="text-slate-300"><b className="text-white">9 уровней</b> партнёрки от покупок камней</span>
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
