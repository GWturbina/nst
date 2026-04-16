'use client'
/**
 * tapService.js — Связь тапалки с сервером
 *
 * Для зарегистрированных: сервер — единственный источник правды.
 *   UI показывает то что вернул сервер (НЕ оптимистично).
 *   Новый тап блокируется пока идёт предыдущий запрос.
 *
 * Для незарегистрированных: локальные тапы (испаряются через 30 мин).
 *
 * Throttle: минимум 150мс между тапами (совпадает с сервером).
 */
import { authFetch } from './authClient'

const MIN_INTERVAL = 150 // мс — совпадает с MIN_TAP_INTERVAL_MS в API
let lastTapTime = 0
let pending = false     // идёт ли сейчас серверный запрос

/**
 * Серверный тап (для зарегистрированных).
 * Возвращает:
 *   - объект ответа сервера (ok/energy/totalNss/...)
 *   - null если запрос подавлен (throttle / pending)
 */
export async function serverTap(wallet, level) {
  const now = Date.now()
  if (pending) return null
  if (now - lastTapTime < MIN_INTERVAL) return null
  lastTapTime = now
  pending = true

  try {
    const res = await authFetch('/api/tap', {
      method: 'POST',
      body: { wallet, level },
    })
    if (!res.ok && res.status === 401) {
      // Подпись протухла — сигнализируем вверх
      return { ok: false, authExpired: true, status: 401 }
    }
    const data = await res.json().catch(() => null)
    return data
  } catch {
    return null
  } finally {
    pending = false
  }
}

/**
 * Идёт ли сейчас серверный запрос? (для UI-индикации)
 */
export function isTapPending() {
  return pending
}

/**
 * Загрузить состояние игрока с сервера (GET).
 * Вызывается при подключении кошелька и в refresh-цикле.
 */
export async function loadTapState(wallet) {
  try {
    const res = await fetch(`/api/tap?wallet=${wallet}`, { cache: 'no-store' })
    const data = await res.json()
    return data.ok ? data : null
  } catch {
    return null
  }
}

/**
 * Локальный тап (для незарегистрированных — с throttle).
 */
export function localTapAllowed() {
  const now = Date.now()
  if (now - lastTapTime < MIN_INTERVAL) return false
  lastTapTime = now
  return true
}
