'use client'
/**
 * HelpButton — кнопка "?" с модальным окном подсказки
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
        className={`w-7 h-7 rounded-full bg-gold-400/15 border border-gold-400/25 text-gold-400 text-[12px] font-bold flex items-center justify-center hover:bg-gold-400/25 transition-all ${className}`}
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setOpen(false)}>
          <div className="max-w-[420px] w-full max-h-[80vh] rounded-3xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{ background: 'linear-gradient(180deg, #1a1040, #0c0c1e)', border: '1px solid rgba(212,168,67,0.2)' }}>
            
            {/* Header */}
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-black text-gold-400">{help.title}</div>
                <button onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 text-slate-400 flex items-center justify-center hover:bg-white/10 text-[14px]">
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 60px)' }}>
              <div className="text-[12px] text-slate-300 leading-relaxed whitespace-pre-line">
                {help.text}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
