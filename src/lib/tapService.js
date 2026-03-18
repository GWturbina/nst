'use client'
/**
 * tapService.js — Связь тапалки с сервером
 * 
 * Для зарегистрированных: тапы идут через /api/tap (серверная верификация)
 * Для незарегистрированных: тапы локальные (испаряются через 30 мин)
 * 
 * Throttle: минимум 150мс между тапами
 */

let lastTapTime = 0
const MIN_INTERVAL = 150 // мс

/**
 * Серверный тап (для зарегистрированных пользователей с кошельком)
 */
export async function serverTap(wallet, level) {
  const now = Date.now()
  if (now - lastTapTime < MIN_INTERVAL) return null
  lastTapTime = now

  try {
    const res = await fetch('/api/tap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, level }),
    })
    const data = await res.json()
    return data
  } catch {
    return null
  }
}

/**
 * Загрузить состояние игрока с сервера
 */
export async function loadTapState(wallet) {
  try {
    const res = await fetch(`/api/tap?wallet=${wallet}`)
    const data = await res.json()
    return data.ok ? data : null
  } catch {
    return null
  }
}

/**
 * Локальный тап (для незарегистрированных — с throttle)
 */
export function localTapAllowed() {
  const now = Date.now()
  if (now - lastTapTime < MIN_INTERVAL) return false
  lastTapTime = now
  return true
}
