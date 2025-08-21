'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// Tipos y helpers
type ClienteRow = { id: string; nombre: string }
const asId = (v: unknown) => String(v ?? '')

export default function NuevaSolicitudOperaciones() {
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [clienteId, setClienteId] = useState('')
  const [fechaNecesaria, setFechaNecesaria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState<'punto_a_punto' | 'reparto'>('punto_a_punto')
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [mensaje, setMensaje] = useState('')
  const router = useRouter()

  useEffect(() => {
    const fetchClientes = async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre')
        .order('nombre', { ascending: true })

      if (error) {
        console.error('Error al cargar clientes', error)
        setClientes([])
        return
      }

      // Normalizar a ClienteRow[]
      const rows = (data ?? []) as Array<{ id: unknown; nombre: unknown }>
      const safe: ClienteRow[] = rows
        .map(r => ({ id: asId(r.id), nombre: String(r.nombre ?? '') }))
        .filter(r => r.id && r.nombre)

      setClientes(safe)
    }

    fetchClientes()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje('📤 Enviando solicitud...')

    // Usuario actual (operaciones)
    const { data: userResult, error: userError } = await supabase.auth.getUser()
    const usuarioId = userResult?.user?.id
    if (userError || !usuarioId) {
      setMensaje('❌ Error: no se pudo identificar al usuario')
      return
    }

    // Validaciones básicas
    if (!clienteId) {
      setMensaje('❌ Seleccioná un cliente')
      return
    }
    if (!fechaNecesaria) {
      setMensaje('❌ Seleccioná la fecha necesaria')
      return
    }

    // Subir archivo (opcional) y obtener URL pública
    let archivoUrl: string | null = null
    if (archivo) {
      const path = `adjuntos/${usuarioId}/${Date.now()}_${archivo.name}`

      const { error: uploadError } = await supabase.storage
        .from('adjuntos')
        .upload(path, archivo, { upsert: true })

      if (uploadError) {
        console.error(uploadError)
        setMensaje('❌ Error al subir el archivo')
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('adjuntos')
        .getPublicUrl(path)

      archivoUrl = publicUrlData?.publicUrl ?? null
    }

    // Insertar solicitud normalizando campos
    const { error: insertError } = await supabase.from('solicitudes').insert([{
      cliente_id: asId(clienteId),
      usuario_id: asId(usuarioId),
      fecha_necesaria: fechaNecesaria,
      descripcion: descripcion ?? '',
      tipo, // 'punto_a_punto' | 'reparto'
      origen: tipo === 'punto_a_punto' ? (origen || null) : null,
      destino: tipo === 'punto_a_punto' ? (destino || null) : null,
      archivo_adjunto: archivoUrl,
      estado: 'pendiente',
    }])

    if (insertError) {
      console.error(insertError)
      setMensaje('❌ Error al guardar la solicitud')
    } else {
      setMensaje('✅ Solicitud cargada correctamente')
      setTimeout(() => router.push('/operaciones/solicitudes'), 1200)
    }
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Nueva Solicitud (Operaciones)</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          Cliente:
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            required
            className="w-full mt-1 p-2 border rounded"
          >
            <option value="">Seleccionar cliente</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>

        <label className="block">
          Fecha necesaria:
          <input
            type="date"
            value={fechaNecesaria}
            onChange={(e) => setFechaNecesaria(e.target.value)}
            required
            className="w-full mt-1 p-2 border rounded"
          />
        </label>

        <label className="block">
          Descripción:
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
            className="w-full mt-1 p-2 border rounded"
          />
        </label>

        <label className="block">
          Tipo de solicitud:
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as 'punto_a_punto' | 'reparto')}
            className="w-full mt-1 p-2 border rounded"
          >
            <option value="punto_a_punto">Punto a Punto</option>
            <option value="reparto">Reparto</option>
          </select>
        </label>

        {tipo === 'punto_a_punto' && (
          <>
            <label className="block">
              Origen:
              <input
                type="text"
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                className="w-full mt-1 p-2 border rounded"
              />
            </label>

            <label className="block">
              Destino:
              <input
                type="text"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                className="w-full mt-1 p-2 border rounded"
              />
            </label>
          </>
        )}

        <label className="block">
          Archivo adjunto:
          <input
            type="file"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="w-full mt-1"
          />
        </label>

        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Guardar Solicitud
        </button>
      </form>

      {mensaje && <p className="mt-4 text-center">{mensaje}</p>}
    </main>
  )
}
