// src/app/chofer/[token]/page.tsx
import { notFound } from 'next/navigation'
import ChoferClient from '../../../components/ChoferClient'

export const dynamic = 'force-dynamic'

export default async function PortalChoferPage(
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const res = await fetch(`/api/chofer/${token}/entregas`, { cache: 'no-store' })
  if (!res.ok) return notFound()

  const { entregas } = await res.json()
  return <ChoferClient token={token} initialEntregas={entregas} />
}
