'use client'
/**
 * authClient.js — FIX #7: Клиентский хелпер аутентификации
 * 
 * Добавляет wallet + authSig + authTs в тело запроса.
 * 
 * Использование:
 *   import { authFetch } from '@/lib/authClient'
 *   const res = await authFetch('/api/orders', { method: 'POST', body: { params } })
 */
import useGameStore from './store'

/**
 * Получить auth-параметры из store
 * @returns {{ wallet: string, authSig: string, authTs: number } | null}
 */
export function getAuthParams() {
  const { wallet, authSig, authTs } = useGameStore.getState()
  if (!wallet || !authSig || !authTs) return null
  return { wallet, authSig, authTs }
}

/**
 * fetch-обёртка с автоматической вставкой auth-параметров в JSON body
 * Добавляет только authSig + authTs. Поле wallet уже должно быть в body.
 * @param {string} url
 * @param {object} opts — { method, body (object, не string) }
 * @returns {Promise<Response>}
 */
export async function authFetch(url, opts = {}) {
  const auth = getAuthParams()
  if (!auth) {
    throw new Error('Кошелёк не авторизован. Переподключите кошелёк.')
  }

  const body = { authSig: auth.authSig, authTs: auth.authTs, ...(opts.body || {}) }

  return fetch(url, {
    method: opts.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: JSON.stringify(body),
  })
}
