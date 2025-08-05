'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function DetalleSolicitud() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()

  const [solicitud, setSolicitud] = useState<any>(null)
  const [cantidadViajes, setCantidadViajes] = useState(1)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    if (!id) return

    const fetchSolicitud = async () => {
      const { data, error } = await supabase
        .from('solicitudes')
        .select('*, clientes(nombre)')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error al traer solicitud', error)
      } else {
        setSolicitud(data)
      }
    }

    fetchSolicitud()
  }, [id])

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setArchivo(e.target.files[0])
    }
  }

  const subirNuevoArchivo = async () => {
    if (!archivo) return null

    setSubiendoArchivo(true)

    const nombreArchivo = `${id}_${Date.now()}_${archivo.name}`
    const { error: uploadError } = await supabase.storage
      .from('adjuntos')
      .upload(nombreArchivo, archivo, { upsert: true })

    if (uploadError) {
      alert('Error al subir archivo')
      console.error(uploadError)
      setSubiendoArchivo(false)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('adjuntos')
      .getPublicUrl(nombreArchivo)

    setSubiendoArchivo(false)
    return urlData?.publicUrl || null
  }

  const confirmarSolicitud = async () => {
    if (!solicitud) return
    setConfirmando(true)

    let archivoUrl = solicitud.archivo_adjunto

    if (archivo) {
      const nuevaUrl = await subirNuevoArchivo()
      if (nuevaUrl) archivoUrl = nuevaUrl
    }

    // 1. Actualizar solicitud
    const { error: updateError } = await supabase
      .from('solicitudes')
      .update({ estado: 'confirmado', archivo_adjunto: archivoUrl })
      .eq('id', id)

    if (updateError) {
      console.error('Error al confirmar solicitud', updateError)
      setConfirmando(false)
      return
    }

    // 2. Crear viajes
    const viajes = Array.from({ length: cantidadViajes }, () => ({
      solicitud_id: id,
      fecha_programar: solicitud.fecha_necesaria,
      descripcion: solicitud.descripcion,
      estado: 'programado',
    }))

    const { error: insertError } = await supabase
      .from('viajes')
      .insert(viajes)

    if (insertError) {
      console.error('Error al crear viajes', insertError)
    } else {
      router.push('/operaciones/solicitudes')
    }

    setConfirmando(false)
  }

  if (!solicitud) return <div className="p-6">Cargando...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Detalle de Solicitud</h1>

      <div className="space-y-2">
        <p><strong>Fecha:</strong> {solicitud.fecha_necesaria}</p>
        <p><strong>Cliente:</strong> {solicitud.clientes?.nombre || solicitud.cliente_id}</p>
        <p><strong>Tipo:</strong> {solicitud.tipo}</p>
        <p><strong>Descripción:</strong> {solicitud.descripcion}</p>
        <p><strong>Estado:</strong> {solicitud.estado}</p>

        {solicitud.archivo_adjunto ? (
          <p>
            <strong>Archivo adjunto:</strong>{' '}
            <a
              href={solicitud.archivo_adjunto}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Ver archivo
            </a>
          </p>
        ) : (
          <p className="italic text-gray-500">No hay archivo adjunto.</p>
        )}
      </div>

      {solicitud.estado === 'pendiente' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">¿Cuántos viajes se necesitan?</label>
            <input
              type="number"
              min={1}
              value={cantidadViajes}
              onChange={(e) => setCantidadViajes(parseInt(e.target.value))}
              className="border rounded p-2 w-24"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Reemplazar archivo actual</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={handleArchivoChange}
              className="border p-2"
            />
          </div>

          <button
            onClick={confirmarSolicitud}
            disabled={confirmando || subiendoArchivo}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            {confirmando || subiendoArchivo ? 'Procesando...' : 'Confirmar solicitud'}
          </button>
        </div>
      )}
    </div>
  )
}
