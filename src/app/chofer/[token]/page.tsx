import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PortalChoferPage({ params }: { params: { token: string } }) {
  const { token } = params
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const res = await fetch(`${base}/api/chofer/${token}/entregas`, { cache: 'no-store' })
  if (!res.ok) return notFound()
  const { entregas } = await res.json()
  return <ChoferClient token={token} initialEntregas={entregas} />
}

// 👇 Import dinámico para que compile en el App Router
// (guardá el componente cliente en el archivo de abajo)
import ChoferClient from './ui/choferClient'
