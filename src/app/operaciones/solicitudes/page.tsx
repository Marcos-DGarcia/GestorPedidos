'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type EstadoFiltro = '' | 'pendiente' | 'confirmado' | 'modificado' | 'cerrado' | 'cancelado'
type TipoSolicitud = 'punto_a_punto' | 'reparto'
type Orden = 'desc' | 'asc'

type Solicitud = {
  id: string
  fecha_necesaria: string
  descripcion: string
  tipo: TipoSolicitud
  estado: string
  cliente_id: string
  archivo_adjunto: string | null
}

type Cliente = { id: string; nombre: string }
const asId = (v: unknown) => String(v ?? '')

export default function SolicitudesOperacionesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({})

  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('')
  const [clienteFiltroId, setClienteFiltroId] = useState<string>('') // '' = todos
  const [orden, setOrden] = useState<Orden>('desc') // desc = más recientes primero

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Traer clientes para el filtro
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

    const rows = (data ?? []) as Array<{ id: unknown; nombre: unknown }>
    const safe: Cliente[] = rows
      .map((r) => ({ id: asId(r.id), nombre: String(r.nombre ?? '') }))
      .filter((c) => c.id && c.nombre)

    setClientes(safe)
    const map: Record<string, string> = {}
    for (const c of safe) map[c.id] = c.nombre
    setClientesMap(map)
  }

  // Traer solicitudes con filtros/orden
  const fetchSolicitudes = async () => {
    setLoading(true)
    setErrorMsg(null)

    let q = supabase
      .from('solicitudes')
      .select('id, fecha_necesaria, descripcion, tipo, estado, cliente_id, archivo_adjunto')

    if (estadoFiltro) q = q.eq('estado', estadoFiltro)
    if (clienteFiltroId) q = q.eq('cliente_id', clienteFiltroId)

    q = q.order('fecha_necesaria', { ascending: orden === 'asc' })

    const { data, error } = await q
    if (error) {
      setErrorMsg('Error al cargar solicitudes.')
      setSolicitudes([])
      setLoading(false)
      return
    }

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
        const tipo: TipoSolicitud = tipoRaw === 'reparto' ? 'reparto' : 'punto_a_punto'
        return {
          id: asId(r.id),
          fecha_necesaria: String(r.fecha_necesaria ?? ''),
          descripcion: String(r.descripcion ?? ''),
          tipo,
          estado: String(r.estado ?? ''),
          cliente_id: asId(r.cliente_id),
          archivo_adjunto: r.archivo_adjunto ? String(r.archivo_adjunto) : null,
        }
      })
      .filter((s) => s.id)

    setSolicitudes(safe)
    setLoading(false)
  }

  useEffect(() => {
    fetchClientes()
  }, [])

  useEffect(() => {
    fetchSolicitudes()
  }, [estadoFiltro, clienteFiltroId, orden])

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Solicitudes (Operaciones)</h1>
        <Link
          href="/operaciones/solicitudes/nueva"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Nueva solicitud
        </Link>
      </div>

      {/* Controles de filtro/orden */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Estado:</span>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
            className="border p-2 rounded"
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmado">Confirmado</option>
            <option value="modificado">Modificado</option>
            <option value="cerrado">Cerrado</option>
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
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
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
          onClick={() => {
            setEstadoFiltro('')
            setClienteFiltroId('')
            setOrden('desc')
          }}
          className="border px-3 py-2 rounded hover:bg-gray-50"
          title="Limpiar filtros"
        >
          Limpiar filtros
        </button>
      </div>

      {loading && <p>Cargando…</p>}
      {errorMsg && <p className="text-red-600">{errorMsg}</p>}

      {!loading && !errorMsg && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Fecha</th>
              <th className="border p-2">Cliente</th>
              <th className="border p-2">Descripción</th>
              <th className="border p-2">Tipo</th>
              <th className="border p-2">Estado</th>
              <th className="border p-2">Archivo</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.id}>
                <td className="border p-2">{s.fecha_necesaria}</td>
                <td className="border p-2">{clientesMap[s.cliente_id] || '—'}</td>
                <td className="border p-2">{s.descripcion}</td>
                <td className="border p-2">{s.tipo}</td>
                <td className="border p-2 capitalize">{s.estado}</td>
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
              </tr>
            ))}
            {solicitudes.length === 0 && (
              <tr>
                <td colSpan={6} className="border p-4 text-center text-gray-500 italic">
                  No hay solicitudes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
