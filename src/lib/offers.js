'use client'
/**
 * offers.js — сервисный слой для эксклюзивных предложений (Золотой пул).
 *
 * Использует существующие хелперы проекта (web3, authClient) — ничего не меняет.
 *  - GET список предложений — публичный
 *  - Заявка «Хочу» — пользователь (сохранённая подпись, 24ч)
 *  - Админские действия — свежая подпись (5 мин), как при создании лотов
 *
 * Импорт:
 *   import * as Offers from '@/lib/offers'
 */
import web3 from './web3'
import { authFetch } from './authClient'

// ─── Уровни привилегий и персональная цена ───
// Базовая цена (% от рынка) по уровню вложения. С тапалкой — ещё ниже (примечание).
export function getTier(depositUsdt) {
  const d = parseFloat(depositUsdt) || 0
  if (d >= 1000) return { pct: 37, label: '$1000+', note: 'с тапалкой до 35% (себестоимость)' }
  if (d >= 500)  return { pct: 39, label: '$500–999', note: 'с тапалкой до 37%' }
  if (d >= 100)  return { pct: 44, label: '$100–499', note: 'с тапалкой до 40%' }
  return null // меньше $100 — привилегии нет
}

// Персональная цена камня для вкладчика
export function personalPrice(marketPrice, depositUsdt) {
  const t = getTier(depositUsdt)
  if (!t) return null
  const price = (parseFloat(marketPrice) || 0) * t.pct / 100
  return Math.round(price * 100) / 100
}

// ─── GET список активных предложений (публичный) ───
export async function getOffers() {
  try {
    const res = await fetch('/api/offers')
    const data = await res.json()
    return data?.ok ? (data.offers || []) : []
  } catch {
    return []
  }
}

// ─── Заявка «Хочу» (пользователь, сохранённая подпись 24ч) ───
export async function sendRequest(offerId, depositUsdt, price) {
  try {
    const res = await authFetch('/api/offers', {
      method: 'POST',
      body: {
        action: 'request',
        wallet: web3.address,
        offerId,
        depositUsdt: depositUsdt ?? null,
        personalPrice: price ?? null,
      },
    })
    return await res.json()
  } catch (e) {
    return { ok: false, error: e?.message || 'Ошибка отправки заявки' }
  }
}

// ─── Админ: вызов со свежей подписью (5 мин) ───
async function adminPost(action, data = {}) {
  if (!web3.address) return { ok: false, error: 'Кошелёк не подключён' }
  let auth
  try {
    auth = await web3.signAuthMessage() // свежая подпись (запросит SafePal)
  } catch {
    return { ok: false, error: 'Нужна подпись кошелька' }
  }
  try {
    const res = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        adminWallet: web3.address,
        authSig: auth.authSig,
        authTs: auth.authTs,
        ...data,
      }),
    })
    return await res.json()
  } catch (e) {
    return { ok: false, error: e?.message || 'Ошибка' }
  }
}

// Создать предложение
export const adminCreateOffer = (offer) => adminPost('create', offer)
// Закрыть предложение (убрать из показа)
export const adminCloseOffer = (offerId) => adminPost('close', { offerId })
// Список всех заявок
export const adminListRequests = () => adminPost('list_requests', {})
// Отметить заявку обработанной
export const adminProcessRequest = (requestId) => adminPost('process_request', { requestId })
