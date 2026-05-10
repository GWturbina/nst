import './globals.css'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import GwadUtmCapture from '@/components/GwadUtmCapture'
export const metadata = {
  title: 'Diamond Club — GST',
  description: 'Инвестиции в драгоценные камни. DCT токен с реальным обеспечением.',
  openGraph: {
    title: 'Diamond Club — GST',
    description: 'Драгоценные камни и DCT токены',
    images: ['/og-diamond.png'],
  },
}
export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <script src="https://telegram.org/js/telegram-web-app.js" defer />
      </head>
      <body>
        <GwadUtmCapture />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
