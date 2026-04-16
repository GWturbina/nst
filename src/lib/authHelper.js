/**
 * authHelper.js — Серверная проверка подписи кошелька
 *
 * Поддерживает ОБА формата подписи:
 *   • Новый: "DC-AUTH-gws.ink-{ts}" (генерируется обновлённым web3.js)
 *   • Старый: "DC-AUTH-{ts}" (для пользователей, кто ещё не переподписал)
 *
 * Через месяц можно убрать старый формат (удалить fallback ниже).
 */

const DEFAULT_MAX_AGE_SEC = 3600 // 1 час по умолчанию
const AUTH_DOMAIN = 'gws.ink'

/**
 * Проверить подпись кошелька из тела запроса
 * @param {object} body — тело запроса с полями: authSig, authTs + (wallet или adminWallet)
 * @param {string} walletField — 'wallet' | 'adminWallet'
 * @param {number} maxAgeSec — макс. возраст подписи в секундах (default: 3600)
 * @returns {string|null} — адрес кошелька (lowercase) или null
 */
export async function verifyWallet(body, walletField = 'wallet', maxAgeSec = DEFAULT_MAX_AGE_SEC) {
  const wallet = body?.[walletField]
  const { authSig, authTs } = body || {}

  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return null
  if (!authSig || !authTs) return null

  const ts = parseInt(authTs)
  if (isNaN(ts)) return null
  const now = Math.floor(Date.now() / 1000)
  if (now - ts > maxAgeSec || ts > now + 60) return null

  try {
    const { ethers } = await import('ethers')

    // Пробуем НОВЫЙ формат сначала
    const newMessage = `DC-AUTH-${AUTH_DOMAIN}-${ts}`
    const recovered = ethers.verifyMessage(newMessage, authSig)
    if (recovered.toLowerCase() === wallet.toLowerCase()) {
      return wallet.toLowerCase()
    }

    // Fallback: СТАРЫЙ формат (для пользователей, не обновивших подпись)
    // TODO: удалить через месяц (после ~2026-05-16)
    const oldMessage = `DC-AUTH-${ts}`
    const recoveredOld = ethers.verifyMessage(oldMessage, authSig)
    if (recoveredOld.toLowerCase() === wallet.toLowerCase()) {
      return wallet.toLowerCase()
    }

    return null
  } catch {
    return null
  }
}

/**
 * Обёртка — проверить подпись ИЛИ вернуть ошибку
 */
export async function requireAuth(body, NextResponse, maxAgeSec = DEFAULT_MAX_AGE_SEC) {
  const wallet = await verifyWallet(body, 'wallet', maxAgeSec)
  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: 'Требуется авторизация кошелька. Переподключите кошелёк.' },
      { status: 401 }
    )
  }
  return wallet
}
