export async function generateMetadata() {
  const baseUrl = 'https://nss-azure.vercel.app'
  return {
    title: '🏠 Метр² — Свой дом под 0% годовых',
    description: 'Тапай — зарабатывай — строй свой дом! 3 бизнеса, 9 уровней партнёрки, клубные дома. Бесплатный старт.',
    openGraph: {
      title: '🏠 Метр² — Свой дом под 0% годовых',
      description: 'Тапай — зарабатывай — строй свой дом! 3 бизнеса, 9 уровней партнёрки, клубные дома. Бесплатный старт.',
      url: `${baseUrl}/invite`,
      siteName: 'Метр²',
      images: [{ url: `${baseUrl}/previews/invite-house.jpg`, width: 1200, height: 630 }],
      locale: 'ru_RU',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: '🏠 Метр² — Свой дом',
      images: [`${baseUrl}/previews/invite-house.jpg`],
    },
  }
}

export default function InviteLayout({ children }) {
  return children
}
