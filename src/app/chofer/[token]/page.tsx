'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Entrega = {
  id: string
  orden: number | null
  subcliente: string | null
  direccion: string | null
  localidad: string | null
  provincia: string | null
  remito: string | null
  estado_entrega: 'pendiente' | 'completado' | 'fallido'
  observaciones: string | null
  completado_at: string | null
}

export default function PortalChoferPage() {
  const params = useParams()
  const token = typeof params?.token === 'string' ? params.token : ''
  const [items, setItems] = useState<Entrega[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!token) return
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(`/api/chofer/${token}/entregas`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`)
      setItems(j.entregas ?? [])
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  const marcar = async (id: string, estado: 'completado' | 'pendiente' | 'fallido') => {
    setErr(null)
    const r = await fetch(`/api/chofer/${token}/entregas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j?.error) {
      setErr(j?.error || `HTTP ${r.status}`)
      return
    }
    load()
  }

  useEffect(() => { load() }, [token])

  if (!token) return <div className="p-6 text-red-600">Token inválido</div>
  if (loading) return <div className="p-6">Cargando…</div>
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>
  if (!items?.length) return <div className="p-6">No hay entregas.</div>

  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Entregas asignadas</h1>
      <ul className="space-y-2">
        {items.map((e: any) => (
          <li key={e.id} className="border rounded p-3">
            <div className="font-medium">{e.subcliente ?? '—'}</div>
            <div className="text-sm text-gray-600">{e.direccion ?? '—'}</div>
            <div className="text-sm mt-1">
              Estado: <b>{e.estado_entrega}</b>
              {e.completado_at ? ` · ${new Date(e.completado_at).toLocaleString()}` : ''}
            </div>
            <div className="flex gap-2 mt-2">
              <button className="border rounded px-2 py-1" onClick={() => marcar(e.id, 'completado')}>Completado</button>
              <button className="border rounded px-2 py-1" onClick={() => marcar(e.id, 'pendiente')}>Pendiente</button>
              <button className="border rounded px-2 py-1" onClick={() => marcar(e.id, 'fallido')}>Fallido</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
