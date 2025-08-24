'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Estado = 'pendiente' | 'completado' | 'fallido'

type Entrega = {
  id: string
  orden: number | null
  subcliente: string | null
  direccion: string | null
  localidad: string | null
  provincia: string | null
  remito: string | null
  estado: Estado                 // <- columna correcta en DB
  observaciones: string | null
  completado_at: string | null
  _saving?: boolean              // <- UI flag local
}

export default function PortalChoferPage() {
  const params = useParams()
  const token =
    typeof params?.token === 'string'
      ? params.token.trim()
      : Array.isArray(params?.token)
      ? String(params.token[0] ?? '').trim()
      : ''

  const [items, setItems] = useState<Entrega[]>([])
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
      // Aseguramos que llegue como `estado`
      const rows: Entrega[] = (j.entregas ?? []).map((e: any) => ({
        id: e.id,
        orden: e.orden ?? null,
        subcliente: e.subcliente ?? null,
        direccion: e.direccion ?? null,
        localidad: e.localidad ?? null,
        provincia: e.provincia ?? null,
        remito: e.remito ?? null,
        estado_entregas: e.estado as Estado,          // <- normalizado
        observaciones: e.observaciones ?? null,
        completado_at: e.completado_at ?? null,
      }))
      setItems(rows)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  const marcar = async (id: string, estado: Estado) => {
    setErr(null)
    // Optimistic UI: marcar saving y estado temporal
    setItems(prev =>
      prev.map(e => (e.id === id ? { ...e, _saving: true, estado, completado_at: estado === 'completado' ? new Date().toISOString() : null } : e))
    )

    try {
      const r = await fetch(`/api/chofer/${token}/entregas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),   // <- valores: 'pendiente' | 'completado' | 'fallido'
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j?.error) {
        // rollback si falló
        setItems(prev => prev.map(e => (e.id === id ? { ...e, _saving: false } : e)))
        setErr(j?.error || `HTTP ${r.status}`)
        return
      }
      // Refrescar desde servidor para quedar consistentes
      await load()
    } catch (e: any) {
      setItems(prev => prev.map(ent => (ent.id === id ? { ...ent, _saving: false } : ent)))
      setErr(String(e?.message || e))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (!token) return <div className="p-6 text-red-600">Token inválido</div>
  if (loading) return <div className="p-6">Cargando…</div>
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>
  if (!items?.length) return <div className="p-6">No hay entregas.</div>

  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Entregas asignadas</h1>
      <ul className="space-y-2">
        {items.map((e) => (
          <li key={e.id} className="border rounded p-3">
            <div className="font-medium">{e.subcliente ?? '—'}</div>
            <div className="text-sm text-gray-600">{e.direccion ?? '—'}</div>
            <div className="text-sm mt-1">
              Estado: <b>{e.estado}</b>
              {e.completado_at ? ` · ${new Date(e.completado_at).toLocaleString()}` : ''}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                className="border rounded px-2 py-1"
                disabled={e._saving}
                onClick={() => marcar(e.id, 'completado')}
              >
                {e._saving && e.estado === 'completado' ? 'Guardando…' : 'Completado'}
              </button>
              <button
                className="border rounded px-2 py-1"
                disabled={e._saving}
                onClick={() => marcar(e.id, 'pendiente')}
              >
                {e._saving && e.estado === 'pendiente' ? 'Guardando…' : 'Pendiente'}
              </button>
              <button
                className="border rounded px-2 py-1"
                disabled={e._saving}
                onClick={() => marcar(e.id, 'fallido')}
              >
                {e._saving && e.estado === 'fallido' ? 'Guardando…' : 'Fallido'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
