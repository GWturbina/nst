'use client'
/**
 * dcOrders.js — Управление заказами камней Diamond Club
 * 
 * Партнёр: создать заказ, оплатить, просмотреть свои заказы
 * Админ: утвердить, сменить статус, добавить заметку
 * 
 * FIX #5: linkOrderToBlockchain, linkOrderToLot, addAdminNote, addAdmin, removeAdmin
 *         теперь через серверный API /api/admin (service_role), а не через anon Supabase
 * FIX #7: Все мутирующие запросы через authFetch (подпись кошелька)
 */
import supabase from './supabase'
import { authFetch } from './authClient'

// ═══════════════════════════════════════════════════
// ПАРТНЁР — Создание и просмотр заказов
// ═══════════════════════════════════════════════════

/**
 * Создать заказ камня
 * @param {string} wallet — кошелёк партнёра
 * @param {object} params — параметры камня из конфигуратора
 * @returns {object} { ok, order, error }
 */
export async function createOrder(wallet, params) {
  // FIX C2+C3+M4: Заказы создаются через серверный API (rate-limit + валидация)
  try {
    const res = await authFetch('/api/orders', {
      method: 'POST',
      body: { wallet, params },
    })
    const data = await res.json()
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Ошибка создания заказа' }
    }
    return { ok: true, order: data.order }
  } catch (e) {
    return { ok: false, error: e.message || 'Ошибка сети' }
  }
}

/**
 * Мои заказы
 */
export async function getMyOrders(wallet) {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('dc_orders')
      .select('*')
      .eq('wallet', wallet.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return data || []
  } catch { return [] }
}

/**
 * Один заказ по ID
 */
export async function getOrder(orderId) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('dc_orders')
      .select('*')
      .eq('id', orderId)
      .single()
    if (error) throw error
    return data
  } catch { return null }
}

// ═══════════════════════════════════════════════════
// АДМИН — Управление заказами
// ═══════════════════════════════════════════════════

/**
 * Все заказы (для админки)
 */
export async function getAllOrders(statusFilter = null, limit = 100) {
  if (!supabase) return []
  try {
    let query = supabase
      .from('dc_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (statusFilter) query = query.eq('status', statusFilter)
    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch { return [] }
}

/**
 * Счётчики по статусам
 */
export async function getOrderCounts() {
  if (!supabase) return {}
  try {
    const { data, error } = await supabase
      .from('dc_orders')
      .select('status')
    if (error) throw error
    const counts = {}
    ;(data || []).forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })
    return counts
  } catch { return {} }
}

/**
 * Обновить статус заказа — через серверный API (FIX C3)
 */
export async function updateOrderStatus(orderId, newStatus, adminWallet, note = '') {
  try {
    const res = await authFetch('/api/orders', {
      method: 'PATCH',
      body: { orderId, newStatus, adminWallet, note },
    })
    const data = await res.json()
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Ошибка обновления' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message || 'Ошибка сети' }
  }
}

/**
 * Привязать gem_id / purchase_id после создания камня в блокчейне
 * FIX #5: через серверный API
 */
export async function linkOrderToBlockchain(orderId, gemId, purchaseId, adminWallet) {
  try {
    const res = await authFetch('/api/admin', {
      method: 'PATCH',
      body: { action: 'link_blockchain', orderId, gemId, purchaseId, adminWallet },
    })
    const data = await res.json()
    if (!res.ok || !data.ok) return { ok: false, error: data.error || 'Ошибка' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message || 'Ошибка сети' }
  }
}

/**
 * Привязать lot_id для долевых заказов
 * FIX #5: через серверный API
 */
export async function linkOrderToLot(orderId, lotId, adminWallet) {
  try {
    const res = await authFetch('/api/admin', {
      method: 'PATCH',
      body: { action: 'link_lot', orderId, lotId, adminWallet },
    })
    const data = await res.json()
    if (!res.ok || !data.ok) return { ok: false, error: data.error || 'Ошибка' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message || 'Ошибка сети' }
  }
}

/**
 * Добавить заметку (без смены статуса)
 * FIX #5: через серверный API
 */
export async function addAdminNote(orderId, adminWallet, note) {
  try {
    const res = await authFetch('/api/admin', {
      method: 'PATCH',
      body: { action: 'add_note', orderId, note, adminWallet },
    })
    const data = await res.json()
    if (!res.ok || !data.ok) return { ok: false, error: data.error || 'Ошибка' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message || 'Ошибка сети' }
  }
}

// ═══════════════════════════════════════════════════
// ДОЛЕВЫЕ ЗАКАЗЫ — Агрегация
// ═══════════════════════════════════════════════════

/**
 * Собрать долевые заказы по одному камню (по spec_string)
 * Возвращает: сколько долей куплено, процент сбора, список заказов
 */
export async function getFractionOrdersSummary(specString) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('dc_orders')
      .select('*')
      .eq('spec_string', specString)
      .eq('is_fraction', true)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return null

    const totalFractions = data[0].total_fractions
    const soldFractions = data.reduce((s, o) => s + (o.fraction_count || 0), 0)
    const totalCollected = data.reduce((s, o) => s + parseFloat(o.club_price || 0), 0)
    const pctSold = totalFractions > 0 ? Math.round(soldFractions / totalFractions * 100) : 0

    return {
      specString,
      totalFractions,
      soldFractions,
      pctSold,
      totalCollected,
      readyToOrder: pctSold >= 50,  // 50% или больше → можно отправлять на завод
      fullyFunded: pctSold >= 100,
      orders: data,
    }
  } catch { return null }
}

// ═══════════════════════════════════════════════════
// АДМИНЫ И РОЛИ
// ═══════════════════════════════════════════════════

/**
 * Получить роль пользователя
 * @returns 'owner' | 'manager' | 'operator' | null
 */
export async function getAdminRole(wallet) {
  if (!supabase || !wallet) return null
  try {
    const { data, error } = await supabase
      .from('dc_admins')
      .select('role, active')
      .eq('wallet', wallet.toLowerCase())
      .single()
    if (error || !data || !data.active) return null
    return data.role
  } catch { return null }
}

/**
 * Полная информация об админе
 */
export async function getAdminInfo(wallet) {
  if (!supabase || !wallet) return null
  try {
    const { data, error } = await supabase
      .from('dc_admins')
      .select('*')
      .eq('wallet', wallet.toLowerCase())
      .single()
    if (error) return null
    return data
  } catch { return null }
}

/**
 * Список всех админов
 */
export async function getAllAdmins() {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('dc_admins')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  } catch { return [] }
}

/**
 * Добавить админа (только owner)
 * FIX #5: через серверный API
 */
export async function addAdmin(wallet, role, name, maxAmount = 0, adminWallet) {
  try {
    const res = await authFetch('/api/admin', {
      method: 'PATCH',
      body: { action: 'add_admin', wallet, role, name, maxAmount, adminWallet },
    })
    const data = await res.json()
    if (!res.ok || !data.ok) return { ok: false, error: data.error || 'Ошибка' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message || 'Ошибка сети' }
  }
}

/**
 * Удалить/деактивировать админа
 * FIX #5: через серверный API
 */
export async function removeAdmin(wallet, adminWallet) {
  try {
    const res = await authFetch('/api/admin', {
      method: 'PATCH',
      body: { action: 'remove_admin', wallet, adminWallet },
    })
    const data = await res.json()
    if (!res.ok || !data.ok) return { ok: false, error: data.error || 'Ошибка' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message || 'Ошибка сети' }
  }
}

// ═══════════════════════════════════════════════════
// ЛОГ ДЕЙСТВИЙ
// ═══════════════════════════════════════════════════

/**
 * Получить лог заказа
 */
export async function getOrderLog(orderId) {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('dc_order_log')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  } catch { return [] }
}

// ═══════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════

/** Красивое название статуса */
export const STATUS_LABELS = {
  NEW:        '📋 Новый',
  PAID:       '💰 Оплачен',
  APPROVED:   '✅ Утверждён',
  PRODUCTION: '🏭 Производство',
  READY:      '📦 Готов',
  COMPLETED:  '🎉 Выдан',
  CANCELLED:  '❌ Отменён',
}

/** Цвета статусов */
export const STATUS_COLORS = {
  NEW:        'text-slate-400',
  PAID:       'text-gold-400',
  APPROVED:   'text-emerald-400',
  PRODUCTION: 'text-blue-400',
  READY:      'text-purple-400',
  COMPLETED:  'text-emerald-400',
  CANCELLED:  'text-red-400',
}

/** Доступные переходы статусов */
export const STATUS_TRANSITIONS = {
  PAID:       ['APPROVED', 'CANCELLED'],
  APPROVED:   ['PRODUCTION', 'CANCELLED'],
  PRODUCTION: ['READY', 'CANCELLED'],
  READY:      ['COMPLETED'],
  COMPLETED:  [],
  CANCELLED:  [],
}
