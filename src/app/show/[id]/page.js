'use client'
/**
 * /show/[id]/page.js — Публичный лендинг одного товара Diamond Club
 *
 * URL: /show/[id]?ref=GW9729645
 *
 * Что делает:
 *   1. Подгружает товар из dc_showcase по id
 *   2. Если есть ?ref — подгружает цену партнёра из dc_partner_listings
 *   3. Показывает красивую витрину с фото, описанием, ценой
 *   4. Форма "Оставить заявку" (имя + мессенджер + контакт)
 *   5. При отправке дублирует заявку:
 *      - в cgift.club/api/viral-registration (общий CRM gwad.ink)
 *      - в /api/buyer-request (Diamond Club кабинет партнёра)
 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

// Мессенджеры как на gwad.ink/register
const MESSENGERS = [
  { id: 'telegram', icon: '📱', label: 'Telegram',
    validate: v => /^@[a-zA-Z0-9_]{3,32}$/.test(v) || /^\+\d{10,15}$/.test(v),
    placeholder: '@username или +380...' },
  { id: 'whatsapp', icon: '💬', label: 'WhatsApp',
    validate: v => /^\+\d{10,15}$/.test(v),
    placeholder: '+380987654321' },
  { id: 'viber', icon: '📞', label: 'Viber',
    validate: v => /^\+\d{10,15}$/.test(v),
    placeholder: '+380987654321' },
  { id: 'phone', icon: '☎️', label: 'Звонок',
    validate: v => /^\+\d{10,15}$/.test(v),
    placeholder: '+380987654321' },
  { id: 'email', icon: '✉️', label: 'Email',
    validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    placeholder: 'name@example.com' },
]

function getYouTubeEmbedUrl(url) {
  if (!url) return null
  let videoId = null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) {
      videoId = u.searchParams.get('v')
      if (!videoId && u.pathname.startsWith('/shorts/')) {
        videoId = u.pathname.split('/shorts/')[1]?.split(/[?&#]/)[0]
      }
    } else if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1).split(/[?&#]/)[0]
    }
  } catch {}
  if (!videoId) return null
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`
}

function normalizeGwId(raw) {
  if (!raw) return null
  const clean = String(raw).replace(/[^\w]/g, '').slice(0, 20).toUpperCase()
  const digits = clean.replace(/^GW/, '')
  if (!digits || !/^\d+$/.test(digits)) return null
  return 'GW' + digits
}

export default function ShowPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const itemId = parseInt(params.id)
  const ref = normalizeGwId(searchParams.get('ref'))

  const [item, setItem] = useState(null)
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [messenger, setMessenger] = useState('telegram')
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Загрузка товара + цены партнёра
  useEffect(() => {
    if (!itemId) {
      setError('Неверный ID товара')
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        // Товар
        const itemRes = await fetch(`/api/showcase?limit=100`)
        const itemData = await itemRes.json()
        if (!itemData.ok) throw new Error('Не удалось загрузить товар')
        const found = (itemData.items || []).find(i => i.id === itemId)
        if (!found) {
          setError('Товар не найден или снят с продажи')
          setLoading(false)
          return
        }
        setItem(found)

        // Цена партнёра
        if (ref) {
          const listRes = await fetch(`/api/partner-listing?gwId=${ref}&itemId=${itemId}`)
          const listData = await listRes.json()
          if (listData.ok && listData.listings && listData.listings.length > 0) {
            setListing(listData.listings[0])
          }
        }
      } catch (e) {
        setError(e.message || 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [itemId, ref])

  // Итоговая цена для отображения
  const displayPrice = (() => {
    if (listing) {
      if (listing.is_negotiable) return { label: 'Договорная', value: null, negotiable: true }
      if (listing.price) return { label: 'Цена', value: parseFloat(listing.price), negotiable: false }
    }
    if (item?.club_price) return { label: 'Клубная цена', value: parseFloat(item.club_price), negotiable: false }
    return { label: 'Цена', value: null, negotiable: true }
  })()

  const retailPrice = item?.retail_price ? parseFloat(item.retail_price) : null
  const savings = displayPrice.value && retailPrice
    ? Math.round((1 - displayPrice.value / retailPrice) * 100)
    : 0

  const currentMessenger = MESSENGERS.find(m => m.id === messenger) || MESSENGERS[0]

  const validateForm = () => {
    if (!name || name.trim().length < 2) return 'Введите ваше имя (минимум 2 символа)'
    if (!contact || contact.trim().length < 3) return 'Введите контакт'
    if (currentMessenger.validate && !currentMessenger.validate(contact.trim())) {
      return `Неверный формат. Пример: ${currentMessenger.placeholder}`
    }
    return null
  }

  const handleSubmit = async () => {
    const err = validateForm()
    if (err) { setFormError(err); return }
    setFormError('')
    setSubmitting(true)

    const payload = {
      action: 'submit',
      itemId,
      partnerGwId: ref,
      listingId: listing?.id,
      name: name.trim(),
      messenger,
      contact: contact.trim(),
      note: note.trim() || null,
      offeredPrice: displayPrice.value,
    }

    // Отправка параллельно в два сервера:
    // 1. Diamond Club - /api/buyer-request (свой)
    // 2. gwad.ink CRM - cgift.club/api/viral-registration (общий)
    const results = await Promise.allSettled([
      fetch('/api/buyer-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json()),

      fetch('https://cgift.club/api/viral-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrerId: ref || null,
          name: name.trim(),
          messenger,
          contact: contact.trim(),
          cardId: null,
          pushConsent: true,
          source: `gws.ink/show/${itemId}`,
          utm_campaign: `dc-show-${itemId}`,
          utm_source: 'dc-landing',
        }),
      }).then(r => r.json()).catch(() => ({ ok: false })),
    ])

    // Главное — наш Diamond Club endpoint
    const ourResult = results[0]
    if (ourResult.status === 'fulfilled' && ourResult.value?.ok) {
      setSubmitted(true)
    } else {
      const msg = ourResult.status === 'fulfilled'
        ? (ourResult.value?.error || 'Ошибка отправки')
        : 'Ошибка сети'
      setFormError(msg)
      setSubmitting(false)
    }
  }

  // ═══ Рендер ═══

  if (loading) {
    return (
      <div style={{minHeight: '100vh', background: '#0a0a20', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{color: '#888', fontSize: 14}}>Загрузка...</div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div style={{minHeight: '100vh', background: '#0a0a20', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        <div style={{textAlign: 'center', color: '#ccc'}}>
          <div style={{fontSize: 48, marginBottom: 16}}>💎</div>
          <div style={{fontSize: 16, color: '#fff', marginBottom: 8}}>{error || 'Товар не найден'}</div>
          <a href="/" style={{color: '#ffd700', fontSize: 14, textDecoration: 'none'}}>← На главную Diamond Club</a>
        </div>
      </div>
    )
  }

  const mainPhoto = (item.photos && item.photos[0]) || '/icons/logo.png'

  return (
    <div style={{minHeight: '100vh', background: 'linear-gradient(180deg, #0a0a20 0%, #1a1040 50%, #0a0a20 100%)'}}>
      <div style={{maxWidth: 480, margin: '0 auto', padding: '20px 16px 40px'}}>

        {/* Шапка */}
        <div style={{textAlign: 'center', marginBottom: 20}}>
          <div style={{fontSize: 11, color: '#ffd700', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700}}>
            💎 Diamond Club
          </div>
        </div>

        {/* Фото */}
        <div style={{
          borderRadius: 20, overflow: 'hidden', marginBottom: 20,
          border: '2px solid rgba(255,215,0,0.15)',
          background: '#141428', aspectRatio: '1/1',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <img src={mainPhoto} alt={item.title}
               style={{width: '100%', height: '100%', objectFit: 'cover'}}
               onError={e => { e.target.style.display = 'none' }} />
        </div>

        {/* Дополнительные фото (если есть) */}
        {item.photos && item.photos.length > 1 && (
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20}}>
            {item.photos.slice(1, 4).map((p, i) => (
              <div key={i} style={{aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', background: '#141428', border: '1px solid #2a2a4a'}}>
                <img src={p} alt="" style={{width: '100%', height: '100%', objectFit: 'cover'}} onError={e => { e.target.style.display = 'none' }} />
              </div>
            ))}
          </div>
        )}

        {/* Название */}
        <h1 style={{color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 12, lineHeight: 1.3}}>
          {item.title}
        </h1>

        {/* Характеристики */}
        {(item.carat || item.shape || item.clarity || item.color) && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20
          }}>
            {item.carat && <Tag label="Карат" value={item.carat} />}
            {item.shape && <Tag label="Огранка" value={item.shape} />}
            {item.color && <Tag label="Цвет" value={item.color} />}
            {item.clarity && <Tag label="Чистота" value={item.clarity} />}
          </div>
        )}

        {/* Цена */}
        <div style={{
          padding: 18, borderRadius: 16, marginBottom: 16,
          background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,215,0,0.02))',
          border: '1px solid rgba(255,215,0,0.25)',
        }}>
          {displayPrice.negotiable ? (
            <>
              <div style={{fontSize: 11, color: '#888', marginBottom: 4}}>Цена:</div>
              <div style={{fontSize: 28, fontWeight: 800, color: '#ffd700'}}>Договорная</div>
              <div style={{fontSize: 12, color: '#aaa', marginTop: 6}}>Обсуждаем индивидуально</div>
            </>
          ) : (
            <>
              <div style={{fontSize: 11, color: '#888', marginBottom: 4}}>{displayPrice.label}:</div>
              <div style={{fontSize: 32, fontWeight: 800, color: '#ffd700'}}>
                ${Number(displayPrice.value).toLocaleString('en-US')}
              </div>
              {retailPrice && savings > 0 && (
                <div style={{marginTop: 8, fontSize: 13}}>
                  <span style={{color: '#888', textDecoration: 'line-through'}}>
                    ${Number(retailPrice).toLocaleString('en-US')}
                  </span>
                  <span style={{color: '#10b981', fontWeight: 700, marginLeft: 10}}>
                    −{savings}%
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Описание */}
        {item.description && (
          <div style={{
            padding: 16, borderRadius: 14, marginBottom: 16,
            background: '#141428', border: '1px solid #2a2a4a',
            fontSize: 13, color: '#ccc', lineHeight: 1.7
          }}>
            {item.description}
          </div>
        )}

        {/* Сертификат */}
        {item.cert_url && (
          <a href={item.cert_url} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 16px', borderRadius: 12, marginBottom: 16,
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
            color: '#10b981', fontSize: 13, fontWeight: 600, textDecoration: 'none'
          }}>
            📜 Посмотреть сертификат
          </a>
        )}

        {/* Видео — YouTube встраивается, остальное как ссылка */}
        {item.video_url && (() => {
          const embedUrl = getYouTubeEmbedUrl(item.video_url)
          if (embedUrl) {
            return (
              <div style={{
                position: 'relative', paddingBottom: '56.25%', height: 0,
                borderRadius: 16, overflow: 'hidden', marginBottom: 16,
                border: '1px solid rgba(168,85,247,0.25)'
              }}>
                <iframe src={embedUrl} allowFullScreen
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} />
              </div>
            )
          }
          return (
            <a href={item.video_url} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 16px', borderRadius: 12, marginBottom: 16,
              background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)',
              color: '#a855f7', fontSize: 13, fontWeight: 600, textDecoration: 'none'
            }}>
              🎬 Смотреть видео
            </a>
          )
        })()}

        {/* Форма или «Спасибо» */}
        {submitted ? (
          <div style={{
            padding: 24, borderRadius: 16, textAlign: 'center',
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)'
          }}>
            <div style={{fontSize: 40, marginBottom: 10}}>✅</div>
            <div style={{color: '#10b981', fontWeight: 800, fontSize: 17, marginBottom: 6}}>
              Заявка отправлена!
            </div>
            <div style={{color: '#ccc', fontSize: 13, lineHeight: 1.6}}>
              {ref
                ? 'Продавец скоро свяжется с вами для обсуждения деталей.'
                : 'Менеджер Diamond Club свяжется с вами в ближайшее время.'}
            </div>
          </div>
        ) : (
          <div style={{
            padding: 20, borderRadius: 16,
            background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.2)'
          }}>
            <div style={{fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4, textAlign: 'center'}}>
              💎 Хочу купить
            </div>
            <div style={{fontSize: 11, color: '#888', marginBottom: 16, textAlign: 'center', lineHeight: 1.5}}>
              Оставьте контакт — с вами свяжутся для обсуждения
            </div>

            {/* Имя */}
            <div style={{marginBottom: 12}}>
              <label style={{fontSize: 11, color: '#888', marginBottom: 4, display: 'block', fontWeight: 600}}>Ваше имя *</label>
              <input
                value={name}
                onChange={e => { setName(e.target.value); setFormError('') }}
                placeholder="Иван Петров"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a',
                  color: '#fff', fontSize: 14, outline: 'none'
                }}
              />
            </div>

            {/* Мессенджер */}
            <div style={{marginBottom: 12}}>
              <label style={{fontSize: 11, color: '#888', marginBottom: 6, display: 'block', fontWeight: 600}}>Способ связи *</label>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6}}>
                {MESSENGERS.map(m => (
                  <button key={m.id} onClick={() => setMessenger(m.id)}
                    style={{
                      padding: '10px 4px', borderRadius: 10, cursor: 'pointer',
                      background: messenger === m.id ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${messenger === m.id ? '#ffd700' : '#2a2a4a'}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
                    }}>
                    <div style={{fontSize: 18}}>{m.icon}</div>
                    <div style={{fontSize: 8, color: messenger === m.id ? '#ffd700' : '#888', fontWeight: 600}}>{m.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Контакт */}
            <div style={{marginBottom: 12}}>
              <label style={{fontSize: 11, color: '#888', marginBottom: 4, display: 'block', fontWeight: 600}}>
                {currentMessenger.label} *
              </label>
              <input
                value={contact}
                onChange={e => { setContact(e.target.value); setFormError('') }}
                placeholder={currentMessenger.placeholder}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a',
                  color: '#fff', fontSize: 14, outline: 'none'
                }}
              />
            </div>

            {/* Комментарий (опционально) */}
            <div style={{marginBottom: 12}}>
              <label style={{fontSize: 11, color: '#888', marginBottom: 4, display: 'block', fontWeight: 600}}>
                Комментарий <span style={{color: '#555'}}>(опционально)</span>
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Хочу такое же, но с другой огранкой..."
                rows={2}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a',
                  color: '#fff', fontSize: 13, outline: 'none', resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {formError && (
              <div style={{
                padding: 10, borderRadius: 8, marginBottom: 10,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444', fontSize: 12, textAlign: 'center'
              }}>❌ {formError}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%', padding: 16, borderRadius: 14,
                background: submitting ? '#666' : 'linear-gradient(135deg, #ffd700, #f5a623)',
                color: '#000', fontSize: 16, fontWeight: 800,
                border: 'none', cursor: submitting ? 'wait' : 'pointer'
              }}
            >
              {submitting ? '⏳ Отправка...' : '💎 Отправить заявку'}
            </button>

            <div style={{fontSize: 10, color: '#555', textAlign: 'center', marginTop: 10, lineHeight: 1.5}}>
              🔒 Контакт используется только для связи о покупке
            </div>
          </div>
        )}

        {/* Футер */}
        <div style={{textAlign: 'center', marginTop: 24, fontSize: 10, color: '#444'}}>
          {ref && <div style={{marginBottom: 4}}>Спонсор: {ref}</div>}
          Diamond Club • Powered by GlobalWay
        </div>
      </div>
    </div>
  )
}

function Tag({ label, value }) {
  return (
    <div style={{
      display: 'inline-flex', gap: 6, alignItems: 'center',
      padding: '6px 12px', borderRadius: 10,
      background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a4a',
      fontSize: 12
    }}>
      <span style={{color: '#888'}}>{label}:</span>
      <span style={{color: '#fff', fontWeight: 600}}>{value}</span>
    </div>
  )
}
