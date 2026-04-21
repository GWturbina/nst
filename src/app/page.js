import { redirect } from 'next/navigation'

export default async function Home({ searchParams }) {
  const params = await searchParams
  const ref = params?.ref
  const query = ref && /^\d+$/.test(String(ref)) ? `?ref=${ref}` : ''
  redirect('/landing.html' + query)
}
