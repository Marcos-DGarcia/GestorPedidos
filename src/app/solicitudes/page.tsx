'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getUsuarioActual } from '@/utils/usuario'
import { useRouter } from 'next/navigation'

export default function SolicitudesClientePage() {
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [estadoFiltro, setEstadoFiltro] = useState<string>('todas')
  const [cargando, setCargando] = useState(true)
  const router = useRouter()

  const cargarSolicitudes = async () => {
    setCargando(true)
    const usuario = await getUsuarioActual()

    if (!usuario || usuario.rol !== 'cliente') {
      alert('No autorizado')
      router.push('/')
      return
    }

    let query = supabase
      .from('solicitudes')
      .select('*')
      .eq('cliente_id', usuario.id)
      .order('fecha_necesaria', { ascending: false }) // Más reciente primero

    if (estadoFiltro !== 'todas') {
      query = query.eq('estado', estadoFiltro)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al traer solicitudes:', error)
    } else {
      setSolicitudes(data)
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarSolicitudes()
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

  const obtenerIconoEstado = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return '🟡'
      case 'confirmada':
        return '🟢'
      case 'cancelada':
        return '🔴'
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
        {['todas', 'pendiente', 'confirmada', 'cancelada'].map((estado) => (
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
        ))}
      </div>

      {cargando ? (
        <p>Cargando...</p>
      ) : solicitudes.length === 0 ? (
        <p>No hay solicitudes registradas.</p>
      ) : (
        <ul className="space-y-4">
          {solicitudes.map((solicitud) => (
            <li key={solicitud.id} className="border p-4 rounded shadow bg-white">
              <p><strong>Fecha:</strong> {solicitud.fecha_necesaria}</p>
              <p><strong>Tipo:</strong> {solicitud.tipo}</p>
              <p><strong>Descripción:</strong> {solicitud.descripcion}</p>
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