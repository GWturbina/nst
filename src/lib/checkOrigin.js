/**
 * checkOrigin.js — Общая проверка origin для всех API routes
 * 
 * Разрешает запросы с:
 * - gws.ink (основной домен Diamond Club)
 * - gwad.ink (GWAD платформа)
 * - *.vercel.app (preview деплои)
 * - localhost (разработка)
 * - NEXT_PUBLIC_SITE_URL (если задан)
 * - server-side requests (без origin)
 * - SafePal WebView (origin может быть null/пустой)
 */

export function checkOrigin(request) {
  // В development — пропускаем всё
  if (process.env.NODE_ENV !== 'production') return true

  const origin = request.headers.get('origin') || ''
  const referer = request.headers.get('referer') || ''
  const ua = request.headers.get('user-agent') || ''

  // Разрешённые домены
  const allowedDomains = ['gws.ink', 'gwad.ink']

  // Добавляем NEXT_PUBLIC_SITE_URL если задан
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  if (siteUrl) {
    try {
      const u = new URL(siteUrl)
      if (!allowedDomains.includes(u.hostname)) {
        allowedDomains.push(u.hostname)
      }
    } catch {}
  }

  // Server-side requests (Next.js internal) — нет origin и нет referer
  if (!origin && !referer) return true

  // SafePal WebView — origin может быть "null" (строкой) или пустым
  if (origin === 'null' || origin === '') {
    for (const domain of allowedDomains) {
      if (referer.includes(domain)) return true
    }
    if (ua.toLowerCase().includes('safepal')) return true
    if (referer.includes('.vercel.app')) return true
  }

  // Vercel preview deployments
  if (origin.endsWith('.vercel.app') || referer.includes('.vercel.app')) return true

  // Localhost (разработка)
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true

  // Строгая проверка origin/referer по доменам
  for (const domain of allowedDomains) {
    if (matchDomain(origin, domain) || matchDomain(referer, domain)) return true
  }

  return false
}

/**
 * Строгая проверка домена — точное совпадение хоста
 * Защита от evil-gws.ink и подобных
 */
function matchDomain(urlString, domain) {
  if (!urlString) return false
  try {
    const u = new URL(urlString)
    return u.hostname === domain || u.hostname.endsWith('.' + domain)
  } catch {
    return urlString.includes('://' + domain) || urlString.includes('.' + domain + '/')
  }
}
