// app/operaciones/viajes/[id]/entregas/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Row = {
  id: string
  orden: number | null
  prioridad?: number | null
  cliente_entrega?: string | null
  direccion?: string | null
  localidad?: string | null
  provincia?: string | null
  remitos?: string | null
  observaciones?: string | null
  estado_entrega?: string | null
  fecha_entrega_real?: string | null
  viaje_id: string
}

export default function EntregasOperaciones() {
  // ⬇️ tomamos el id de la URL en cliente
  const { id } = useParams<{ id: string }>()
  const viajeId = String(id)

  const [rows, setRows] = useState<Row[]>([])

  async function load() {
    const { data } = await supabase
      .from('viajes_entregas')
      .select('*')
      .eq('viaje_id', viajeId)
      .order('orden', { ascending: true })
    setRows((data as Row[]) ?? [])
  }

  useEffect(() => {
    if (!viajeId) return
    load()
    // suscripción a cambios en las entregas de este viaje
    const channel = supabase
      .channel(`ve-${viajeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'viajes_entregas', filter: `viaje_id=eq.${viajeId}` },
        load
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [viajeId])

  const total = rows.length
  const done = rows.filter(r => r.estado_entrega === 'entregado').length

  return (
    <div className="p-4">
      <div className="mb-3 font-medium">Progreso: {done}/{total}</div>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">Orden</th>
            <th className="text-left">Prioridad</th>
            <th className="text-left">Cliente</th>
            <th className="text-left">Dirección</th>
            <th className="text-left">Remitos</th>
            <th className="text-left">Obs.</th>
            <th className="text-left">Estado</th>
            <th className="text-left">Fecha real</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.orden ?? ''}</td>
              <td>{r.prioridad ?? ''}</td>
              <td>{r.cliente_entrega ?? ''}</td>
              <td>{r.direccion ?? ''}</td>
              <td>{r.remitos ?? ''}</td>
              <td>{r.observaciones ?? ''}</td>
              <td>{r.estado_entrega ?? ''}</td>
              <td>{r.fecha_entrega_real ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
