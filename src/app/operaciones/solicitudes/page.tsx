'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

// Tipos + helpers
type Solicitud = {
  id: string
  fecha_necesaria: string
  descripcion: string
  tipo: 'punto_a_punto' | 'reparto'
  estado: string
  cliente_id: string
  archivo_adjunto: string | null
}
type Cliente = { id: string; nombre: string }
const asId = (v: unknown) => String(v ?? '')

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({})
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')

  const fetchSolicitudes = async () => {
    const { data, error } = await supabase
      .from('solicitudes')
      .select('id, fecha_necesaria, descripcion, tipo, estado, cliente_id, archivo_adjunto')
      .order('fecha_necesaria', { ascending: false })

    if (error) {
      console.error('Error al cargar solicitudes:', error)
      setSolicitudes([])
      return
    }

    // Normalizar a Solicitud[]
    const rows = (data ?? []) as Array<{
      id: unknown
      fecha_necesaria?: unknown
      descripcion?: unknown
      tipo?: unknown
      estado?: unknown
      cliente_id: unknown
      archivo_adjunto?: unknown
    }>

    const safe: Solicitud[] = rows
      .map((r) => {
        const tipoRaw = String(r.tipo ?? 'punto_a_punto')
        return {
          id: asId(r.id),
          fecha_necesaria: String(r.fecha_necesaria ?? ''),
          descripcion: String(r.descripcion ?? ''),
          tipo: (tipoRaw === 'reparto' ? 'reparto' : 'punto_a_punto') as 'punto_a_punto' | 'reparto',
          estado: String(r.estado ?? ''),
          cliente_id: asId(r.cliente_id),
          archivo_adjunto: r.archivo_adjunto ? String(r.archivo_adjunto) : null,
        }
      })
      .filter((s) => s.id) // quita filas inválidas

    setSolicitudes(safe)
  }

  const fetchClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error al cargar clientes:', error)
      setClientes([])
      setClientesMap({})
      return
    }

    // Normalizar a Cliente[] y map
    const rows = (data ?? []) as Array<{ id: unknown; nombre: unknown }>
    const safeClientes: Cliente[] = rows
      .map((r) => ({ id: asId(r.id), nombre: String(r.nombre ?? '') }))
      .filter((c) => c.id && c.nombre)

    setClientes(safeClientes)

    const map: Record<string, string> = {}
    for (const c of safeClientes) map[c.id] = c.nombre
    setClientesMap(map)
  }

  useEffect(() => {
    fetchSolicitudes()
    fetchClientes()
  }, [])

  const solicitudesFiltradas = solicitudes.filter((s) => {
    const nombreCliente = clientesMap[s.cliente_id] || ''
    return (
      (filtroEstado ? s.estado === filtroEstado : true) &&
      (filtroCliente
        ? nombreCliente.toLowerCase().includes(filtroCliente.toLowerCase())
        : true)
    )
  })

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4 items-center">
        <h1 className="text-2xl font-bold">Solicitudes</h1>
        <Link
          href="/operaciones/solicitudes/nueva"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Nueva solicitud
        </Link>
      </div>

      <div className="flex gap-4 mb-4">
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="confirmado">Confirmado</option>
          <option value="modificado">Modificado</option>
          <option value="cerrado">Cerrado</option>
          <option value="cancelado">Cancelado</option>
        </select>

        <input
          type="text"
          placeholder="Filtrar por nombre de cliente"
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Fecha</th>
            <th className="border p-2">Descripción</th>
            <th className="border p-2">Tipo</th>
            <th className="border p-2">Estado</th>
            <th className="border p-2">Cliente</th>
            <th className="border p-2">Archivo</th>
            <th className="border p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {solicitudesFiltradas.map((s) => (
            <tr key={s.id}>
              <td className="border p-2">{s.fecha_necesaria}</td>
              <td className="border p-2">{s.descripcion}</td>
              <td className="border p-2">{s.tipo}</td>
              <td className="border p-2 capitalize">{s.estado}</td>
              <td className="border p-2">{clientesMap[s.cliente_id] || 'Desconocido'}</td>
              <td className="border p-2 text-center">
                {s.archivo_adjunto ? (
                  <a
                    href={s.archivo_adjunto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-gray-100 px-2 py-1 rounded text-blue-700 hover:underline"
                  >
                    📎 Ver archivo
                  </a>
                ) : (
                  <span className="text-gray-500 italic">Sin archivo</span>
                )}
              </td>
              <td className="border p-2 space-x-2">
                <Link
                  href={`/operaciones/solicitudes/${s.id}`}
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Ver
                </Link>
                {s.estado === 'pendiente' && (
                  <button
                    className="text-red-600 underline hover:text-red-800"
                    onClick={async () => {
                      if (confirm('¿Estás seguro de cancelar esta solicitud?')) {
                        const { error } = await supabase
                          .from('solicitudes')
                          .update({ estado: 'cancelado' })
                          .eq('id', s.id)
                        if (error) {
                          alert('Error al cancelar')
                        } else {
                          fetchSolicitudes()
                        }
                      }
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
