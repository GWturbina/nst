import { NextResponse } from 'next/server'

export function middleware(request) {
  const url = request.nextUrl
  const pathname = url.pathname

  // Правило применяем ТОЛЬКО к корневой странице "/"
  // Все остальные пути (/invite, /invite/gems, /landing.html и т.д.) — пропускаем как есть
  if (pathname !== '/') {
    return NextResponse.next()
  }

  // 1. Если в URL есть ?cabinet=1 — принудительно показываем кабинет (override)
  if (url.searchParams.get('cabinet') === '1') {
    return NextResponse.next()
  }

  // 2. Проверяем: пришёл ли юзер из Telegram WebApp?
  // В Telegram заголовок "sec-fetch-site" = "none", + обычно есть User-Agent "Telegram"
  const userAgent = request.headers.get('user-agent') || ''
  const isTelegramWebApp = userAgent.includes('Telegram') || request.headers.get('x-telegram-init-data')
  if (isTelegramWebApp) {
    return NextResponse.next()
  }

  // 3. Проверяем: есть ли у юзера сохранённая сессия в cookie?
  // (после входа в кабинет и подключения кошелька ставится наша cookie "dc_session")
  const hasSession = request.cookies.get('dc_session')?.value === '1'
  if (hasSession) {
    return NextResponse.next()
  }

  // 4. Иначе — гость. Отправляем на лендинг.
  // Сохраняем ?ref= если был
  const ref = url.searchParams.get('ref')
  const landingUrl = new URL('/landing.html', request.url)
  if (ref && /^\d+$/.test(ref)) {
    landingUrl.searchParams.set('ref', ref)
  }

  return NextResponse.redirect(landingUrl)
}

// Matcher: на какие маршруты применять middleware
// Только корень "/" — всё остальное пропускаем
export const config = {
  matcher: ['/'],
}
