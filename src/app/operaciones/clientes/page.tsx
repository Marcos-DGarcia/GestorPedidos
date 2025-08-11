'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function PanelClientes() {
  const [clientes, setClientes] = useState<any[]>([])
  const [form, setForm] = useState({
    nombre: '',
    cuit: '',
    contacto: '',
    es_portal: true,
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    fetchClientes()
  }, [])

  const fetchClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) console.error('Error al cargar clientes:', error)
    setClientes(data || [])
  }

  const handleChange = (e: any) => {
    const { name, type, checked, value } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  const handleSubmit = async () => {
    if (!form.nombre || !form.cuit) {
      setMensaje('Nombre y CUIT son obligatorios.')
      return
    }

    const nuevoRegistro = { ...form } // sin usuario_id

    if (editId) {
      const { error } = await supabase
        .from('clientes')
        .update(nuevoRegistro)
        .eq('id', editId)

      if (error) {
        console.error('Error al actualizar:', error)
        setMensaje('Error al actualizar cliente.')
        return
      }

      setMensaje('Cliente actualizado correctamente.')
    } else {
      const { error } = await supabase
        .from('clientes')
        .insert(nuevoRegistro)

      if (error) {
        console.error('Error al insertar:', error)
        setMensaje('Error al agregar cliente.')
        return
      }

      setMensaje('Cliente agregado correctamente.')
    }

    setForm({ nombre: '', cuit: '', contacto: '', es_portal: true })
    setEditId(null)
    fetchClientes()
  }

  const handleEditar = (cliente: any) => {
    setForm({
      nombre: cliente.nombre,
      cuit: cliente.cuit,
      contacto: cliente.contacto,
      es_portal: cliente.es_portal,
    })
    setEditId(cliente.id)
    setMensaje('')
  }

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Seguro que desea eliminar este cliente?')) return

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error al eliminar:', error)
      setMensaje('Error al eliminar cliente.')
    } else {
      setMensaje('Cliente eliminado correctamente.')
      fetchClientes()
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gestión de Clientes</h1>

      <div className="bg-gray-100 p-4 rounded mb-6">
        <h2 className="font-semibold mb-2">{editId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            name="nombre"
            placeholder="Nombre"
            value={form.nombre}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <input
            type="text"
            name="cuit"
            placeholder="CUIT"
            value={form.cuit}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <input
            type="text"
            name="contacto"
            placeholder="Contacto"
            value={form.contacto}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <label className="flex items-center">
            <input
              type="checkbox"
              name="es_portal"
              checked={form.es_portal}
              onChange={handleChange}
              className="mr-2"
            />
            Acceso al portal
          </label>
        </div>

        <button
          onClick={handleSubmit}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {editId ? 'Actualizar' : 'Agregar'}
        </button>

        {mensaje && <p className="mt-2 text-red-600">{mensaje}</p>}
      </div>

      <h2 className="text-xl font-semibold mb-2">Lista de Clientes</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-2 py-1 text-left">Nombre</th>
              <th className="border px-2 py-1 text-left">CUIT</th>
              <th className="border px-2 py-1 text-left">Contacto</th>
              <th className="border px-2 py-1 text-left">Portal</th>
              <th className="border px-2 py-1 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id}>
                <td className="border px-2 py-1">{c.nombre}</td>
                <td className="border px-2 py-1">{c.cuit}</td>
                <td className="border px-2 py-1">{c.contacto}</td>
                <td className="border px-2 py-1">{c.es_portal ? 'Sí' : 'No'}</td>
                <td className="border px-2 py-1 text-center">
                  <button onClick={() => handleEditar(c)} className="text-blue-600 mr-2">Editar</button>
                  <button onClick={() => handleEliminar(c.id)} className="text-red-600">Eliminar</button>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-500">No hay clientes registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

