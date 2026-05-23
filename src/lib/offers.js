'use client'
/**
 * offers.js — сервисный слой для эксклюзивных предложений (Золотой пул).
 *
 * Адрес и подпись берём из сохранённого хранилища (getAuthParams/authFetch) —
 * работает после перезагрузки страницы. Подпись валидна 24ч (как в заказах).
 * Цена не считается автоматически. Фото грузятся через showcaseStorage.
 */
import { authFetch, getAuthParams } from './authClient'
import { uploadShowcaseFile, compressImage } from './showcaseStorage'

function myWallet() {
  return getAuthParams()?.wallet || null
}

// Уровень привилегии (для показа)
export function getTier(depositUsdt) {
  const d = parseFloat(depositUsdt) || 0
  if (d >= 1000) return { label: '$1000+', note: 'до 35% от рынка (себестоимость)' }
  if (d >= 500)  return { label: '$500–999', note: 'до 37% от рынка' }
  if (d >= 100)  return { label: '$100–499', note: 'до 40% от рынка' }
  return null
}

// ─── Загрузка фото (несколько) со сжатием. Возвращает {photos:[{url,path}], errors:[]} ───
export async function uploadPhotos(fileList) {
  const wallet = myWallet()
  if (!wallet) return { photos: [], errors: ['Переподключите кошелёк'] }
  const files = Array.from(fileList || [])
  const photos = []
  const errors = []
  for (const file of files) {
    let f = file
    try { if (file.type?.startsWith('image/')) f = await compressImage(file) } catch { f = file }
    const r = await uploadShowcaseFile(f, wallet)
    if (r?.ok) photos.push({ url: r.url, path: r.path })
    else errors.push(`${file.name}: ${r?.error || 'ошибка'}`)
  }
  return { photos, errors }
}

// ─── GET список активных предложений ───
export async function getOffers() {
  try {
    const res = await fetch('/api/offers')
    const data = await res.json()
    return data?.ok ? (data.offers || []) : []
  } catch { return [] }
}

// ─── Заявка «Хочу» (пользователь) ───
export async function sendRequest(offerId, depositUsdt) {
  const auth = getAuthParams()
  if (!auth) return { ok: false, error: 'Переподключите кошелёк' }
  try {
    const res = await authFetch('/api/offers', {
      method: 'POST',
      body: { action: 'request', wallet: auth.wallet, offerId, depositUsdt: depositUsdt ?? null },
    })
    return await res.json()
  } catch (e) { return { ok: false, error: e?.message || 'Ошибка отправки заявки' } }
}

// ─── Админ: используем сохранённую подпись (authFetch), adminWallet из хранилища ───
async function adminPost(action, data = {}) {
  const auth = getAuthParams()
  if (!auth) return { ok: false, error: 'Переподключите кошелёк (нужна подпись)' }
  try {
    const res = await authFetch('/api/offers', {
      method: 'POST',
      body: { action, adminWallet: auth.wallet, ...data },
    })
    return await res.json()
  } catch (e) { return { ok: false, error: e?.message || 'Ошибка' } }
}

export const adminCreateOffer = (offer) => adminPost('create', offer)
export const adminCloseOffer = (offerId) => adminPost('close', { offerId })
export const adminListRequests = () => adminPost('list_requests', {})
export const adminProcessRequest = (requestId) => adminPost('process_request', { requestId })
