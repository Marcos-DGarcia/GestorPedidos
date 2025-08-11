// panel_viajes.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

export default function ListaViajes() {
  const [viajes, setViajes] = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('todos')

  useEffect(() => {
    const fetchViajes = async () => {
      let query = supabase
        .from('viajes')
        .select(`
          *,
          solicitudes (
            descripcion,
            cliente_id,
            clientes (nombre)
          ),
          vehiculos_asignados (
            id,
            vehiculos (patente, descripcion),
            choferes (nombre)
          )
        `)
        .order('fecha_programada', { ascending: false })


      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error al traer viajes:', error)
      } else {
        setViajes(data)
      }
    }

    fetchViajes()
  }, [filtroEstado])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Viajes programados</h1>

      <div className="mb-4">
        <label className="mr-2">Filtrar por estado:</label>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="todos">Todos</option>
          <option value="programado">Programado</option>
          <option value="asignado">Asignado</option>
          <option value="realizado">Realizado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <div className="space-y-4">
        {viajes.map((viaje) => (
          <div key={viaje.id} className="p-4 border rounded shadow">
            <div className="flex justify-between items-center">
              <div>
                <p><strong>Fecha:</strong> {viaje.fecha_programada}</p>
                <p><strong>Cliente:</strong> {viaje.solicitudes?.clientes?.nombre || 'Sin nombre'}</p>
                <p><strong>Descripción:</strong> {viaje.descripcion}</p>
                <p>
                  <strong>Estado:</strong>{' '}
                  <span className={`px-2 py-1 rounded text-white ${getEstadoColor(viaje.estado)}`}>
                    {viaje.estado}
                  </span>
                </p>
                {viaje.vehiculos_asignados?.length > 0 && (
                  <div className="mt-2">
                    <p><strong>Chofer:</strong> {viaje.vehiculos_asignados[0]?.choferes?.nombre || '—'}</p>
                    <p><strong>Vehículos:</strong></p>
                    <ul className="list-disc list-inside ml-4 text-sm">
                      {viaje.vehiculos_asignados.map((a: any) => (
                        <li key={a.id}>
                          {a.vehiculos?.patente} - {a.vehiculos?.descripcion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
              <Link
                href={`/operaciones/viajes/${viaje.id}`}
                className="text-blue-600 underline"
              >
                Asignar chofer y vehículo
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getEstadoColor(estado: string) {
  switch (estado) {
    case 'programado':
      return 'bg-yellow-500'
    case 'asignado':
      return 'bg-blue-500'
    case 'realizado':
      return 'bg-green-600'
    case 'cancelado':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}
