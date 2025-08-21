import { notFound } from 'next/navigation'
import ChoferClient from '../../../components/ChoferClient'


export const dynamic = 'force-dynamic'

export default async function PortalChoferPage({
  params: { token },
}: { params: { token: string } }) {
  // fetch relativo: funciona en Vercel y local
  const res = await fetch(`/api/chofer/${token}/entregas`, { cache: 'no-store' })
  if (!res.ok) return notFound()

  const { entregas } = await res.json()
  return <ChoferClient token={token} initialEntregas={entregas} />
}
