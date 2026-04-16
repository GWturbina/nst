/**
 * authHelper.js — Серверная проверка подписи кошелька
 *
 * FIX #7: Все мутирующие API-запросы требуют подпись от кошелька.
 *
 * ИЗМЕНЕНИЯ (Пакет 2):
 *   • Сообщение теперь включает домен: "DC-AUTH-gws.ink-{ts}"
 *     — защита от replay-атак между твоими проектами (cgift.club, gwad.ink и т.д.)
 *   • TTL по умолчанию снижен с 24 часов до 1 часа
 *   • Добавлен третий параметр maxAgeSec — для админских действий передавай 300 (5 мин)
 *
 * ВАЖНО: Формат сообщения ДОЛЖЕН совпадать с web3.js → signAuthMessage()
 *
 * Использование в API route:
 *   const verified = await verifyWallet(body)                        // обычное, 1 час
 *   const verified = await verifyWallet(body, 'adminWallet', 300)    // админ, 5 минут
 */

const DEFAULT_MAX_AGE_SEC = 3600 // 1 час по умолчанию
const AUTH_DOMAIN = 'gws.ink'    // привязка подписи к домену проекта

/**
 * Проверить подпись кошелька из тела запроса
 * @param {object} body — тело запроса с полями: authSig, authTs + (wallet или adminWallet)
 * @param {string} walletField — какое поле содержит адрес: 'wallet' | 'adminWallet' (default: 'wallet')
 * @param {number} maxAgeSec — макс. возраст подписи в секундах (default: 3600)
 * @returns {string|null} — адрес кошелька (lowercase) или null если невалидно
 */
export async function verifyWallet(body, walletField = 'wallet', maxAgeSec = DEFAULT_MAX_AGE_SEC) {
  const wallet = body?.[walletField]
  const { authSig, authTs } = body || {}

  // Базовая валидация
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return null
  if (!authSig || !authTs) return null

  // Проверка возраста подписи
  const ts = parseInt(authTs)
  if (isNaN(ts)) return null
  const now = Math.floor(Date.now() / 1000)
  if (now - ts > maxAgeSec || ts > now + 60) return null // не старше maxAgeSec, не из будущего

  try {
    const { ethers } = await import('ethers')
    const message = `DC-AUTH-${AUTH_DOMAIN}-${ts}`
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
