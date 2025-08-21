'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getUsuarioActual } from '@/utils/usuario'
import { useRouter } from 'next/navigation'

// Tipos + helpers
type EstadoSolicitud = 'pendiente' | 'confirmado' | 'modificado' | 'cerrado' | 'cancelada'
type TipoSolicitud = 'punto_a_punto' | 'reparto'

type Solicitud = {
  id: string
  fecha_necesaria: string
  descripcion: string
  tipo: TipoSolicitud
  estado: EstadoSolicitud
  archivo_adjunto: string | null
  cliente_id: string
}

const asId = (v: unknown) => String(v ?? '')

export default function SolicitudesClientePage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [estadoFiltro, setEstadoFiltro] = useState<'todas' | EstadoSolicitud>('todas')
  const [cargando, setCargando] = useState(true)
  const router = useRouter()

  const cargarSolicitudes = async () => {
    setCargando(true)

    // 1) Usuario actual normalizado
    const usuario = await getUsuarioActual().catch(() => null as any)
    const usuarioId = asId(usuario?.id)
    const usuarioRol = String(usuario?.rol ?? '')

    if (!usuarioId || usuarioRol !== 'cliente') {
      alert('No autorizado')
      router.push('/')
      return
    }

    // 2) Construir query en pasos (evita el 'unknown' y el select('*'))
    let q = supabase
      .from('solicitudes')
      .select('id, fecha_necesaria, descripcion, tipo, estado, archivo_adjunto, cliente_id')
      .eq('cliente_id', usuarioId)
      .order('fecha_necesaria', { ascending: false })

    if (estadoFiltro !== 'todas') {
      q = q.eq('estado', estadoFiltro)
    }

    const { data, error } = await q

    if (error) {
      console.error('Error al traer solicitudes:', error)
      setSolicitudes([])
      setCargando(false)
      return
    }

    // 3) Normalizar filas a tipo fuerte
    const rows = (data ?? []) as Array<{
      id: unknown
      fecha_necesaria?: unknown
      descripcion?: unknown
      tipo?: unknown
      estado?: unknown
      archivo_adjunto?: unknown
      cliente_id: unknown
    }>

    const safe: Solicitud[] = rows
      .map((r) => {
        const tipoRaw = String(r.tipo ?? 'punto_a_punto')
        const tipo: TipoSolicitud = tipoRaw === 'reparto' ? 'reparto' : 'punto_a_punto'
        const estadoRaw = String(r.estado ?? 'pendiente') as EstadoSolicitud

        return {
          id: asId(r.id),
          fecha_necesaria: String(r.fecha_necesaria ?? ''),
          descripcion: String(r.descripcion ?? ''),
          tipo,
          estado: estadoRaw,
          archivo_adjunto: r.archivo_adjunto ? String(r.archivo_adjunto) : null,
          cliente_id: asId(r.cliente_id),
        }
      })
      .filter((s) => s.id)

    setSolicitudes(safe)
    setCargando(false)
  }

  useEffect(() => {
    cargarSolicitudes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoFiltro])

  const cancelarSolicitud = async (id: string) => {
    const confirmar = confirm('¿Estás seguro de cancelar esta solicitud?')
    if (!confirmar) return

    const { error } = await supabase
      .from('solicitudes')
      .update({ estado: 'cancelada' })
      .eq('id', id)

    if (error) {
      alert('Error al cancelar la solicitud')
    } else {
      cargarSolicitudes()
    }
  }

  const obtenerIconoEstado = (estado: EstadoSolicitud) => {
    switch (estado) {
      case 'pendiente':
        return '🟡'
      case 'confirmado':
        return '🟢'
      case 'cancelada':
        return '🔴'
      case 'modificado':
        return '🟠'
      case 'cerrado':
        return '🔵'
      default:
        return ''
    }
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mis Solicitudes</h1>
        <button
          onClick={() => router.push('/solicitudes/nueva')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Nueva solicitud
        </button>
      </div>

      {/* Filtro por estado */}
      <div className="mb-6 flex gap-2">
        {(['todas', 'pendiente', 'confirmado', 'modificado', 'cerrado', 'cancelada'] as const).map(
          (estado) => (
            <button
              key={estado}
              onClick={() => setEstadoFiltro(estado)}
              className={`px-3 py-1 rounded border ${
                estadoFiltro === estado
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-800 hover:bg-gray-100'
              }`}
            >
              {estado.charAt(0).toUpperCase() + estado.slice(1)}
            </button>
          )
        )}
      </div>

      {cargando ? (
        <p>Cargando...</p>
      ) : solicitudes.length === 0 ? (
        <p>No hay solicitudes registradas.</p>
      ) : (
        <ul className="space-y-4">
          {solicitudes.map((solicitud) => (
            <li key={solicitud.id} className="border p-4 rounded shadow bg-white">
              <p>
                <strong>Fecha:</strong> {solicitud.fecha_necesaria}
              </p>
              <p>
                <strong>Tipo:</strong> {solicitud.tipo}
              </p>
              <p>
                <strong>Descripción:</strong> {solicitud.descripcion}
              </p>
              <p>
                <strong>Estado:</strong> {obtenerIconoEstado(solicitud.estado)} {solicitud.estado}
              </p>

              {solicitud.archivo_adjunto ? (
                <a
                  href={solicitud.archivo_adjunto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Ver archivo adjunto
                </a>
              ) : (
                <p className="italic text-gray-500">Sin archivo adjunto</p>
              )}

              {solicitud.estado === 'pendiente' && (
                <button
                  onClick={() => cancelarSolicitud(solicitud.id)}
                  className="mt-2 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Cancelar solicitud
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
