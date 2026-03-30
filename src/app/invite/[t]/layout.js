const BASE_URL = 'https://nss-azure.vercel.app'

const templates = {
  house: {
    title: '🏠 Метр² — Свой дом под 0% годовых',
    description: 'Заработай 35% депозит через клуб — мы добавим 65% под 0% годовых. Дом в любой стране мира. Без банков и кредитов.',
    image: 'invite-house.jpg',
  },
  business: {
    title: '💰 Метр² — 3 бизнеса = 3 источника дохода',
    description: 'Малый $50, Средний $250, Большой $1000. Реинвесты, 9 уровней партнёрки. Бесплатный старт — тапай и зарабатывай!',
    image: 'invite-business.jpg',
  },
  earn: {
    title: '⛏ Метр² — Тапай и зарабатывай каждый день',
    description: 'Бесплатная тапалка + реальный бизнес. CHT токены, клубные дома, свой дом под 0%. Присоединяйся!',
    image: 'invite-earn.jpg',
  },
}

export function generateStaticParams() {
  return [{ t: 'house' }, { t: 'business' }, { t: 'earn' }]
}

export async function generateMetadata({ params }) {
  const t = params.t || 'house'
  const tpl = templates[t] || templates.house

  return {
    title: tpl.title,
    description: tpl.description,
    openGraph: {
      title: tpl.title,
      description: tpl.description,
      url: `${BASE_URL}/invite/${t}`,
      siteName: 'Метр²',
      images: [
        {
          url: `${BASE_URL}/previews/${tpl.image}`,
          width: 1200,
          height: 630,
          alt: tpl.title,
        },
      ],
      locale: 'ru_RU',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: tpl.title,
      description: tpl.description,
      images: [`${BASE_URL}/previews/${tpl.image}`],
    },
  }
}

export default function InviteTypeLayout({ children }) {
  return children
}
