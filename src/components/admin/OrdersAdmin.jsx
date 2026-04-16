'use client'
/**
 * OrdersAdmin — Управление заказами Diamond Club
 *
 * Теперь показывает два типа заказов:
 *   - Заказы камней (order_type = 'stone', старая логика)
 *   - Заявки с витрины (order_type = 'showcase_request', новое)
 *
 * Отдельная вкладка-переключатель в шапке.
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import * as Orders from '@/lib/dcOrders'
import { shortAddress } from '@/lib/web3'

// ═══════════════════════════════════════════════════
// ORDERS ADMIN
// ═══════════════════════════════════════════════════
export default function OrdersAdmin() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [orders, setOrders] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(null) // null = все
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'stone' | 'showcase_request'
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderLog, setOrderLog] = useState([])
  const [noteText, setNoteText] = useState('')
  const [adminRole, setAdminRole] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const [o, c, role] = await Promise.all([
      Orders.getAllOrders(filter),
      Orders.getOrderCounts(),
      Orders.getAdminRole(wallet),
    ])
    setOrders(o); setCounts(c); setAdminRole(role)
    setLoading(false)
  }, [wallet, filter])

  useEffect(() => { reload() }, [reload])

  const loadLog = async (orderId) => {
    const log = await Orders.getOrderLog(orderId)
    setOrderLog(log)
  }

  const handleStatusChange = async (orderId, newStatus, note = '') => {
    setTxPending(true)
    const result = await Orders.updateOrderStatus(orderId, newStatus, wallet, note)
    setTxPending(false)
    if (result.ok) { addNotification(`✅ Заказ #${orderId} → ${Orders.STATUS_LABELS[newStatus] || newStatus}`); reload(); if (selectedOrder?.id === orderId) loadLog(orderId) }
    else addNotification(`❌ ${result.error}`)
  }

  const handleAddNote = async (orderId) => {
    if (!noteText.trim()) return
    const result = await Orders.addAdminNote(orderId, wallet, noteText.trim())
    if (result.ok) { addNotification('✅ Заметка добавлена'); setNoteText(''); reload(); loadLog(orderId) }
    else addNotification(`❌ ${result.error}`)
  }

  const FILTERS = [
    { id: null, label: 'Все', count: Object.values(counts).reduce((s,v)=>s+v, 0) },
    { id: 'NEW', label: '🆕 Новые', count: counts.NEW || 0 },
    { id: 'CONTACTED', label: '📞 Связались', count: counts.CONTACTED || 0 },
    { id: 'PAID', label: '💰 Оплачен', count: counts.PAID || 0 },
    { id: 'APPROVED', label: '✅ Утверждён', count: counts.APPROVED || 0 },
    { id: 'PRODUCTION', label: '🏭 Производство', count: counts.PRODUCTION || 0 },
    { id: 'READY', label: '📦 Готов', count: counts.READY || 0 },
    { id: 'COMPLETED', label: '🎉 Выдан', count: counts.COMPLETED || 0 },
    { id: 'CANCELLED', label: '❌ Отменён', count: counts.CANCELLED || 0 },
  ]

  // Считаем по типу (для таба)
  const shownOrders = orders.filter(o => {
    if (typeFilter === 'all') return true
    const t = o.order_type || 'stone'
    return t === typeFilter
  })

  const stoneCount = orders.filter(o => (o.order_type || 'stone') === 'stone').length
  const showcaseCount = orders.filter(o => o.order_type === 'showcase_request').length

  if (loading) return <div className="px-3 mt-2 text-center py-8"><div className="text-2xl animate-spin">💎</div></div>

  return (
    <div className="px-3 mt-2 space-y-2">

      {/* Роль */}
      <div className="p-2 rounded-xl glass text-center">
        <span className="text-[10px] text-slate-500">Ваша роль: </span>
        <span className={`text-[11px] font-bold ${adminRole === 'owner' ? 'text-gold-400' : adminRole === 'manager' ? 'text-emerald-400' : 'text-blue-400'}`}>
          {adminRole === 'owner' ? '👑 Владелец' : adminRole === 'manager' ? '🔑 Менеджер' : adminRole === 'operator' ? '👁 Оператор' : '❌ Нет доступа'}
        </span>
      </div>

      {/* Переключатель типов: камни / заявки с витрины */}
      <div className="flex gap-1">
        {[
          { id: 'all', label: `📋 Все (${orders.length})` },
          { id: 'stone', label: `💎 Камни (${stoneCount})` },
          { id: 'showcase_request', label: `🏪 Витрина (${showcaseCount})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTypeFilter(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
              typeFilter === t.id ? 'bg-gold-400/15 border-gold-400/30 text-gold-400' : 'border-white/8 text-slate-500'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Фильтры по статусу */}
      <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button key={f.id || 'all'} onClick={() => setFilter(f.id)}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
              filter === f.id ? 'bg-gold-400/15 border-gold-400/30 text-gold-400' : 'border-white/8 text-slate-500'
            }`}>
            {f.label} {f.count > 0 && <span className="ml-0.5 opacity-70">({f.count})</span>}
          </button>
        ))}
      </div>

      {/* Список заказов */}
      {shownOrders.length === 0 ? (
        <div className="p-6 rounded-2xl glass text-center">
          <div className="text-3xl mb-2">📋</div>
          <div className="text-[12px] text-slate-400">Нет заказов</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {shownOrders.map(o => {
            const isShowcase = o.order_type === 'showcase_request'
            return (
              <div key={o.id} className={`p-3 rounded-xl glass cursor-pointer active:scale-[0.98] transition-transform ${isShowcase ? 'border border-purple-500/20' : ''}`}
                onClick={() => { setSelectedOrder(o); loadLog(o.id) }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-black text-white">#{o.id}</span>
                    {isShowcase && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">🏪 Витрина</span>}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${Orders.STATUS_COLORS[o.status] || 'text-slate-400'} bg-white/5`}>
                      {Orders.STATUS_LABELS[o.status] || o.status}
                    </span>
                  </div>
                  <div className="text-[12px] font-black text-gold-400">${parseFloat(o.club_price || 0).toFixed(0)}</div>
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-500">
                  <span>
                    👤 {shortAddress(o.wallet)}
                    {isShowcase
                      ? ` • ${o.spec_string || 'заявка с витрины'}`
                      : ` • ${o.carats}ct ${o.shape || ''} ${o.quality_tier === 'premium' ? '👑' : ''} ${o.has_cert ? '✅серт' : ''}`}
                  </span>
                  <span>{new Date(o.created_at).toLocaleDateString()}</span>
                </div>
                {o.is_fraction && (
                  <div className="text-[9px] text-purple-400 mt-0.5">🧩 Доля: {o.fraction_count}/{o.total_fractions}</div>
                )}
                {isShowcase && o.buyer_note && (
                  <div className="text-[9px] text-slate-400 mt-1 italic truncate">💬 {o.buyer_note}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Детальный просмотр заказа */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3" onClick={() => setSelectedOrder(null)}>
          <div className="w-full max-w-md max-h-[90vh] rounded-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
            style={{ background: 'linear-gradient(180deg, #1a1a3e 0%, #0f0f2a 100%)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 sticky top-0"
              style={{ background: '#1a1a3e' }}>
              <div>
                <div className="text-[14px] font-black text-white flex items-center gap-2">
                  Заказ #{selectedOrder.id}
                  {selectedOrder.order_type === 'showcase_request' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">🏪 Витрина</span>
                  )}
                </div>
                <div className={`text-[10px] font-bold ${Orders.STATUS_COLORS[selectedOrder.status] || 'text-slate-400'}`}>
                  {Orders.STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-500 text-lg">✕</button>
            </div>

            <div className="p-4 space-y-3">
              {/* Покупатель */}
              <div className="p-2.5 rounded-xl bg-white/5">
                <div className="text-[10px] text-slate-500 mb-1">{selectedOrder.order_type === 'showcase_request' ? 'Покупатель' : 'Партнёр'}</div>
                <div className="text-[11px] font-mono text-white break-all">{selectedOrder.wallet}</div>
              </div>

              {/* Ветка для заявки с витрины */}
              {selectedOrder.order_type === 'showcase_request' ? (
                <>
                  {selectedOrder.showcase_item_id && (
                    <div className="p-2.5 rounded-xl bg-purple-500/8 border border-purple-500/15">
                      <div className="text-[10px] text-purple-400 font-bold mb-1">🏪 Товар с витрины</div>
                      <div className="text-[11px] text-white font-bold">{selectedOrder.spec_string}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        ID товара: <span className="font-mono">#{selectedOrder.showcase_item_id}</span>
                        {selectedOrder.carats > 0 && ` • ${selectedOrder.carats}ct`}
                        {selectedOrder.shape && ` • ${selectedOrder.shape}`}
                      </div>
                    </div>
                  )}
                  {selectedOrder.buyer_note && (
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-500 mb-1">💬 Сообщение от покупателя</div>
                      <div className="text-[11px] text-white">{selectedOrder.buyer_note}</div>
                    </div>
                  )}
                  <div className="p-2.5 rounded-xl bg-gold-400/8 border border-gold-400/20 text-center">
                    <div className="text-[9px] text-slate-400">Клубная цена</div>
                    <div className="text-[18px] font-black text-gold-400">${parseFloat(selectedOrder.club_price || 0).toFixed(0)}</div>
                  </div>
                </>
              ) : (
                <>
                  {/* Параметры камня (стандартный заказ) */}
                  <div className="p-2.5 rounded-xl bg-white/5">
                    <div className="text-[10px] text-slate-500 mb-1">Камень</div>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div>Тип: <span className="text-white font-bold">{selectedOrder.gem_type === 'white' ? 'Белый' : 'Цветной'}</span></div>
                      <div>Форма: <span className="text-white font-bold">{selectedOrder.shape}</span></div>
                      <div>Чистота: <span className="text-white font-bold">{selectedOrder.clarity}</span></div>
                      <div>Караты: <span className="text-white font-bold">{selectedOrder.carats}ct</span></div>
                      {selectedOrder.color && <div>Цвет: <span className="text-white font-bold">{selectedOrder.color}</span></div>}
                      {selectedOrder.fancy_color && <div>Цвет: <span className="text-white font-bold">{selectedOrder.fancy_color}</span></div>}
                      {selectedOrder.intensity && <div>Насыщенность: <span className="text-white font-bold">{selectedOrder.intensity}</span></div>}
                      <div>Сертификат: <span className="text-white font-bold">{selectedOrder.has_cert ? '✅ Да' : '❌ Нет'}</span></div>
                      <div>Уровень: <span className={`font-bold ${selectedOrder.quality_tier==='premium'?'text-gold-400':'text-blue-400'}`}>
                        {selectedOrder.quality_tier==='premium'?'👑 Высшая':'💎 Средняя'}</span></div>
                      <div>Регион: <span className="text-white font-bold">{selectedOrder.region}</span></div>
                      <div>Режим: <span className="text-white font-bold">{selectedOrder.buy_mode === 0 ? '📦 Покупка' : '⏳ Стейкинг'}</span></div>
                    </div>
                  </div>

                  {/* Цена */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-xl bg-white/5 text-center">
                      <div className="text-[10px] font-bold text-slate-400 line-through">${parseFloat(selectedOrder.retail_price).toFixed(0)}</div>
                      <div className="text-[8px] text-slate-500">Розница</div>
                    </div>
                    <div className="p-2 rounded-xl bg-gold-400/8 border border-gold-400/15 text-center">
                      <div className="text-[13px] font-black text-gold-400">${parseFloat(selectedOrder.club_price).toFixed(0)}</div>
                      <div className="text-[8px] text-gold-400/60">Клубная</div>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/8 text-center">
                      <div className="text-[10px] font-bold text-emerald-400">−${parseFloat(selectedOrder.savings).toFixed(0)}</div>
                      <div className="text-[8px] text-slate-500">−{selectedOrder.discount_pct}%</div>
                    </div>
                  </div>

                  {selectedOrder.is_fraction && (
                    <div className="p-2.5 rounded-xl bg-purple-500/8 border border-purple-500/15">
                      <div className="text-[10px] text-purple-400 font-bold">🧩 Долевая покупка</div>
                      <div className="text-[10px] text-slate-400">Долей: {selectedOrder.fraction_count} из {selectedOrder.total_fractions}</div>
                    </div>
                  )}
                </>
              )}

              {/* Заметка админа */}
              {selectedOrder.admin_note && (
                <div className="p-2.5 rounded-xl bg-blue-500/8 border border-blue-500/15">
                  <div className="text-[9px] text-blue-400 font-bold mb-1">💬 Заметка админа</div>
                  <div className="text-[10px] text-slate-300">{selectedOrder.admin_note}</div>
                </div>
              )}

              {/* Кнопки смены статуса */}
              {adminRole && adminRole !== 'operator' && Orders.STATUS_TRANSITIONS[selectedOrder.status]?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-500 font-bold">Действия:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Orders.STATUS_TRANSITIONS[selectedOrder.status].map(ns => (
                      <button key={ns} onClick={() => handleStatusChange(selectedOrder.id, ns)}
                        disabled={txPending}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold border ${
                          ns === 'CANCELLED' ? 'bg-red-500/15 text-red-400 border-red-500/20' :
                          ns === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' :
                          ns === 'COMPLETED' ? 'bg-gold-400/15 text-gold-400 border-gold-400/20' :
                          ns === 'CONTACTED' ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' :
                          'bg-blue-500/15 text-blue-400 border-blue-500/20'
                        }`}>
                        {txPending ? '⏳' : (Orders.STATUS_LABELS[ns] || ns)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {adminRole && (
                <div>
                  <div className="text-[10px] text-slate-500 font-bold mb-1">Добавить заметку:</div>
                  <div className="flex gap-2">
                    <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Заметка..."
                      className="flex-1 p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
                    <button onClick={() => handleAddNote(selectedOrder.id)} disabled={!noteText.trim()}
                      className="px-3 py-2 rounded-xl text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20"
                      style={{ opacity: noteText.trim() ? 1 : 0.5 }}>💬</button>
                  </div>
                </div>
              )}

              {orderLog.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 font-bold mb-1">История:</div>
                  <div className="space-y-1">
                    {orderLog.map(l => (
                      <div key={l.id} className="flex items-start gap-2 p-1.5 rounded-lg bg-white/3 text-[9px]">
                        <span className="text-slate-500 shrink-0">{new Date(l.created_at).toLocaleString()}</span>
                        <span className="text-slate-300">{l.action}: {l.details}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// STAFF ADMIN — Управление сотрудниками (без изменений)
// ═══════════════════════════════════════════════════
export function StaffAdmin() {
  const { wallet, addNotification } = useGameStore()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newWallet, setNewWallet] = useState('')
  const [newRole, setNewRole] = useState('operator')
  const [newName, setNewName] = useState('')
  const [newLimit, setNewLimit] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    const a = await Orders.getAllAdmins()
    setAdmins(a)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleAdd = async () => {
    if (!newWallet) return
    const result = await Orders.addAdmin(newWallet, newRole, newName, parseFloat(newLimit) || 0, wallet)
    if (result.ok) { addNotification(`✅ ${newName || shortAddress(newWallet)} добавлен как ${newRole}`); setShowAdd(false); setNewWallet(''); setNewName(''); setNewLimit(''); reload() }
    else addNotification(`❌ ${result.error}`)
  }

  const handleRemove = async (w) => {
    const result = await Orders.removeAdmin(w, wallet)
    if (result.ok) { addNotification('✅ Деактивирован'); reload() }
    else addNotification(`❌ ${result.error}`)
  }

  if (loading) return <div className="px-3 mt-2 text-center py-8"><div className="text-2xl animate-spin">💎</div></div>

  const ROLE_LABELS = { owner: '👑 Владелец', manager: '🔑 Менеджер', operator: '👁 Оператор' }
  const ROLE_COLORS = { owner: 'text-gold-400', manager: 'text-emerald-400', operator: 'text-blue-400' }

  return (
    <div className="px-3 mt-2 space-y-2">
      <div className="p-3 rounded-2xl glass">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] font-bold text-gold-400">👥 Сотрудники ({admins.length})</div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="text-[10px] font-bold text-blue-400">{showAdd ? '✕ Скрыть' : '+ Добавить'}</button>
        </div>

        {showAdd && (
          <div className="p-2.5 rounded-xl bg-white/5 space-y-2 mb-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Имя сотрудника"
              className="w-full p-2 rounded-lg bg-white/5 border border-white/8 text-[11px] text-white outline-none" />
            <input value={newWallet} onChange={e => setNewWallet(e.target.value)} placeholder="Адрес кошелька (0x...)"
              className="w-full p-2 rounded-lg bg-white/5 border border-white/8 text-[11px] text-white outline-none font-mono" />
            <div className="flex gap-1">
              {['operator', 'manager', 'owner'].map(r => (
                <button key={r} onClick={() => setNewRole(r)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold border ${newRole === r ? 'bg-gold-400/15 border-gold-400/30 text-gold-400' : 'border-white/8 text-slate-500'}`}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            {newRole === 'manager' && (
              <input type="number" value={newLimit} onChange={e => setNewLimit(e.target.value)} placeholder="Макс. сумма заказа (0 = без лимита)"
                className="w-full p-2 rounded-lg bg-white/5 border border-white/8 text-[11px] text-white outline-none text-center" />
            )}
            <button onClick={handleAdd} disabled={!newWallet}
              className="w-full py-2 rounded-xl text-[11px] font-bold gold-btn" style={{ opacity: newWallet ? 1 : 0.5 }}>
              + Добавить сотрудника
            </button>
          </div>
        )}

        {admins.length === 0 ? (
          <div className="text-[11px] text-slate-500 text-center py-3">Нет сотрудников. Добавьте себя первым!</div>
        ) : (
          <div className="space-y-1.5">
            {admins.map(a => (
              <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <div>
                  <span className="text-[11px] font-bold text-white">{a.name || shortAddress(a.wallet)}</span>
                  <span className={`text-[9px] font-bold ml-2 ${ROLE_COLORS[a.role]}`}>{ROLE_LABELS[a.role]}</span>
                  {!a.active && <span className="text-[9px] text-red-400 ml-2">неактивен</span>}
                  {a.max_amount > 0 && <span className="text-[8px] text-slate-500 ml-2">лимит ${a.max_amount}</span>}
                </div>
                {a.active && a.role !== 'owner' && (
                  <button onClick={() => handleRemove(a.wallet)}
                    className="px-2 py-1 rounded-lg text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2.5 rounded-2xl bg-white/3">
        <div className="text-[9px] text-slate-500 text-center leading-relaxed">
          <b className="text-white">👑 Владелец</b> — полные права<br/>
          <b className="text-white">🔑 Менеджер</b> — утверждает заказы (с лимитом суммы)<br/>
          <b className="text-white">👁 Оператор</b> — просматривает, пишет заметки
        </div>
      </div>
    </div>
  )
}
