import { notFound } from 'next/navigation'
import ChoferClient from  './ui/ChoferClient'
export default async function ChoferPage({ params: { token } }: { params: { token: string } }) {
  // Podés usar absoluta o relativa. Relativa evita depender de NEXT_PUBLIC_BASE_URL.
  const url = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/chofer/${token}/entregas`
  const res = await fetch(url || `/api/chofer/${token}/entregas`, { cache: 'no-store' })

  if (!res.ok) return notFound()

  const { entregas } = await res.json()
  return <ChoferClient token={token} initialEntregas={entregas} />
}
