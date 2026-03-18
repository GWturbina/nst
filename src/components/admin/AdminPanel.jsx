'use client'
import { useState } from 'react'
import useGameStore from '@/lib/store'
import OrdersAdmin, { StaffAdmin } from '@/components/admin/OrdersAdmin'
import PriceAdmin from '@/components/admin/PriceAdmin'

export default function AdminPanel() {
  const { wallet, isAdmin, ownerWallet, addNotification,
    news, quests, addNews, removeNews, addQuest, removeQuest, setLevel, t } = useGameStore()

  const [activeSection, setActiveSection] = useState('content')
  const [newNews, setNewNews] = useState('')
  const [newQuest, setNewQuest] = useState({ name: '', reward: '' })

  const isOwner = isAdmin || (wallet && ownerWallet && wallet.toLowerCase() === ownerWallet.toLowerCase())

  const SECTIONS = [
    { id: 'content', icon: '📢', label: 'Контент' },
    { id: 'orders', icon: '📋', label: 'Заказы' },
    { id: 'staff', icon: '👥', label: 'Сотрудники' },
    { id: 'prices', icon: '💲', label: 'Цены' },
    { id: 'test', icon: '🎮', label: 'Тест' },
  ]

  if (!isOwner) {
    return (
      <div className="p-6 text-center">
        <div className="text-3xl mb-2">🔒</div>
        <div className="text-sm text-slate-400">Только для администратора</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <div className="px-3 pt-3 pb-1">
        <h2 className="text-lg font-black text-gold-400">⚙️ Админ Diamond Club</h2>
      </div>

      <div className="flex gap-1 px-3 mt-1 overflow-x-auto scrollbar-hide">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`px-3 py-2 rounded-xl text-[10px] font-bold border whitespace-nowrap ${activeSection === s.id ? 'bg-gold-400/15 border-gold-400/30 text-gold-400' : 'border-white/8 text-slate-500'}`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="px-3 mt-3">
        {/* КОНТЕНТ */}
        {activeSection === 'content' && (
          <div className="space-y-3">
            <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-[12px] font-bold text-gold-400 mb-2">📢 Новости</div>
              <div className="space-y-1">
                {news.map((n, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-[11px] border-b border-white/5">
                    <span className="flex-1 text-white">{n}</span>
                    <button onClick={() => removeNews(i)} className="text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input value={newNews} onChange={e => setNewNews(e.target.value)}
                  placeholder="Текст новости..." className="flex-1 p-2 rounded-lg bg-white/5 text-[11px] text-white outline-none" />
                <button onClick={() => { if (newNews.trim()) { addNews(newNews.trim()); setNewNews('') } }}
                  className="px-3 py-2 rounded-lg text-[10px] font-bold gold-btn">+</button>
              </div>
            </div>

            <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-[12px] font-bold text-emerald-400 mb-2">🎯 Квесты</div>
              <div className="space-y-1">
                {quests.map((q, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-[11px] border-b border-white/5">
                    <span className={`flex-1 ${q.done ? 'text-emerald-400 line-through' : 'text-white'}`}>{q.name}</span>
                    <span className="text-gold-400 text-[10px]">{q.reward}</span>
                    <button onClick={() => removeQuest(i)} className="text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input value={newQuest.name} onChange={e => setNewQuest(q => ({ ...q, name: e.target.value }))}
                  placeholder="Квест..." className="flex-1 p-2 rounded-lg bg-white/5 text-[11px] text-white outline-none" />
                <input value={newQuest.reward} onChange={e => setNewQuest(q => ({ ...q, reward: e.target.value }))}
                  placeholder="Награда" className="w-20 p-2 rounded-lg bg-white/5 text-[11px] text-white outline-none" />
                <button onClick={() => { if (newQuest.name.trim()) { addQuest({ ...newQuest, done: false }); setNewQuest({ name: '', reward: '' }) } }}
                  className="px-3 py-2 rounded-lg text-[10px] font-bold gold-btn">+</button>
              </div>
            </div>
          </div>
        )}

        {/* ЗАКАЗЫ */}
        {activeSection === 'orders' && <OrdersAdmin />}

        {/* СОТРУДНИКИ */}
        {activeSection === 'staff' && <StaffAdmin />}

        {/* ЦЕНЫ */}
        {activeSection === 'prices' && <PriceAdmin />}

        {/* ТЕСТ — переключение уровня */}
        {activeSection === 'test' && (
          <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-[12px] font-bold text-purple-400 mb-2">🎮 Тестирование</div>
            <div className="text-[10px] text-slate-500 mb-2">Быстрое переключение уровня (только визуально)</div>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 13 }, (_, i) => (
                <button key={i} onClick={() => setLevel(i)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 text-white hover:bg-white/5">
                  Lv.{i}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
