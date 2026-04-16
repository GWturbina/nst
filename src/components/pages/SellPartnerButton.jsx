'use client'
/**
 * SellPartnerButton.jsx — Кнопка «Продавать» на карточке товара в витрине
 *
 * Логика:
 *   1. Партнёр нажимает «📢 Хочу продавать»
 *   2. Открывается модалка:
 *      — ввод своей цены (не ниже клубной) ИЛИ «Цена договорная»
 *      — кнопка «Сохранить и получить ссылку»
 *   3. Цена сохраняется в dc_partner_listings через /api/partner-listing
 *   4. Появляется готовая ссылка + кнопки поделиться (Telegram, WhatsApp, Viber, Копировать)
 *
 * Требования:
 *   — Партнёр должен быть подключён (wallet + authSig в store)
 *   — GW ID берётся из store.sponsorId (odixId из контракта)
 */
import { useState, useEffect } from 'react'
import useGameStore from '@/lib/store'
import { authFetch } from '@/lib/authClient'
import { formatUSD } from '@/lib/gemCatalog'

const SITE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : 'https://gws.ink'

export default function SellPartnerButton({ item }) {
  const { wallet, sponsorId, addNotification } = useGameStore()
  const [showModal, setShowModal] = useState(false)
  const [price, setPrice] = useState('')
  const [isNegotiable, setIsNegotiable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedLink, setSavedLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const [existingListing, setExistingListing] = useState(null)

  const gwId = sponsorId ? `GW${sponsorId}` : null

  // Загрузка существующего листинга при открытии модалки
  useEffect(() => {
    if (!showModal || !gwId || !item?.id) return
    const load = async () => {
      try {
        const res = await fetch(`/api/partner-listing?gwId=${gwId}&itemId=${item.id}`)
        const data = await res.json()
        if (data.ok && data.listings?.length > 0) {
          const existing = data.listings[0]
          setExistingListing(existing)
          if (existing.is_negotiable) {
            setIsNegotiable(true)
            setPrice('')
          } else {
            setPrice(String(existing.price || ''))
            setIsNegotiable(false)
          }
          // Если уже есть — сразу показываем ссылку
          setSavedLink(`${SITE_URL}/show/${item.id}?ref=${gwId}`)
        }
      } catch {}
    }
    load()
  }, [showModal, gwId, item?.id])

  if (!wallet || !sponsorId) return null
  if (!item || item.status !== 'active') return null

  const clubPrice = parseFloat(item.club_price) || 0

  const handleSave = async () => {
    if (!isNegotiable) {
      const p = parseFloat(price)
      if (!p || p < clubPrice) {
        addNotification?.(`❌ Цена не может быть ниже клубной (${formatUSD(clubPrice)})`)
        return
      }
    }

    setSaving(true)
    try {
      const res = await authFetch('/api/partner-listing', {
        method: 'POST',
        body: {
          wallet,
          gwId,
          itemId: item.id,
          price: isNegotiable ? null : parseFloat(price),
          isNegotiable,
        }
      })
      const data = await res.json()
      if (data.ok) {
        const link = `${SITE_URL}/show/${item.id}?ref=${gwId}`
        setSavedLink(link)
        addNotification?.('✅ Ссылка готова! Отправьте друзьям.')
      } else {
        addNotification?.(`❌ ${data.error || 'Ошибка сохранения'}`)
      }
    } catch (e) {
      addNotification?.(`❌ ${e.message || 'Ошибка сети'}`)
    } finally {
      setSaving(false)
    }
  }

  const copyLink = () => {
    if (!savedLink) return
    if (navigator.clipboard) {
      navigator.clipboard.writeText(savedLink).then(() => setCopied(true)).catch(() => {})
    } else {
      const ta = document.createElement('textarea')
      ta.value = savedLink
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
    }
    setTimeout(() => setCopied(false), 2000)
  }

  const shareText = `💎 ${item.title}${!isNegotiable && price ? ` — $${Number(price).toLocaleString('en-US')}` : ''}\n\nЭксклюзивная клубная цена! Экономия от розничной стоимости. Подробности:`

  const shareLinks = savedLink ? {
    tg: `https://t.me/share/url?url=${encodeURIComponent(savedLink)}&text=${encodeURIComponent(shareText)}`,
    wa: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${savedLink}`)}`,
    vb: `viber://forward?text=${encodeURIComponent(`${shareText}\n${savedLink}`)}`,
  } : {}

  return (
    <>
      {/* Кнопка на карточке */}
      <button onClick={() => { setShowModal(true); setCopied(false) }}
        className="w-full py-2.5 rounded-xl text-[11px] font-bold transition-all mt-2"
        style={{
          background: 'rgba(168,85,247,0.1)',
          border: '1px solid rgba(168,85,247,0.25)',
          color: '#a855f7'
        }}>
        📢 Хочу продавать
      </button>

      {/* Модалка */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 z-[70] flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}>
          <div className="w-full max-w-sm p-5 rounded-3xl space-y-4"
            style={{ background: '#12122a', border: '1px solid rgba(168,85,247,0.3)' }}
            onClick={e => e.stopPropagation()}>

            {/* Заголовок */}
            <div className="text-center">
              <div className="text-3xl mb-2">📢</div>
              <div className="text-[15px] font-black text-white">Продавать: {item.title}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Клубная цена: <span className="text-gold-400 font-bold">{formatUSD(clubPrice)}</span>
              </div>
            </div>

            {!savedLink ? (
              <>
                {/* Переключатель "Договорная" */}
                <button onClick={() => setIsNegotiable(!isNegotiable)}
                  className={`w-full py-3 rounded-xl text-[12px] font-bold border transition-all ${
                    isNegotiable
                      ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                      : 'bg-white/5 border-white/10 text-slate-500'
                  }`}>
                  {isNegotiable ? '✅ Цена: Договорная' : '💬 Сделать цену договорной'}
                </button>

                {/* Ввод цены */}
                {!isNegotiable && (
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block font-bold">
                      Ваша цена ($) — не ниже {formatUSD(clubPrice)}
                    </label>
                    <input
                      type="number"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder={String(clubPrice)}
                      className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-[14px] font-bold outline-none"
                    />
                    {price && parseFloat(price) > clubPrice && (
                      <div className="text-[10px] text-emerald-400 mt-2">
                        💰 Ваша прибыль: <span className="font-bold">
                          {formatUSD(parseFloat(price) - clubPrice)}
                        </span> с каждой продажи
                      </div>
                    )}
                  </div>
                )}

                {/* Инфо */}
                <div className="p-3 rounded-xl bg-white/3 border border-white/8 text-[10px] text-slate-400 leading-relaxed space-y-1">
                  <div>📌 Вы получаете ссылку на личный лендинг этого товара</div>
                  <div>📤 Отправляете друзьям — они оставляют заявку</div>
                  <div>📥 Заявки приходят вам в кабинет</div>
                  <div>💰 Всё что выше клубной цены — ваша прибыль</div>
                </div>

                <button onClick={handleSave} disabled={saving || (!isNegotiable && (!price || parseFloat(price) < clubPrice))}
                  className="w-full py-3.5 rounded-xl text-[13px] font-black disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff' }}>
                  {saving ? '⏳ Сохраняю...' : '🔗 Получить ссылку'}
                </button>
              </>
            ) : (
              <>
                {/* Ссылка готова */}
                <div className="p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-center">
                  <div className="text-[12px] text-emerald-400 font-bold mb-2">✅ Ссылка готова!</div>
                  <div className="p-2 rounded-lg bg-black/30 text-[9px] text-white break-all font-mono mb-3">
                    {savedLink}
                  </div>
                  <button onClick={copyLink}
                    className="w-full py-2.5 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    {copied ? '✅ Скопировано!' : '📋 Копировать ссылку'}
                  </button>
                </div>

                {/* Кнопки шеринга */}
                <div className="grid grid-cols-3 gap-2">
                  <a href={shareLinks.tg} target="_blank" rel="noopener noreferrer"
                    className="py-3 rounded-xl text-[11px] font-bold text-center"
                    style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6' }}>
                    📱 Telegram
                  </a>
                  <a href={shareLinks.wa} target="_blank" rel="noopener noreferrer"
                    className="py-3 rounded-xl text-[11px] font-bold text-center"
                    style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>
                    💬 WhatsApp
                  </a>
                  <a href={shareLinks.vb} target="_blank" rel="noopener noreferrer"
                    className="py-3 rounded-xl text-[11px] font-bold text-center"
                    style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#a855f7' }}>
                    📞 Viber
                  </a>
                </div>

                {/* Изменить цену */}
                <button onClick={() => { setSavedLink(null); setCopied(false) }}
                  className="w-full py-2 rounded-xl text-[10px] text-slate-500 border border-white/8">
                  ✏️ Изменить цену
                </button>
              </>
            )}

            {/* Закрыть */}
            <button onClick={() => setShowModal(false)}
              className="w-full py-2.5 rounded-xl text-[11px] font-bold text-slate-500 border border-white/8">
              Закрыть
            </button>
          </div>
        </div>
      )}
    </>
  )
}
