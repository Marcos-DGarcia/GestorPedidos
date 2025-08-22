// app/operaciones/viajes/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type EstadoDB = 'programado' | 'en_progreso' | 'completado' | 'cancelado'
type Orden = 'desc' | 'asc'

type Viaje = {
  id: string
  descripcion: string
  fecha_programada: string
  estado: EstadoDB | string
  solicitud?: {
    cliente_id: string
    cliente_nombre: string
  } | null
  asignaciones: Array<{
    id: string
    vehiculo_patente?: string
    vehiculo_desc?: string
    chofer_nombre?: string
  }>
}

type Cliente = { id: string; nombre: string }

const asId = (v: unknown) => String(v ?? '')
const asStr = (v: unknown) => String(v ?? '')

export default function ListaViajes() {
  const [viajes, setViajes] = useState<Viaje[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({})

  const [filtroEstado, setFiltroEstado] = useState<'' | EstadoDB>('')
  const [clienteFiltroId, setClienteFiltroId] = useState<string>('') // '' = todos
  const [orden, setOrden] = useState<Orden>('desc')

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // --- Clientes para filtro ---
  const fetchClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error clientes:', error)
      setClientes([]); setClientesMap({})
      return
    }

    const rows = (data ?? []) as Array<{ id: unknown; nombre: unknown }>
    const safe: Cliente[] = rows
      .map(r => ({ id: asId(r.id), nombre: asStr(r.nombre) }))
      .filter(c => c.id && c.nombre)

    setClientes(safe)
    const map: Record<string, string> = {}
    for (const c of safe) map[c.id] = c.nombre
    setClientesMap(map)
  }

  // --- Viajes con filtros/orden ---
  const fetchViajes = async () => {
    setLoading(true)
    setErrorMsg(null)

    // Si hay filtro por cliente, forzamos INNER JOIN con solicitudes
    const selectStr = clienteFiltroId
      ? `
        id, descripcion, fecha_programada, estado,
        solicitudes:solicitudes!inner ( cliente_id ),
        vehiculos_asignados (
          id,
          vehiculos ( patente, descripcion ),
          choferes ( nombre )
        )
      `
      : `
        id, descripcion, fecha_programada, estado,
        solicitudes:solicitudes ( cliente_id ),
        vehiculos_asignados (
          id,
          vehiculos ( patente, descripcion ),
          choferes ( nombre )
        )
      `

    let q = supabase.from('viajes').select(selectStr)

    if (filtroEstado) q = q.eq('estado', filtroEstado)
    if (clienteFiltroId) q = q.eq('solicitudes.cliente_id', clienteFiltroId)

    q = q.order('fecha_programada', { ascending: orden === 'asc' })

    type RowDB = {
      id: unknown
      descripcion?: unknown
      fecha_programada?: unknown
      estado?: unknown
      solicitudes?: { cliente_id?: unknown } | null
      vehiculos_asignados?: Array<{
        id?: unknown
        vehiculos?: { patente?: unknown; descripcion?: unknown } | null
        choferes?: { nombre?: unknown } | null
      }>
    }

    const { data, error } = await q.returns<RowDB[]>()
    if (error) {
      console.error('Error viajes:', error)
      setErrorMsg('Error al traer viajes.')
      setViajes([]); setLoading(false)
      return
    }

    const rows = data ?? []
    const safe: Viaje[] = rows.map(r => {
      const cliente_id = asId(r.solicitudes?.cliente_id)
      return {
        id: asId(r.id),
        descripcion: asStr(r.descripcion),
        fecha_programada: asStr(r.fecha_programada),
        estado: asStr(r.estado),
        solicitud: r.solicitudes
          ? { cliente_id, cliente_nombre: clientesMap[cliente_id] || '' }
          : null,
        asignaciones: (r.vehiculos_asignados ?? []).map(a => ({
          id: asId(a.id),
          vehiculo_patente: a.vehiculos?.patente ? asStr(a.vehiculos.patente) : undefined,
          vehiculo_desc: a.vehiculos?.descripcion ? asStr(a.vehiculos.descripcion) : undefined,
          chofer_nombre: a.choferes?.nombre ? asStr(a.choferes.nombre) : undefined,
        })),
      }
    })

    setViajes(safe)
    setLoading(false)
  }

  useEffect(() => { fetchClientes() }, [])
  useEffect(() => { fetchViajes() }, [filtroEstado, clienteFiltroId, orden, clientesMap])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Viajes (Operaciones)</h1>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Estado:</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as '' | EstadoDB)}
            className="border p-2 rounded"
          >
            <option value="">Todos</option>
            <option value="programado">Programado</option>
            <option value="en_progreso">En progreso</option>
            <option value="completado">Completado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Cliente:</span>
          <select
            value={clienteFiltroId}
            onChange={(e) => setClienteFiltroId(e.target.value)}
            className="border p-2 rounded min-w-[220px]"
          >
            <option value="">Todos</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Orden:</span>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            className="border p-2 rounded"
          >
            <option value="desc">Más recientes</option>
            <option value="asc">Más antiguos</option>
          </select>
        </label>

        <button
          onClick={() => { setFiltroEstado(''); setClienteFiltroId(''); setOrden('desc') }}
          className="border px-3 py-2 rounded hover:bg-gray-50"
          title="Limpiar filtros"
        >
          Limpiar filtros
        </button>
      </div>

      {loading && <p>Cargando…</p>}
      {errorMsg && <p className="text-red-600">{errorMsg}</p>}

      {!loading && !errorMsg && (
        <div className="space-y-4">
          {viajes.map((viaje) => (
            <div key={viaje.id} className="p-4 border rounded shadow">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p><strong>Fecha:</strong> {viaje.fecha_programada || '—'}</p>
                  <p><strong>Cliente:</strong> {viaje.solicitud?.cliente_nombre || clientesMap[viaje.solicitud?.cliente_id || ''] || '—'}</p>
                  <p><strong>Descripción:</strong> {viaje.descripcion || '—'}</p>
                  <p className="mt-1">
                    <strong>Estado:</strong>{' '}
                    <span className={`px-2 py-1 rounded text-white ${getEstadoColor(viaje.estado)}`}>
                      {toNiceEstado(viaje.estado)}
                    </span>
                  </p>

                  {viaje.asignaciones.length > 0 && (
                    <div className="mt-2">
                      <p><strong>Chofer:</strong> {viaje.asignaciones[0]?.chofer_nombre || '—'}</p>
                      <p><strong>Vehículos:</strong></p>
                      <ul className="list-disc list-inside ml-4 text-sm">
                        {viaje.asignaciones.map(a => (
                          <li key={a.id}>
                            {a.vehiculo_patente || '—'}
                            {a.vehiculo_desc ? ` - ${a.vehiculo_desc}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <Link
                  href={`/operaciones/viajes/${viaje.id}`}
                  className="text-blue-600 underline whitespace-nowrap"
                >
                  Asignar chofer y vehículo
                </Link>
              </div>
            </div>
          ))}

          {viajes.length === 0 && (
            <div className="border rounded p-4 text-center text-gray-500 italic">
              No hay viajes con los filtros actuales.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function toNiceEstado(estado: string) {
  switch (estado) {
    case 'programado': return 'Programado'
    case 'en_progreso': return 'En progreso'
    case 'completado': return 'Completado'
    case 'cancelado': return 'Cancelado'
    default: return estado
  }
}

function getEstadoColor(estado: string) {
  switch (estado) {
    case 'programado': return 'bg-yellow-500'
    case 'en_progreso': return 'bg-blue-600'
    case 'completado': return 'bg-green-600'
    case 'cancelado': return 'bg-red-600'
    default: return 'bg-gray-500'
  }
}
