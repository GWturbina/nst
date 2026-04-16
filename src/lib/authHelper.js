/**
 * authHelper.js — Серверная проверка подписи кошелька
 * 
 * FIX #7: Все мутирующие API-запросы требуют подпись от кошелька.
 * 
 * Клиент при подключении кошелька подписывает сообщение "DC-AUTH-{timestamp}".
 * Сервер проверяет что подпись валидна и не старше 24 часов.
 * 
 * Использование в API route:
 *   const wallet = verifyWallet(body)
 *   if (!wallet) return NextResponse.json({ ok: false, error: 'Auth failed' }, { status: 401 })
 */

const AUTH_MAX_AGE_SEC = 86400 // 24 часа

/**
 * Проверить подпись кошелька из тела запроса
 * @param {object} body — тело запроса с полями: authSig, authTs + (wallet или adminWallet)
 * @param {string} walletField — какое поле содержит адрес: 'wallet' | 'adminWallet' (default: 'wallet')
 * @returns {string|null} — адрес кошелька (lowercase) или null если невалидно
 */
export async function verifyWallet(body, walletField = 'wallet') {
  const wallet = body?.[walletField]
  const { authSig, authTs } = body || {}

  // Базовая валидация
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return null
  if (!authSig || !authTs) return null

  // Проверка возраста подписи
  const ts = parseInt(authTs)
  if (isNaN(ts)) return null
  const now = Math.floor(Date.now() / 1000)
  if (now - ts > AUTH_MAX_AGE_SEC || ts > now + 60) return null // не старше 24ч, не из будущего

  try {
    const { ethers } = await import('ethers')
    const message = `DC-AUTH-${ts}`
    const recovered = ethers.verifyMessage(message, authSig)

    if (recovered.toLowerCase() === wallet.toLowerCase()) {
      return wallet.toLowerCase()
    }
    return null
  } catch {
    return null
  }
}

/**
 * Обёртка — проверить подпись ИЛИ вернуть ошибку
 * Для использования: const wallet = await requireAuth(body); if (wallet instanceof NextResponse) return wallet;
 */
export async function requireAuth(body, NextResponse) {
  const wallet = await verifyWallet(body)
  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: 'Требуется авторизация кошелька. Переподключите кошелёк.' },
      { status: 401 }
    )
  }
  return wallet
}
