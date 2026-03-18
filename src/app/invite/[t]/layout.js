const BASE_URL = 'https://nss-azure.vercel.app'

const templates = {
  gems: {
    title: '💎 NSS Diamond Club — Бриллианты по клубной цене',
    description: 'Закрытый инвестиционный клуб. Бриллианты от завода со скидкой до 64%. Стейкинг от 50% годовых. Начни бесплатно!',
    image: 'invite-gems.jpg',
  },
  house: {
    title: '🏠 NSS — Свой дом под 0% годовых',
    description: 'Заработай 35% депозит через клуб — мы добавим 65% под 0% годовых. Дом в любой стране мира. Без банков и кредитов.',
    image: 'invite-house.jpg',
  },
  money: {
    title: '💰 NSS — 15 источников дохода в одном приложении',
    description: 'Бриллианты, стейкинг, P2P торговля, DCT токены, реферальная программа. Бесплатный старт — зарабатывай с первого дня.',
    image: 'invite-money.jpg',
  },
}

export function generateStaticParams() {
  return [{ t: 'gems' }, { t: 'house' }, { t: 'money' }]
}

export async function generateMetadata({ params }) {
  const t = params.t || 'gems'
  const tpl = templates[t] || templates.gems

  return {
    title: tpl.title,
    description: tpl.description,
    openGraph: {
      title: tpl.title,
      description: tpl.description,
      url: `${BASE_URL}/invite/${t}`,
      siteName: 'NSS Diamond Club',
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
