'use client'
/**
 * MediaLightbox — полноэкранный просмотр фото и видео со свайпом.
 *
 * Надёжен в WebView (Portal + JS-высота, как модалка условий).
 * items: [{ type: 'photo'|'video', url }]
 * Листание: свайп пальцем, стрелки ‹ ›, точки снизу. Видео YouTube/Shorts — встроенный плеер.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// id YouTube из обычной ссылки, youtu.be, embed И shorts
export function ytId(url) {
  return url?.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)?.[1] || null
}

export default function MediaLightbox({ items, startIndex = 0, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const [screenH, setScreenH] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [touchX, setTouchX] = useState(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const update = () => setScreenH(window.innerHeight)
    update()
    window.addEventListener('resize', update)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('resize', update); document.body.style.overflow = '' }
  }, [])

  if (!mounted || !items?.length) return null

  const item = items[Math.max(0, Math.min(idx, items.length - 1))]
  const prev = (e) => { e?.stopPropagation(); setIdx(i => (i - 1 + items.length) % items.length) }
  const next = (e) => { e?.stopPropagation(); setIdx(i => (i + 1) % items.length) }

  const onTouchStart = (e) => setTouchX(e.touches[0].clientX)
  const onTouchEnd = (e) => {
    if (touchX === null) return
    const dx = e.changedTouches[0].clientX - touchX
    if (dx > 50) prev()
    else if (dx < -50) next()
    setTouchX(null)
  }

  const renderItem = () => {
    if (item.type === 'video') {
      const id = ytId(item.url)
      if (id) {
        return (
          <div style={{ width: '100%', maxWidth: 500, aspectRatio: '9/16', maxHeight: '80%' }}>
            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${id}`}
              title="video" frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen
              style={{ borderRadius: 12 }} />
          </div>
        )
      }
      // не-YouTube (TikTok и пр.) — кнопка открыть
      return (
        <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          className="px-5 py-3 rounded-xl text-[14px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)' }}>
          ▶️ Открыть видео
        </a>
      )
    }
    return <img src={item.url} alt="" style={{ maxWidth: '100%', maxHeight: '85%', objectFit: 'contain', borderRadius: 8 }} />
  }

  const content = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.95)', height: screenH ? `${screenH}px` : '100vh' }}
      onClick={onClose} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* Закрыть */}
      <button onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl z-10"
        style={{ background: 'rgba(255,255,255,0.15)' }}>✕</button>

      {/* Счётчик */}
      {items.length > 1 && (
        <div className="absolute top-5 left-4 text-[13px] font-bold text-white/80 z-10">
          {idx + 1} / {items.length}
        </div>
      )}

      {/* Стрелки */}
      {items.length > 1 && (
        <>
          <button onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white text-2xl z-10"
            style={{ background: 'rgba(255,255,255,0.15)' }}>‹</button>
          <button onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white text-2xl z-10"
            style={{ background: 'rgba(255,255,255,0.15)' }}>›</button>
        </>
      )}

      {/* Медиа */}
      <div className="flex items-center justify-center w-full px-2" onClick={(e) => e.stopPropagation()}>
        {renderItem()}
      </div>

      {/* Точки */}
      {items.length > 1 && (
        <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-1.5 z-10">
          {items.map((_, i) => (
            <div key={i} className="rounded-full" style={{
              width: i === idx ? 18 : 7, height: 7,
              background: i === idx ? '#38bdf8' : 'rgba(255,255,255,0.4)', transition: 'width .2s',
            }} />
          ))}
        </div>
      )}
    </div>
  )

  return createPortal(content, document.body)
}
