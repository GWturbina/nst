'use client'
/**
 * authClient.js — FIX #7: Клиентский хелпер аутентификации
 *
 * Добавляет wallet + authSig + authTs в тело запроса.
 *
 * Использование:
 *   import { authFetch } from '@/lib/authClient'
 *   const res = await authFetch('/api/orders', { method: 'POST', body: { params } })
 *
 * ─────────────────────────────────────────────────────────────────
 * ИСПРАВЛЕНО (20 мая 2026):
 *   Если в store нет authSig — authFetch теперь сам предлагает
 *   подписать сообщение в кошельке, а не сразу бросает ошибку.
 *
 *   Зачем: owner-кошелёк не зарегистрирован в GlobalWay как партнёр,
 *   поэтому в useBlockchain.doConnect() подпись ему НЕ запрашивается
 *   автоматически. При попытке вызвать админ-API (создать лот,
 *   утвердить заказ и т.п.) раньше падало с «Кошелёк не авторизован».
 *
 *   Теперь authFetch при отсутствии подписи запросит её один раз
 *   (anti-spam 60 сек) и продолжит запрос. Для обычных партнёров
 *   ничего не меняется — у них подпись уже есть от doConnect.
 * ─────────────────────────────────────────────────────────────────
 */
import useGameStore from './store'

const SIGN_REQUEST_COOLDOWN_MS = 60000 // не чаще раза в минуту

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
 * Запросить подпись у кошелька и сохранить в store.
 * Возвращает свежие auth-параметры или бросает понятную ошибку.
 *
 * Используется как fallback в authFetch когда authSig нет
 * (типичный кейс: owner-кошелёк без регистрации в GlobalWay).
 */
async function requestSignatureNow() {
  // Anti-spam: не чаще раза в минуту, чтобы не открывать SafePal попап подряд
  const lastReq = (typeof window !== 'undefined' && window.__lastAuthRequest) || 0
  if (Date.now() - lastReq < SIGN_REQUEST_COOLDOWN_MS) {
    throw new Error('Подождите минуту перед повторным запросом подписи.')
  }
  if (typeof window !== 'undefined') window.__lastAuthRequest = Date.now()

  // Динамический импорт — избегаем циклической зависимости с web3.js
  const { default: web3 } = await import('./web3')
  if (!web3.signer) {
    throw new Error('Кошелёк не подключён. Подключите SafePal и попробуйте снова.')
  }

  const signed = await web3.signAuthMessage()
  useGameStore.getState().setAuth(signed)
  return signed
}

/**
 * fetch-обёртка с автоматической вставкой auth-параметров в JSON body
 * Добавляет authSig + authTs. Поле wallet/adminWallet добавляет вызывающий код.
 * Если подписи нет в store — попытается её запросить через SafePal.
 *
 * @param {string} url
 * @param {object} opts — { method, body (object, не string) }
 * @returns {Promise<Response>}
 */
export async function authFetch(url, opts = {}) {
  let auth = getAuthParams()

  // ★ ФИКС: Если подписи нет — запросить её перед запросом.
  // Это покрывает owner-кошелёк который не зарегистрирован в GlobalWay
  // (doConnect ему подпись автоматически не запрашивает).
  if (!auth) {
    try {
      await requestSignatureNow()
      auth = getAuthParams()
    } catch (err) {
      const msg = err?.message || ''
      // Юзер отклонил подпись в SafePal
      if (msg.includes('rejected') || msg.includes('denied') || msg.includes('User')) {
        throw new Error('Подпись отклонена в кошельке. Действие не выполнено.')
      }
      // Прочие ошибки (cooldown / нет signer / нет ethereum)
      throw new Error(msg || 'Не удалось получить подпись кошелька.')
    }
  }

  if (!auth) {
    throw new Error('Подпись не получена. Подпишите сообщение в SafePal и повторите.')
  }

  const body = { authSig: auth.authSig, authTs: auth.authTs, ...(opts.body || {}) }

  return fetch(url, {
    method: opts.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: JSON.stringify(body),
  })
}
