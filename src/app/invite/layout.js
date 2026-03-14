export async function generateMetadata() {
  const baseUrl = 'https://nss-azure.vercel.app'
  return {
    title: '💎 NSS Diamond Club — Бриллианты по клубной цене',
    description: 'Закрытый инвестиционный клуб. Бриллианты от завода со скидкой до 64%. Стейкинг от 50% годовых.',
    openGraph: {
      title: '💎 NSS Diamond Club — Бриллианты по клубной цене',
      description: 'Закрытый инвестиционный клуб. Бриллианты от завода со скидкой до 64%. Стейкинг от 50% годовых.',
      url: `${baseUrl}/invite`,
      siteName: 'NSS Diamond Club',
      images: [{ url: `${baseUrl}/previews/invite-gems.jpg`, width: 1200, height: 630 }],
      locale: 'ru_RU',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: '💎 NSS Diamond Club',
      images: [`${baseUrl}/previews/invite-gems.jpg`],
    },
  }
}

export default function InviteLayout({ children }) {
  return children
}
