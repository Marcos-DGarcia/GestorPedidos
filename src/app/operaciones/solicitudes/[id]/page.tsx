'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function DetalleSolicitud() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()

  const [solicitud, setSolicitud] = useState<any>(null)

  // División y descripciones
  const [cantidadViajes, setCantidadViajes] = useState(1)
  const [descripcionesViaje, setDescripcionesViaje] = useState<string[]>([''])

  // Reserva: catálogos y selección por viaje
  const [tipos, setTipos] = useState<any[]>([])
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string[]>([''])     // tipo_vehiculo_id por viaje
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<string[]>(['']) // vehiculo_id por viaje (opcional)

  // Archivo de la solicitud (se mantiene como hasta ahora)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    if (!id) return

    const fetchAll = async () => {
      // Solicitud
      const { data: sol, error: solErr } = await supabase
        .from('solicitudes')
        .select('*, clientes(nombre)')
        .eq('id', id)
        .single()
      if (!solErr) setSolicitud(sol)

      // Catálogo de tipos de vehículo
      const { data: tiposData } = await supabase
        .from('tipos_vehiculo')
        .select('id, nombre')
        .order('nombre', { ascending: true })
      setTipos(tiposData || [])

      // Vehículos (para reservas con patente)
      const { data: vehsData } = await supabase
        .from('vehiculos')
        .select('id, patente, descripcion, tipo_id')
        .eq('activo', true)
        .order('patente', { ascending: true })
      setVehiculos(vehsData || [])
    }

    fetchAll()
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

    // Determinar fecha para los viajes y reservas
    const fechaProgramada =
      solicitud.fecha_necesaria
        ? new Date(solicitud.fecha_necesaria).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]

    // 0) Si suben un nuevo archivo para la solicitud, reemplazar
    let archivoUrl = solicitud.archivo_adjunto
    if (archivo) {
      const nuevaUrl = await subirNuevoArchivo()
      if (nuevaUrl) archivoUrl = nuevaUrl
    }

    // 1) Actualizar solicitud -> confirmado
    const { error: updateError } = await supabase
      .from('solicitudes')
      .update({ estado: 'confirmado', archivo_adjunto: archivoUrl })
      .eq('id', id)
    if (updateError) {
      console.error('Error al confirmar solicitud', updateError)
      setConfirmando(false)
      return
    }

    // 2) Crear viajes con descripciones personalizadas
    const viajesPayload = descripcionesViaje.map((descripcion, index) => ({
      solicitud_id: solicitud.id || id,
      fecha_programada: fechaProgramada,
      descripcion: descripcion || `Viaje ${index + 1}`,
      estado: 'programado'
    }))

    // IMPORTANTE: usar .select('id') para recuperar los IDs creados
    const { data: viajesCreados, error: insertError } = await supabase
      .from('viajes')
      .insert(viajesPayload)
      .select('id')

    if (insertError || !viajesCreados) {
      console.error('❌ Error al crear viajes', insertError)
      alert('Ocurrió un error al crear los viajes. Revisá la consola.')
      setConfirmando(false)
      return
    }

    // 3) Crear reservas (si corresponde)
    // Tomamos “tipoSeleccionado[i]” y/o “vehiculoSeleccionado[i]” para cada viaje creado
    const reservasPayload = viajesCreados
      .map((v, i) => {
        const tipoId = tipoSeleccionado[i] || null
        const vehId  = vehiculoSeleccionado[i] || null

        // Si no se seleccionó ni tipo ni vehículo → no se crea reserva para ese viaje
        if (!tipoId && !vehId) return null

        return {
          viaje_id: v.id,
          fecha: fechaProgramada,
          tipo_vehiculo_id: tipoId,
          vehiculo_id: vehId,
          estado: 'reservado',
          observaciones: descripcionesViaje[i] || null
        }
      })
      .filter(Boolean) as any[]

    if (reservasPayload.length > 0) {
      const { error: resErr } = await supabase
        .from('reservas_vehiculo')
        .insert(reservasPayload)

      if (resErr) {
        // No frenamos el flujo si fallan reservas, pero avisamos
        console.error('⚠️ Error al crear reservas', resErr)
      }
    }

    // Listo
    router.push('/operaciones/solicitudes')
    setConfirmando(false)
  }

  if (!solicitud) return <div className="p-6">Cargando...</div>

  // Helper: vehículos filtrados por tipo para un índice i
  const vehiculosPorTipo = (tipoId: string) =>
    vehiculos.filter(v => v.tipo_id === tipoId)

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
        <div className="space-y-6">
          {/* Cantidad de viajes */}
          <div>
            <label className="block text-sm mb-1">¿Cuántos viajes se necesitan?</label>
            <input
              type="number"
              min={1}
              value={cantidadViajes}
              onChange={(e) => {
                const cant = Math.max(1, parseInt(e.target.value || '1'))
                setCantidadViajes(cant)
                setDescripcionesViaje(Array(cant).fill(''))
                setTipoSeleccionado(Array(cant).fill(''))
                setVehiculoSeleccionado(Array(cant).fill(''))
              }}
              className="border rounded p-2 w-24"
            />
          </div>

          {/* Sección por viaje: descripción + reserva */}
          {Array.from({ length: cantidadViajes }).map((_, i) => (
            <div key={i} className="border rounded p-3 bg-gray-50">
              <h3 className="font-semibold mb-2">Viaje {i + 1}</h3>

              {/* Descripción */}
              <label className="block text-sm mb-1">Descripción</label>
              <input
                type="text"
                value={descripcionesViaje[i] || ''}
                onChange={(e) => {
                  const nuevas = [...descripcionesViaje]
                  nuevas[i] = e.target.value
                  setDescripcionesViaje(nuevas)
                }}
                className="border p-2 rounded w-full mb-3"
                placeholder="Ej: RUTEO DE PETRONAS CHASIS"
              />

              {/* Reserva: Tipo de vehículo */}
              <label className="block text-sm mb-1">
                Reservar tipo de unidad (opcional, para capacidad)
              </label>
              <select
                value={tipoSeleccionado[i] || ''}
                onChange={(e) => {
                  const val = e.target.value
                  const nuevosTipos = [...tipoSeleccionado]
                  nuevosTipos[i] = val
                  setTipoSeleccionado(nuevosTipos)

                  // Si cambia el tipo, reinicio la patente elegida
                  const nuevosVeh = [...vehiculoSeleccionado]
                  nuevosVeh[i] = ''
                  setVehiculoSeleccionado(nuevosVeh)
                }}
                className="border p-2 rounded w-full mb-3"
              >
                <option value="">– Sin reserva de tipo –</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>

              {/* Reserva: Vehículo específico (opcional) */}
              <label className="block text-sm mb-1">
                Reservar vehículo específico (opcional)
              </label>
              <select
                value={vehiculoSeleccionado[i] || ''}
                onChange={(e) => {
                  const nuevos = [...vehiculoSeleccionado]
                  nuevos[i] = e.target.value
                  setVehiculoSeleccionado(nuevos)
                }}
                className="border p-2 rounded w-full"
              >
                <option value="">– Sin patente específica –</option>
                {(tipoSeleccionado[i]
                  ? vehiculosPorTipo(tipoSeleccionado[i])
                  : vehiculos
                ).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.patente} – {v.descripcion}
                  </option>
                ))}
              </select>

              <p className="text-xs text-gray-500 mt-2">
                Si elegís patente, se pintará en <b>amarillo</b> en Planificación para este día.
                Si solo elegís tipo, se sumará al conteo de capacidad sin fijar vehículo.
              </p>
            </div>
          ))}

          {/* Reemplazo de archivo de la solicitud (igual que antes) */}
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
