'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import dayjs from 'dayjs'

export default function Mantenimientos() {
  const [mantenimientos, setMantenimientos] = useState<any[]>([])
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [nuevo, setNuevo] = useState({
    vehiculo_id: '',
    fecha_inicio: '',
    fecha_fin: '',
    motivo: ''
  })

  useEffect(() => {
    const fetchData = async () => {
      const { data: vehiculosData } = await supabase
        .from('vehiculos')
        .select('id, patente, descripcion')
        .eq('activo', true)

      const { data: mantenimientosData } = await supabase
        .from('vehiculos_mantenimiento')
        .select('*, vehiculos (patente)')
        .order('fecha_inicio', { ascending: false })

      setVehiculos(vehiculosData || [])
      setMantenimientos(mantenimientosData || [])
    }

    fetchData()
  }, [])

  const guardar = async () => {
    const { error } = await supabase.from('vehiculos_mantenimiento').insert([nuevo])
    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      setNuevo({ vehiculo_id: '', fecha_inicio: '', fecha_fin: '', motivo: '' })
      location.reload()
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gestión de Mantenimientos</h1>

      <div className="bg-gray-100 p-4 rounded mb-6">
        <h2 className="font-semibold mb-2">Nuevo mantenimiento</h2>
        <select
          value={nuevo.vehiculo_id}
          onChange={(e) => setNuevo({ ...nuevo, vehiculo_id: e.target.value })}
          className="mb-2 p-2 border rounded w-full"
        >
          <option value="">Seleccionar vehículo</option>
          {vehiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.patente} - {v.descripcion}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={nuevo.fecha_inicio}
          onChange={(e) => setNuevo({ ...nuevo, fecha_inicio: e.target.value })}
          className="mb-2 p-2 border rounded w-full"
          placeholder="Fecha inicio"
        />
        <input
          type="date"
          value={nuevo.fecha_fin}
          onChange={(e) => setNuevo({ ...nuevo, fecha_fin: e.target.value })}
          className="mb-2 p-2 border rounded w-full"
          placeholder="Fecha fin"
        />
        <input
          type="text"
          value={nuevo.motivo}
          onChange={(e) => setNuevo({ ...nuevo, motivo: e.target.value })}
          className="mb-2 p-2 border rounded w-full"
          placeholder="Motivo"
        />
        <button onClick={guardar} className="bg-blue-600 text-white px-4 py-2 rounded">
          Guardar mantenimiento
        </button>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Historial</h2>
        <table className="w-full border text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="border p-2">Vehículo</th>
              <th className="border p-2">Inicio</th>
              <th className="border p-2">Fin</th>
              <th className="border p-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {mantenimientos.map((m) => (
              <tr key={m.id}>
                <td className="border p-2">{m.vehiculos?.patente}</td>
                <td className="border p-2">{dayjs(m.fecha_inicio).format('DD/MM/YYYY')}</td>
                <td className="border p-2">{dayjs(m.fecha_fin).format('DD/MM/YYYY')}</td>
                <td className="border p-2">{m.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
