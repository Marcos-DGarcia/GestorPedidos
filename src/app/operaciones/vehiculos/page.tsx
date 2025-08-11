'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function PanelVehiculos() {
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [tipos, setTipos] = useState<any[]>([])
  const [form, setForm] = useState({
    patente: '',
    numero_interno: '',
    tipo_id: '',
    descripcion: '',
    es_contratado: false,
    activo: true,
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: vehiculosData } = await supabase
      .from('vehiculos')
      .select('*, tipos_vehiculo(nombre)')
      .order('patente', { ascending: true })

    const { data: tiposData } = await supabase
      .from('tipos_vehiculo')
      .select('*')
      .order('nombre')

    setVehiculos(vehiculosData || [])
    setTipos(tiposData || [])
  }

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target
    const val = type === 'checkbox' ? checked : value
    setForm({ ...form, [name]: val })
  }

  const handleSubmit = async () => {
    if (!form.patente || !form.tipo_id) {
      setMensaje('La patente y tipo son obligatorios.')
      return
    }

    if (editId) {
      const { error } = await supabase.from('vehiculos').update(form).eq('id', editId)
      if (error) {
        console.error('Error al actualizar:', error)
        setMensaje('Error al actualizar.')
      } else {
        setMensaje('Vehículo actualizado.')
      }
    } else {
      const { error } = await supabase.from('vehiculos').insert(form)
      if (error) {
        console.error('Error al insertar:', error)
        setMensaje('Error al agregar vehículo.')
      } else {
        setMensaje('Vehículo agregado.')
      }
    }

    setForm({
      patente: '',
      numero_interno: '',
      tipo_id: '',
      descripcion: '',
      es_contratado: false,
      activo: true,
    })
    setEditId(null)
    fetchData()
  }

  const handleEditar = (vehiculo: any) => {
    setForm({
      patente: vehiculo.patente,
      numero_interno: vehiculo.numero_interno,
      tipo_id: vehiculo.tipo_id,
      descripcion: vehiculo.descripcion,
      es_contratado: vehiculo.es_contratado,
      activo: vehiculo.activo,
    })
    setEditId(vehiculo.id)
    setMensaje('')
  }

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar este vehículo?')) return
    const { error } = await supabase.from('vehiculos').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar:', error)
      setMensaje('Error al eliminar.')
    } else {
      setMensaje('Vehículo eliminado.')
      fetchData()
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gestión de Vehículos</h1>

      <div className="bg-gray-100 p-4 rounded mb-6">
        <h2 className="font-semibold mb-2">{editId ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            name="patente"
            placeholder="Patente"
            value={form.patente}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <input
            type="text"
            name="numero_interno"
            placeholder="Número interno"
            value={form.numero_interno}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <select
            name="tipo_id"
            value={form.tipo_id}
            onChange={handleChange}
            className="border p-2 rounded"
          >
            <option value="">Seleccionar tipo</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
          <input
            type="text"
            name="descripcion"
            placeholder="Descripción"
            value={form.descripcion}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <label className="flex items-center">
            <input
              type="checkbox"
              name="es_contratado"
              checked={form.es_contratado}
              onChange={handleChange}
              className="mr-2"
            />
            Contratado
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              name="activo"
              checked={form.activo}
              onChange={handleChange}
              className="mr-2"
            />
            Activo
          </label>
        </div>
        <button
          onClick={handleSubmit}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {editId ? 'Actualizar' : 'Agregar'}
        </button>
        {mensaje && <p className="mt-2 text-sm text-red-600">{mensaje}</p>}
      </div>

      <h2 className="text-xl font-semibold mb-2">Lista de Vehículos</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-2 py-1 text-left">Patente</th>
              <th className="border px-2 py-1 text-left">Interno</th>
              <th className="border px-2 py-1 text-left">Tipo</th>
              <th className="border px-2 py-1 text-left">Descripción</th>
              <th className="border px-2 py-1 text-left">Contratado</th>
              <th className="border px-2 py-1 text-left">Activo</th>
              <th className="border px-2 py-1 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehiculos.map((v) => (
              <tr key={v.id}>
                <td className="border px-2 py-1">{v.patente}</td>
                <td className="border px-2 py-1">{v.numero_interno}</td>
                <td className="border px-2 py-1">{v.tipos_vehiculo?.nombre || '-'}</td>
                <td className="border px-2 py-1">{v.descripcion}</td>
                <td className="border px-2 py-1">{v.es_contratado ? 'Sí' : 'No'}</td>
                <td className="border px-2 py-1">{v.activo ? 'Sí' : 'No'}</td>
                <td className="border px-2 py-1 text-center">
                  <button onClick={() => handleEditar(v)} className="text-blue-600 mr-2">Editar</button>
                  <button onClick={() => handleEliminar(v.id)} className="text-red-600">Eliminar</button>
                </td>
              </tr>
            ))}
            {vehiculos.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-4 text-gray-500">No hay vehículos registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
