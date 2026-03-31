/**
 * API Route: /api/bnb-price
 * Серверный прокси для получения курса BNB/USDT
 * 
 * Primary: Binance API (точный биржевой курс)
 * Fallback: CoinGecko API
 * 
 * Кеширование: 60 секунд (Vercel Edge Cache)
 */
import { NextResponse } from 'next/server'

let cachedPrice = null
let cachedAt = 0
const CACHE_TTL_MS = 60_000 // 60 секунд

export async function GET() {
  const now = Date.now()

  // Кеш в памяти — не бить API каждый запрос
  if (cachedPrice && (now - cachedAt) < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, price: cachedPrice, cached: true }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
    })
  }

  let price = null

  // Primary: Binance
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT', {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json()
      const p = parseFloat(data.price)
      if (p > 10) price = p
    }
  } catch {}

  // Fallback: CoinGecko
  if (!price) {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd', {
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json()
        const p = data?.binancecoin?.usd
        if (p && p > 10) price = p
      }
    } catch {}
  }

  if (!price) {
    return NextResponse.json({ ok: false, error: 'Price unavailable' }, { status: 502 })
  }

  // Обновить кеш
  cachedPrice = price
  cachedAt = now

  return NextResponse.json({ ok: true, price, cached: false }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
  })
}
