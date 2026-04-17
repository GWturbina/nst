/**
 * authHelper.js — Серверная проверка подписи кошелька
 *
 * FIX #7: Все мутирующие API-запросы требуют подпись от кошелька.
 *
 * Клиент при подключении кошелька подписывает сообщение "DC-AUTH-{timestamp}".
 * Сервер проверяет что подпись валидна и не старше указанного срока.
 *
 * ─────────────────────────────────────────────────────────────────
 * ИСПРАВЛЕНО (17 апр 2026):
 *   Добавлен третий параметр `maxAgeSec` — срок жизни подписи.
 *   Раньше он молча игнорировался, и все действия проверялись
 *   с дефолтом 24 часа, несмотря на то, что в API-роутах
 *   передавался ADMIN_TTL_SEC = 300 (5 минут).
 *
 *   Теперь:
 *     - Для пользовательских действий (без 3-го параметра) — 24 часа.
 *     - Для админских действий (передаётся 300) — 5 минут.
 * ─────────────────────────────────────────────────────────────────
 *
 * Использование в API route:
 *   // Обычный пользователь — дефолт 24 часа
 *   const wallet = await verifyWallet(body)
 *
 *   // Админ — 5 минут
 *   const wallet = await verifyWallet(body, 'adminWallet', 300)
 *
 *   if (!wallet) return NextResponse.json({ ok: false, error: 'Auth failed' }, { status: 401 })
 */

const DEFAULT_MAX_AGE_SEC = 86400 // 24 часа — дефолт для пользовательских действий

/**
 * Проверить подпись кошелька из тела запроса
 * @param {object} body — тело запроса с полями: authSig, authTs + (wallet или adminWallet)
 * @param {string} walletField — какое поле содержит адрес: 'wallet' | 'adminWallet' (default: 'wallet')
 * @param {number} maxAgeSec — макс. возраст подписи в секундах (default: 86400 = 24 часа)
 * @returns {string|null} — адрес кошелька (lowercase) или null если невалидно
 */
export async function verifyWallet(body, walletField = 'wallet', maxAgeSec = DEFAULT_MAX_AGE_SEC) {
  const wallet = body?.[walletField]
  const { authSig, authTs } = body || {}

  // Базовая валидация
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return null
  if (!authSig || !authTs) return null

  // Защита от некорректного maxAgeSec (если передали undefined/null/NaN — используем дефолт)
  const maxAge = (typeof maxAgeSec === 'number' && maxAgeSec > 0) ? maxAgeSec : DEFAULT_MAX_AGE_SEC

  // Проверка возраста подписи
  const ts = parseInt(authTs)
  if (isNaN(ts)) return null
  const now = Math.floor(Date.now() / 1000)
  if (now - ts > maxAge || ts > now + 60) return null // не старше maxAge, не из будущего (допуск 60 сек на расхождение часов)

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
export async function requireAuth(body, NextResponse, walletField = 'wallet', maxAgeSec = DEFAULT_MAX_AGE_SEC) {
  const wallet = await verifyWallet(body, walletField, maxAgeSec)
  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: 'Требуется авторизация кошелька. Переподключите кошелёк.' },
      { status: 401 }
    )
  }
  return wallet
}
