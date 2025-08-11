'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AsignarViaje() {
  const { id } = useParams()
  const router = useRouter()

  const [viaje, setViaje] = useState<any>(null)
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [choferes, setChoferes] = useState<any[]>([])
  const [asignaciones, setAsignaciones] = useState<any[]>([])

  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState('')
  const [vehiculoRemolque, setVehiculoRemolque] = useState('')
  const [choferSeleccionado, setChoferSeleccionado] = useState('')
  const [archivoDetalle, setArchivoDetalle] = useState<File | null>(null)

  const [mensaje, setMensaje] = useState('')
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: viajeData } = await supabase
        .from('viajes')
        .select('*, solicitudes (cliente_id, clientes(nombre))')
        .eq('id', id)
        .single()

      const { data: vehiculosData } = await supabase
        .from('vehiculos')
        .select('*, tipos_vehiculo(nombre)')

      const { data: choferesData } = await supabase
        .from('choferes')
        .select('*')

      const { data: asignacionesData } = await supabase
        .from('vehiculos_asignados')
        .select('*, vehiculos(patente, descripcion)')
        .eq('viaje_id', id)

      setViaje(viajeData)
      setVehiculos(vehiculosData || [])
      setChoferes(choferesData || [])
      setAsignaciones(asignacionesData || [])
    }

    fetchData()
  }, [id])

  const esTractor = () => {
    const vehiculo = vehiculos.find((v) => v.id === vehiculoSeleccionado)
    return vehiculo?.tipos_vehiculo?.nombre === 'TRACTOR'
  }

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setArchivoDetalle(e.target.files[0])
    }
  }

  const subirArchivoDetalle = async (): Promise<string | null> => {
    if (!archivoDetalle) return null

    setSubiendoArchivo(true)

    const nombreArchivo = `viaje_${id}_${Date.now()}_${archivoDetalle.name}`
    const { error: uploadError } = await supabase.storage
      .from('adjuntos')
      .upload(nombreArchivo, archivoDetalle, { upsert: true })

    if (uploadError) {
      console.error('Error al subir archivo:', uploadError)
      setMensaje('Error al subir el archivo de detalle.')
      setSubiendoArchivo(false)
      return null
    }

    const { data } = supabase.storage.from('adjuntos').getPublicUrl(nombreArchivo)
    setSubiendoArchivo(false)
    return data?.publicUrl || null
  }

  const asignar = async () => {
    setMensaje('')

    if (!vehiculoSeleccionado || !choferSeleccionado) {
      setMensaje('Debe seleccionar un vehículo y un chofer.')
      return
    }

    if (esTractor() && !vehiculoRemolque) {
      setMensaje('Debe seleccionar también un vehículo remolcado.')
      return
    }

    let archivoUrl: string | null = null
    if (archivoDetalle) {
      archivoUrl = await subirArchivoDetalle()
    }

    // 1. Insertar asignaciones
    const asignacionesInsert = [
      {
        viaje_id: id,
        vehiculo_id: vehiculoSeleccionado,
        chofer_id: choferSeleccionado,
        observaciones: '',
      },
    ]

    if (esTractor()) {
      asignacionesInsert.push({
        viaje_id: id,
        vehiculo_id: vehiculoRemolque,
        chofer_id: choferSeleccionado,
        observaciones: 'Remolque asignado junto a tractor',
      })
    }

    const { error: insertError } = await supabase
      .from('vehiculos_asignados')
      .insert(asignacionesInsert)

    if (insertError) {
      console.error('Error al asignar:', insertError)
      setMensaje('Error al asignar vehículo(s) y chofer.')
      return
    }

    // 2. Actualizar viaje con estado y archivo de detalle
    const { error: updateError } = await supabase
      .from('viajes')
      .update({
        estado: 'asignado',
        ...(archivoUrl ? { archivo_detalle: archivoUrl } : {}),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error al actualizar estado:', updateError)
      setMensaje('Asignado, pero no se pudo cambiar el estado.')
    } else {
      router.push('/operaciones/viajes')
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Asignar Chofer y Vehículo</h1>

      {viaje && (
        <div className="mb-6">
          <p><strong>Cliente:</strong> {viaje.solicitudes?.clientes?.nombre || 'Sin nombre'}</p>
          <p><strong>Descripción:</strong> {viaje.descripcion}</p>
          <p><strong>Fecha:</strong> {viaje.fecha_programada}</p>
          <p><strong>Estado:</strong> {viaje.estado}</p>
        </div>
      )}

      {asignaciones.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold mb-1">Vehículos ya asignados:</h3>
          <ul className="list-disc list-inside">
            {asignaciones.map((a) => (
              <li key={a.id}>
                {a.vehiculos?.patente} - {a.vehiculos?.descripcion} {a.observaciones && `(Obs: ${a.observaciones})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4">
        <label className="block mb-1 font-semibold">Vehículo:</label>
        <select
          value={vehiculoSeleccionado}
          onChange={(e) => {
            setVehiculoSeleccionado(e.target.value)
            setVehiculoRemolque('')
          }}
          className="border p-2 w-full rounded"
        >
          <option value="">Seleccione un vehículo</option>
          {vehiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.patente} - {v.descripcion}
            </option>
          ))}
        </select>
      </div>

      {esTractor() && (
        <div className="mb-4">
          <label className="block mb-1 font-semibold">Vehículo remolcado (solo SEMI):</label>
          <select
            value={vehiculoRemolque}
            onChange={(e) => setVehiculoRemolque(e.target.value)}
            className="border p-2 w-full rounded"
          >
            <option value="">Seleccione un vehículo</option>
            {vehiculos
              .filter((v) =>
                v.id !== vehiculoSeleccionado &&
                v.tipos_vehiculo?.nombre === 'SEMI'
              )
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.patente} - {v.descripcion}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="mb-4">
        <label className="block mb-1 font-semibold">Chofer:</label>
        <select
          value={choferSeleccionado}
          onChange={(e) => setChoferSeleccionado(e.target.value)}
          className="border p-2 w-full rounded"
        >
          <option value="">Seleccione un chofer</option>
          {choferes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block mb-1 font-semibold">Archivo de detalle (PDF, Excel, etc.):</label>
        <input
          type="file"
          onChange={handleArchivoChange}
          accept=".pdf,.xls,.xlsx,.csv,image/*"
          className="border p-2 w-full rounded"
        />
      </div>

      <button
        onClick={asignar}
        disabled={subiendoArchivo}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {subiendoArchivo ? 'Subiendo archivo...' : 'Asignar'}
      </button>

      {mensaje && <p className="mt-4 text-red-600">{mensaje}</p>}
    </div>
  )
}
