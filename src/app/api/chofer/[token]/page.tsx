// app/chofer/[token]/page.tsx
import { notFound } from 'next/navigation'

export default async function PortalChoferPage({ params: { token } }: { params: { token: string } }) {
  const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/chofer/${token}/entregas`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return notFound()
  const { entregas } = await res.json()
  return <ChoferClient token={token} initialEntregas={entregas} />
}

// app/chofer/[token]/ChoferClient.tsx
'use client'
import { useState } from 'react'

function Item({ e, onMark }: any) {
  return (
    <div className="border rounded p-3 mb-2">
      <div className="font-medium">#{e.orden} — {e.cliente_entrega}</div>
      <div>{e.direccion}, {e.localidad}, {e.provincia}</div>
      <div>Remitos: {e.remitos || '-'}</div>
      <div>Obs: {e.observaciones || '-'}</div>
      <div className="mt-2 flex gap-2">
        <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={() => onMark(e.id, 'entregado')}>Entregado</button>
        <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={() => onMark(e.id, 'rechazado')}>Rechazado</button>
      </div>
    </div>
  )
}

export default function ChoferClient({ token, initialEntregas }: any) {
  const [items, setItems] = useState(initialEntregas)
  const done = items.filter((i: any) => i.estado_entrega === 'entregado').length
  async function onMark(id: string, estado: 'entregado'|'rechazado') {
    const r = await fetch(`/api/chofer/${token}/entregas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    })
    if (r.ok) {
      setItems((prev: any[]) => prev.map(i => i.id === id ? { ...i, estado_entrega: estado, fecha_entrega_real: new Date().toISOString() } : i))
    }
  }
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-3">Entregas ({done}/{items.length})</h1>
      {items.map((e: any) => <Item key={e.id} e={e} onMark={onMark} />)}
    </div>
  )
}
