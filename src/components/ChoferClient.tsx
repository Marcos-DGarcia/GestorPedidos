'use client'

import { useState } from 'react'

type Entrega = {
  id: string
  orden: number | null
  subcliente: string | null
  direccion: string | null
  localidad: string | null
  provincia: string | null
  remito: string | null
  estado: 'pendiente' | 'en_progreso' | 'completado' | 'fallido'
  observaciones: string | null
  completado_at: string | null
  entregado_at?: string | null
  fallido_at?: string | null
}

function Item({ e, onMark }: { e: Entrega; onMark: (id: string, estado: 'completado' | 'fallido') => void }) {
  return (
    <div className="border rounded p-3 mb-2">
      <div className="font-medium">#{e.orden ?? '-'} — {e.subcliente ?? 'Entrega'}</div>
      <div>{e.direccion ?? '-'}, {e.localidad ?? '-'}, {e.provincia ?? '-'}</div>
      <div>Remito: {e.remito ?? '-'}</div>
      <div>Obs: {e.observaciones ?? '-'}</div>
      <div className="text-sm mt-1">Estado: <b>{e.estado}</b></div>

      <div className="mt-2 flex gap-2">
        <button
          className="px-3 py-2 rounded bg-green-600 text-white"
          onClick={() => onMark(e.id, 'completado')}
          disabled={e.estado === 'completado'}
        >
          Completado
        </button>
        <button
          className="px-3 py-2 rounded bg-red-600 text-white"
          onClick={() => onMark(e.id, 'fallido')}
          disabled={e.estado === 'fallido'}
        >
          Fallido
        </button>
      </div>
    </div>
  )
}

export default function ChoferClient({ token, initialEntregas }: { token: string; initialEntregas: Entrega[] }) {
  const [items, setItems] = useState<Entrega[]>(initialEntregas)

  const done = items.filter(i => i.estado === 'completado' || i.estado === 'fallido').length

  async function onMark(id: string, estado: 'completado' | 'fallido') {
    try {
      const r = await fetch(`/api/chofer/${token}/entregas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado })
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(`Error al actualizar: ${err?.error ?? r.statusText}`)
        return
      }

      const now = new Date().toISOString()
      setItems(prev =>
        prev.map(i => {
          if (i.id !== id) return i
          const patch: Partial<Entrega> =
            estado === 'completado'
              ? { estado, completado_at: now, entregado_at: now, fallido_at: null }
              : { estado, completado_at: now, fallido_at: now, entregado_at: null }
          return { ...i, ...patch }
        })
      )
    } catch (e) {
      alert(`Error inesperado: ${String(e)}`)
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-3">
        Entregas ({done}/{items.length})
      </h1>
      {items.map(e => <Item key={e.id} e={e} onMark={onMark} />)}
    </div>
  )
}
