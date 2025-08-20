'use client'

import { useEffect, useMemo, useState } from 'react'
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

  // NUEVO: estado para despachar
  const [enviando, setEnviando] = useState(false)
  const [despachoMsg, setDespachoMsg] = useState<string | null>(null)

  // NUEVO: importar Excel de entregas
  const [archivoEntregas, setArchivoEntregas] = useState<File | null>(null)
  const [importando, setImportando] = useState(false)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [tokenChofer, setTokenChofer] = useState<string | null>(null)

  // NUEVO: progreso básico de entregas
  const [entregasTotal, setEntregasTotal] = useState(0)
  const [entregasDone, setEntregasDone] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      const { data: viajeData } = await supabase
        .from('viajes')
        .select('*, solicitudes (cliente_id, clientes(nombre), tipo_viaje)')
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

      // NUEVO: obtener token existente (si ya se generó)
      const { data: linkData } = await supabase
        .from('viajes_links')
        .select('token')
        .eq('viaje_id', id)
        .maybeSingle()

      setViaje(viajeData)
      setVehiculos(vehiculosData || [])
      setChoferes(choferesData || [])
      setAsignaciones(asignacionesData || [])
      if (linkData?.token) {
        setTokenChofer(linkData.token)
        // si ya tenés dominio público, podés construir el link; si no, lo setea el import
        const base = process.env.NEXT_PUBLIC_BASE_URL
        if (base) setPortalUrl(`${base}/chofer/${linkData.token}`)
      }

      // NUEVO: progreso inicial de entregas
      await refreshProgreso()
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const refreshProgreso = async () => {
    const { data: todas } = await supabase
      .from('viajes_entregas')
      .select('id, estado_entrega')
      .eq('viaje_id', id)
    const total = todas?.length ?? 0
    const done = (todas ?? []).filter(r => r.estado_entrega === 'entregado').length
    setEntregasTotal(total)
    setEntregasDone(done)
  }

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

    // 1) Insertar asignaciones
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

    // 2) Actualizar viaje con estado y archivo de detalle
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
      // refrescar asignaciones actuales para habilitar botón Despachar
      const { data: asignacionesData } = await supabase
        .from('vehiculos_asignados')
        .select('*, vehiculos(patente, descripcion)')
        .eq('viaje_id', id)
      setAsignaciones(asignacionesData || [])
      setMensaje('Asignación realizada.')
    }
  }

  // ✅ Condición para mostrar el botón "Despachar viaje"
  const listoParaDespachar = useMemo(() => {
    if (!asignaciones || asignaciones.length === 0) return false
    return asignaciones.some((a) => a.chofer_id && a.vehiculo_id)
  }, [asignaciones])

  // Llama al endpoint /api/operaciones/despachar
  const despachar = async (canal: 'whatsapp' | 'sms' = 'whatsapp') => {
    try {
      setEnviando(true)
      setDespachoMsg(null)
      const res = await fetch('/api/operaciones/despachar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viajeId: id, canal }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'No se pudo despachar el viaje')
      setDespachoMsg('¡Despachado correctamente!')
    } catch (e: any) {
      setDespachoMsg(`Error al despachar: ${e.message}`)
    } finally {
      setEnviando(false)
    }
  }

  // =========================
  // NUEVO: importar entregas
  // =========================
  const onImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!archivoEntregas) return
    try {
      setImportando(true)
      const fd = new FormData()
      fd.append('file', archivoEntregas)
      const res = await fetch(`/api/viajes/${id}/import-entregas`, {
        method: 'POST',
        body: fd
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'No se pudo importar el Excel')
      // guardar link y token
      if (json.portalUrl) setPortalUrl(json.portalUrl)
      if (json.token) setTokenChofer(json.token)
      // refrescar progreso
      await refreshProgreso()
    } catch (err: any) {
      alert(`Error al importar: ${err.message}`)
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Asignar Chofer y Vehículo</h1>

      {viaje && (
        <div className="mb-2">
          <p><strong>Cliente:</strong> {viaje.solicitudes?.clientes?.nombre || 'Sin nombre'}</p>
          <p><strong>Descripción:</strong> {viaje.descripcion}</p>
          <p><strong>Fecha:</strong> {viaje.fecha_programada}</p>
          <p><strong>Estado:</strong> {viaje.estado}</p>
        </div>
      )}

      {/* NUEVO: Importar entregas (Excel) */}
      <div className="rounded border p-4">
        <h2 className="font-semibold mb-2">Importar entregas (Excel)</h2>
        <form onSubmit={onImportSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setArchivoEntregas(e.target.files?.[0] ?? null)}
            className="border p-2 rounded"
          />
          <button
            type="submit"
            disabled={!archivoEntregas || importando}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {importando ? 'Importando…' : 'Importar'}
          </button>

          {/* Progreso simple si hay entregas cargadas */}
          {entregasTotal > 0 && (
            <span className="text-sm text-gray-700">
              Progreso: {entregasDone}/{entregasTotal}
            </span>
          )}

          {/* Link del chofer si está disponible */}
          {portalUrl && (
            <a
              className="text-blue-600 underline"
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              title="Abrir portal del chofer"
            >
              Abrir portal del chofer
            </a>
          )}

          {/* Acceso rápido a vista de operaciones de entregas */}
          <button
            type="button"
            onClick={() => router.push(`/operaciones/viajes/${id}/entregas`)}
            className="px-3 py-2 rounded border hover:bg-gray-50"
            title="Ver entregas en Operaciones"
          >
            Ver entregas (operaciones)
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          *El Excel no necesita traer <code>viaje_id</code>. El sistema lo completa automáticamente.
        </p>
      </div>

      {asignaciones.length > 0 && (
        <div>
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

      {/* Formulario de asignación */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
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
          <div>
            <label className="block mb-1 font-semibold">Vehículo remolcado (solo SEMI):</label>
            <select
              value={vehiculoRemolque}
              onChange={(e) => setVehiculoRemolque(e.target.value)}
              className="border p-2 w-full rounded"
            >
              <option value="">Seleccione un vehículo</option>
              {vehiculos
                .filter(
                  (v) =>
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

        <div>
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

        <div>
          <label className="block mb-1 font-semibold">Archivo de detalle (PDF, Excel, etc.):</label>
          <input
            type="file"
            onChange={handleArchivoChange}
            accept=".pdf,.xls,.xlsx,.csv,image/*"
            className="border p-2 w-full rounded"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={asignar}
          disabled={subiendoArchivo}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {subiendoArchivo ? 'Subiendo archivo...' : 'Asignar'}
        </button>

        {/* ✅ Botones de Despacho: sólo si hay asignaciones válidas */}
        {listoParaDespachar && (
          <>
            <button
              onClick={() => despachar('whatsapp')}
              disabled={enviando}
              className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
            >
              {enviando ? 'Enviando…' : 'Despachar (WhatsApp)'}
            </button>
            <button
              onClick={() => despachar('sms')}
              disabled={enviando}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              {enviando ? 'Enviando…' : 'Despachar (SMS)'}
            </button>
          </>
        )}
      </div>

      {/* Mensajes al usuario */}
      {!!mensaje && <p className="mt-2 text-red-600">{mensaje}</p>}
      {!!despachoMsg && (
        <p className={`mt-2 ${despachoMsg.startsWith('¡') ? 'text-emerald-700' : 'text-red-600'}`}>
          {despachoMsg}
        </p>
      )}
    </div>
  )
}
