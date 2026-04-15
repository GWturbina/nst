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
 */

export function checkOrigin(request) {
  // В development — пропускаем всё
  if (process.env.NODE_ENV !== 'production') return true

  const origin = request.headers.get('origin') || ''
  const referer = request.headers.get('referer') || ''

  // Разрешённые домены
  const allowedDomains = ['gws.ink', 'gwad.ink']

  // Добавляем NEXT_PUBLIC_SITE_URL если задан
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  if (siteUrl) {
    try {
      const u = new URL(siteUrl)
      allowedDomains.push(u.hostname)
    } catch {}
  }

  // Vercel preview deployments
  if (origin.includes('.vercel.app') || referer.includes('.vercel.app')) return true

  // Server-side requests (Next.js internal) — нет origin
  if (!origin && !referer) return true

  // Проверяем origin ИЛИ referer
  for (const domain of allowedDomains) {
    if (origin.includes(domain) || referer.includes(domain)) return true
  }

  return false
}
