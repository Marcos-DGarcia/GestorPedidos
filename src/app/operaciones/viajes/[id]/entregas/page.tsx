// app/operaciones/viajes/[id]/entregas/page.tsx  (client)
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function EntregasOperaciones({ params: { id } }: { params: { id: string } }) {
  const [rows, setRows] = useState<any[]>([])

  async function load() {
    const { data } = await supabase
      .from('viajes_entregas')
      .select('*')
      .eq('viaje_id', id)
      .order('orden', { ascending: true })
    setRows(data ?? [])
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`ve-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes_entregas', filter: `viaje_id=eq.${id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  const total = rows.length
  const done = rows.filter(r => r.estado_entrega === 'entregado').length

  return (
    <div className="p-4">
      <div className="mb-3 font-medium">Progreso: {done}/{total}</div>
      <table className="w-full text-sm">
        <thead><tr><th>Orden</th><th>Prioridad</th><th>Cliente</th><th>Dirección</th><th>Remitos</th><th>Obs.</th><th>Estado</th><th>Fecha real</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.orden}</td><td>{r.prioridad}</td><td>{r.cliente_entrega}</td><td>{r.direccion}</td>
              <td>{r.remitos}</td><td>{r.observaciones}</td><td>{r.estado_entrega}</td><td>{r.fecha_entrega_real ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
