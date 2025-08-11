'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function PanelChoferes() {
  const [choferes, setChoferes] = useState<any[]>([])
  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    email: '',
    tipo: 'Propio',
    observaciones: '',
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    fetchChoferes()
  }, [])

  const fetchChoferes = async () => {
    const { data, error } = await supabase.from('choferes').select('*').order('nombre', { ascending: true })
    if (error) console.error('Error al traer choferes:', error)
    else setChoferes(data)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!form.nombre || !form.telefono) {
      setMensaje('El nombre y teléfono son obligatorios.')
      return
    }

    if (editId) {
      const { error } = await supabase.from('choferes').update(form).eq('id', editId)
      if (error) {
        console.error('Error al editar chofer:', error)
        setMensaje('Error al editar chofer.')
      } else {
        setMensaje('Chofer actualizado correctamente.')
      }
    } else {
      const { error } = await supabase.from('choferes').insert({ ...form })
      if (error) {
        console.error('Error al agregar chofer:', error)
        setMensaje('Error al agregar chofer.')
      } else {
        setMensaje('Chofer agregado correctamente.')
      }
    }

    setForm({
      nombre: '',
      telefono: '',
      email: '',
      tipo: 'Propio',
      observaciones: '',
    })
    setEditId(null)
    fetchChoferes()
  }

  const handleEditar = (chofer: any) => {
    setForm({
      nombre: chofer.nombre,
      telefono: chofer.telefono,
      email: chofer.email,
      tipo: chofer.tipo,
      observaciones: chofer.observaciones,
    })
    setEditId(chofer.id)
    setMensaje('')
  }

  const handleEliminar = async (id: string) => {
    const confirm = window.confirm('¿Estás seguro de eliminar este chofer?')
    if (!confirm) return

    const { error } = await supabase.from('choferes').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar:', error)
      setMensaje('No se pudo eliminar el chofer.')
    } else {
      setMensaje('Chofer eliminado.')
      fetchChoferes()
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gestión de Choferes</h1>

      <div className="bg-gray-100 p-4 rounded mb-6">
        <h2 className="font-semibold mb-2">{editId ? 'Editar chofer' : 'Nuevo chofer'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" name="nombre" placeholder="Nombre" value={form.nombre} onChange={handleChange} className="border p-2 rounded" />
          <input type="text" name="telefono" placeholder="Teléfono" value={form.telefono} onChange={handleChange} className="border p-2 rounded" />
          <input type="email" name="email" placeholder="Email (opcional)" value={form.email} onChange={handleChange} className="border p-2 rounded" />
          <select name="tipo" value={form.tipo} onChange={handleChange} className="border p-2 rounded">
            <option value="Propio">Propio</option>
            <option value="Contratado">Contratado</option>
          </select>
          <input type="text" name="observaciones" placeholder="Observaciones" value={form.observaciones} onChange={handleChange} className="border p-2 rounded col-span-1 md:col-span-2" />
        </div>
        <button onClick={handleSubmit} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          {editId ? 'Actualizar' : 'Agregar'}
        </button>
        {mensaje && <p className="mt-2 text-sm text-red-600">{mensaje}</p>}
      </div>

      <h2 className="text-xl font-semibold mb-2">Lista de Choferes</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-2 py-1 text-left">Nombre</th>
              <th className="border px-2 py-1 text-left">Teléfono</th>
              <th className="border px-2 py-1 text-left">Email</th>
              <th className="border px-2 py-1 text-left">Tipo</th>
              <th className="border px-2 py-1 text-left">Observaciones</th>
              <th className="border px-2 py-1 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {choferes.map((c) => (
              <tr key={c.id}>
                <td className="border px-2 py-1">{c.nombre}</td>
                <td className="border px-2 py-1">{c.telefono}</td>
                <td className="border px-2 py-1">{c.email}</td>
                <td className="border px-2 py-1">{c.tipo}</td>
                <td className="border px-2 py-1">{c.observaciones}</td>
                <td className="border px-2 py-1 text-center">
                  <button onClick={() => handleEditar(c)} className="text-blue-600 mr-2">Editar</button>
                  <button onClick={() => handleEliminar(c.id)} className="text-red-600">Eliminar</button>
                </td>
              </tr>
            ))}
            {choferes.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-4 text-gray-500">No hay choferes registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
