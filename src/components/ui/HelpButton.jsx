'use client'
/**
 * HelpButton — кнопка "?" с модальным окном подсказки
 * Поддерживает structured sections: { heading, text }
 * 
 * Использование:
 *   import HelpButton from '@/components/ui/HelpButton'
 *   <HelpButton section="lots" />
 *   <HelpButton section="gems" />
 */
import { useState } from 'react'
import HELP from '@/lib/helpTexts'

export default function HelpButton({ section, className = '' }) {
  const [open, setOpen] = useState(false)
  const help = HELP[section]
  if (!help) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-7 h-7 rounded-full bg-gold-400/15 border border-gold-400/25 text-gold-400 text-[12px] font-bold flex items-center justify-center hover:bg-gold-400/25 transition-all shrink-0 ${className}`}
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3" style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => setOpen(false)}>
          <div className="max-w-[430px] w-full max-h-[85vh] rounded-3xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ background: 'linear-gradient(180deg, #1a1040 0%, #0c0c1e 100%)', border: '1px solid rgba(212,168,67,0.2)' }}>
            
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between shrink-0">
              <div className="text-[14px] font-black text-gold-400 pr-2">{help.title}</div>
              <button onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 text-slate-400 flex items-center justify-center hover:bg-white/10 text-[14px] shrink-0">
                ✕
              </button>
            </div>

            {/* Content — structured sections */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {help.sections ? help.sections.map((s, i) => (
                <HelpSection key={i} heading={s.heading} text={s.text} defaultOpen={i === 0} />
              )) : (
                <div className="text-[12px] text-slate-300 leading-relaxed whitespace-pre-line">
                  {help.text}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/8 shrink-0">
              <button onClick={() => setOpen(false)}
                className="w-full py-2.5 rounded-xl text-[12px] font-bold gold-btn">
                ✅ Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function HelpSection({ heading, text, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-all"
        style={{ background: open ? 'rgba(212,168,67,0.08)' : 'rgba(255,255,255,0.03)' }}
      >
        <span className="text-[12px] font-bold" style={{ color: open ? '#d4a843' : '#94a3b8' }}>
          {heading}
        </span>
        <span className="text-[10px] text-slate-500 shrink-0 ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1">
          <div className="text-[11px] text-slate-300 leading-[1.7] whitespace-pre-line">
            {text}
          </div>
        </div>
      )}
    </div>
  )
}
