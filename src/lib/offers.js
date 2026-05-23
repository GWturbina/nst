'use client'
/**
 * offers.js — сервисный слой для эксклюзивных предложений (Золотой пул).
 *
 * Цена НЕ считается автоматически (бриллианты индивидуальны) — показывается
 * "от $X" или "по запросу", реальную цену клуб называет после заявки.
 * Загрузка фото — через готовый showcaseStorage (bucket "showcase").
 */
import web3 from './web3'
import { authFetch } from './authClient'
import { uploadShowcaseFile, compressImage } from './showcaseStorage'

// Уровень привилегии (для показа — НЕ для расчёта цены)
export function getTier(depositUsdt) {
  const d = parseFloat(depositUsdt) || 0
  if (d >= 1000) return { label: '$1000+', note: 'до 35% от рынка (себестоимость)' }
  if (d >= 500)  return { label: '$500–999', note: 'до 37% от рынка' }
  if (d >= 100)  return { label: '$100–499', note: 'до 40% от рынка' }
  return null
}

// ─── Загрузка фото (несколько), со сжатием. Возвращает {photos:[{url,path}], errors:[]} ───
export async function uploadPhotos(fileList) {
  if (!web3.address) return { photos: [], errors: ['Кошелёк не подключён'] }
  const files = Array.from(fileList || [])
  const photos = []
  const errors = []
  for (const file of files) {
    let f = file
    try { if (file.type?.startsWith('image/')) f = await compressImage(file) } catch { f = file }
    const r = await uploadShowcaseFile(f, web3.address)
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
  try {
    const res = await authFetch('/api/offers', {
      method: 'POST',
      body: { action: 'request', wallet: web3.address, offerId, depositUsdt: depositUsdt ?? null },
    })
    return await res.json()
  } catch (e) { return { ok: false, error: e?.message || 'Ошибка отправки заявки' } }
}

// ─── Админ: вызов со свежей подписью ───
async function adminPost(action, data = {}) {
  if (!web3.address) return { ok: false, error: 'Кошелёк не подключён' }
  let auth
  try { auth = await web3.signAuthMessage() } catch { return { ok: false, error: 'Нужна подпись кошелька' } }
  try {
    const res = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, adminWallet: web3.address, authSig: auth.authSig, authTs: auth.authTs, ...data }),
    })
    return await res.json()
  } catch (e) { return { ok: false, error: e?.message || 'Ошибка' } }
}

// offer = { title, carat, color, clarity, priceFrom, description, photos:[url], photoPaths:[path], videos:[url] }
export const adminCreateOffer = (offer) => adminPost('create', offer)
export const adminCloseOffer = (offerId) => adminPost('close', { offerId })
export const adminListRequests = () => adminPost('list_requests', {})
export const adminProcessRequest = (requestId) => adminPost('process_request', { requestId })
