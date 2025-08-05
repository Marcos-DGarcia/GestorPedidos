'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function NuevaSolicitudCliente() {
  const [fechaNecesaria, setFechaNecesaria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState<'punto_a_punto' | 'reparto'>('punto_a_punto')
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [mensaje, setMensaje] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje('📤 Enviando solicitud...')

    const { data: userResult, error: userError } = await supabase.auth.getUser()
    const usuarioId = userResult?.user?.id

    if (!usuarioId || userError) {
      setMensaje('❌ No se pudo identificar al usuario')
      return
    }

    const { data: clienteData, error: clienteError } = await supabase
      .from('clientes')
      .select('id')
      .eq('usuario_id', usuarioId)
      .single()

    if (!clienteData || clienteError) {
      setMensaje('❌ No se encontró el cliente asociado')
      return
    }

    // Subir archivo y construir URL pública manualmente
    let archivoUrl: string | null = null
    if (archivo) {
      const nombreArchivo = `${Date.now()}_${archivo.name}`

      const { error: uploadError } = await supabase.storage
        .from('adjuntos')
        .upload(nombreArchivo, archivo, { upsert: true })

      if (uploadError) {
        setMensaje('❌ Error al subir el archivo')
        return
      }

      archivoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/adjuntos/${nombreArchivo}`
    }

    const { error: insertError } = await supabase.from('solicitudes').insert([{
      cliente_id: clienteData.id,
      usuario_id: usuarioId,
      fecha_necesaria: fechaNecesaria,
      descripcion,
      tipo,
      origen: tipo === 'punto_a_punto' ? origen : null,
      destino: tipo === 'punto_a_punto' ? destino : null,
      archivo_adjunto: archivoUrl,
      estado: 'pendiente',
    }])

    if (insertError) {
      setMensaje('❌ Error al guardar la solicitud')
    } else {
      setMensaje('✅ Solicitud cargada correctamente')
      setTimeout(() => router.push('/solicitudes'), 2000)
    }
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Nueva Solicitud</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">Fecha necesaria:
          <input type="date" value={fechaNecesaria} onChange={(e) => setFechaNecesaria(e.target.value)} required className="w-full mt-1 p-2 border rounded" />
        </label>

        <label className="block">Descripción:
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required className="w-full mt-1 p-2 border rounded" />
        </label>

        <label className="block">Tipo de solicitud:
          <select value={tipo} onChange={(e) => setTipo(e.target.value as 'punto_a_punto' | 'reparto')} className="w-full mt-1 p-2 border rounded">
            <option value="punto_a_punto">Punto a Punto</option>
            <option value="reparto">Reparto</option>
          </select>
        </label>

        {tipo === 'punto_a_punto' && (
          <>
            <label className="block">Origen:
              <input type="text" value={origen} onChange={(e) => setOrigen(e.target.value)} className="w-full mt-1 p-2 border rounded" />
            </label>

            <label className="block">Destino:
              <input type="text" value={destino} onChange={(e) => setDestino(e.target.value)} className="w-full mt-1 p-2 border rounded" />
            </label>
          </>
        )}

        <label className="block">Archivo adjunto:
          <input type="file" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="w-full mt-1" />
        </label>

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Enviar Solicitud
        </button>
      </form>

      {mensaje && <p className="mt-4 text-center">{mensaje}</p>}
    </main>
  )
}
