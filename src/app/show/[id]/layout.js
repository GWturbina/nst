/**
 * /show/[id]/layout.js — Server component с generateMetadata
 *
 * Отвечает за красивое превью в Telegram/WhatsApp когда партнёр
 * шлёт ссылку в мессенджере: подтягивает фото, название, цену товара.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gws.ink'

function normalizeGwId(raw) {
  if (!raw) return null
  const clean = String(raw).replace(/[^\w]/g, '').slice(0, 20).toUpperCase()
  const digits = clean.replace(/^GW/, '')
  if (!digits || !/^\d+$/.test(digits)) return null
  return 'GW' + digits
}

export async function generateMetadata({ params, searchParams }) {
  const id = parseInt(params?.id)
  const ref = normalizeGwId(searchParams?.ref)

  if (!supabase || !id) {
    return { title: 'Diamond Club' }
  }

  try {
    // Получаем товар
    const { data: item } = await supabase
      .from('dc_showcase')
      .select('id, title, description, photos, club_price, retail_price, carat, shape')
      .eq('id', id)
      .eq('status', 'active')
      .single()

    if (!item) {
      return {
        title: 'Товар не найден — Diamond Club',
        description: 'Этот товар больше недоступен',
      }
    }

    // Цена партнёра (если есть ref)
    let displayPrice = item.club_price
    let priceLabel = 'Клубная цена'

    if (ref) {
      const { data: listing } = await supabase
        .from('dc_partner_listings')
        .select('price, is_negotiable, is_active')
        .eq('gw_id', ref)
        .eq('item_id', id)
        .eq('is_active', true)
        .maybeSingle()

      if (listing) {
        if (listing.is_negotiable) {
          displayPrice = null
          priceLabel = 'Договорная цена'
        } else if (listing.price) {
          displayPrice = listing.price
          priceLabel = 'Цена'
        }
      }
    }

    const photo = (item.photos && item.photos[0]) || `${SITE_URL}/icons/logo.png`

    const title = `${item.title} — Diamond Club`

    let description
    if (displayPrice) {
      const savings = item.retail_price
        ? Math.round((1 - displayPrice / item.retail_price) * 100)
        : 0
      description = savings > 0
        ? `${priceLabel}: $${displayPrice}. Экономия ${savings}% от розничной цены $${item.retail_price}.`
        : `${priceLabel}: $${displayPrice}. ${item.description?.slice(0, 100) || ''}`
    } else {
      description = `${priceLabel}. ${item.description?.slice(0, 150) || 'Закрытый клуб инвесторов в бриллианты.'}`
    }

    const url = ref
      ? `${SITE_URL}/show/${id}?ref=${ref}`
      : `${SITE_URL}/show/${id}`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: [{ url: photo, width: 1200, height: 630, alt: item.title }],
        url,
        type: 'website',
        siteName: 'Diamond Club',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [photo],
      },
      robots: {
        index: true,
        follow: true,
      },
    }
  } catch {
    return { title: 'Diamond Club' }
  }
}

export default function ShowLayout({ children }) {
  return children
}
