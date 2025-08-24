// app/operaciones/viajes/[id]/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// Helpers
const asId = (v: unknown) => String(v ?? '')
const asStr = (v: unknown) => String(v ?? '')

const getTipoNombre = (vehiculo: VehiculoRow | undefined): string | undefined => {
  if (!vehiculo) return undefined
  const rel = vehiculo.tipos_vehiculo
  return Array.isArray(rel) ? rel[0]?.nombre ?? undefined : rel?.nombre ?? undefined
}

// Estados de negocio
type EstadoViaje =
  | 'programado'
  | 'reservado'
  | 'asignado'
  | 'en_progreso'
  | 'completado'
  | 'cancelado'

// Tipos mínimos
type Asignacion = {
  id: string
  viaje_id: string
  vehiculo_id: string
  chofer_id: string | null
  observaciones: string | null
}

type InsertAsignacion = {
  viaje_id: string
  vehiculo_id: string
  chofer_id: string | null
  observaciones?: string | null
}

type VehiculoRow = {
  id: string
  patente?: string | null
  descripcion?: string | null
  tipos_vehiculo?:
    | { nombre?: string | null }
    | { nombre?: string | null }[]
    | null
}

type ChoferRow = { id: string; nombre?: string | null }

type ViajeRow = {
  id: string
  descripcion?: string | null
  fecha_programada?: string | null
  estado?: EstadoViaje | string | null
  solicitudes?: { clientes?: { nombre?: string | null } | null } | null
}

export default function AsignarViaje() {
  const { id } = useParams<{ id: string }>()
  const viajeId = asId(id)
  const router = useRouter()

  const [viaje, setViaje] = useState<ViajeRow | null>(null)
  const [vehiculos, setVehiculos] = useState<VehiculoRow[]>([])
  const [choferes, setChoferes] = useState<ChoferRow[]>([])
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])

  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState('')
  const [vehiculoRemolque, setVehiculoRemolque] = useState('')
  const [choferSeleccionado, setChoferSeleccionado] = useState('')
  const [archivoDetalle, setArchivoDetalle] = useState<File | null>(null)

  const [mensaje, setMensaje] = useState('')
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)

  const [enviando, setEnviando] = useState(false)
  const [despachoMsg, setDespachoMsg] = useState<string | null>(null)

  const [archivoEntregas, setArchivoEntregas] = useState<File | null>(null)
  const [importando, setImportando] = useState(false)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [tokenChofer, setTokenChofer] = useState<string | null>(null)

  const [entregasTotal, setEntregasTotal] = useState(0)
  const [entregasDone, setEntregasDone] = useState(0)

  // Map auxiliar para mostrar patente/desc desde asignaciones
  const vehById = useMemo(() => {
    const m = new Map<string, VehiculoRow>()
    for (const v of vehiculos) m.set(asId(v.id), v)
    return m
  }, [vehiculos])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Viaje + cliente
        const { data: viajeData } = await supabase
          .from('viajes')
          .select('id, descripcion, fecha_programada, estado, solicitudes (clientes (nombre))')
          .eq('id', viajeId)
          .single()

        // Vehículos activos
        const { data: vehiculosData } = await supabase
          .from('vehiculos')
          .select('id, patente, descripcion, tipos_vehiculo(nombre)')
          .eq('activo', true)

        // Choferes
        const { data: choferesData } = await supabase
          .from('choferes')
          .select('id, nombre')

        // Asignaciones
        type RowVA = {
          id: unknown
          viaje_id: unknown
          vehiculo_id: unknown
          chofer_id: unknown
          observaciones?: unknown
        }
        const { data: asignacionesData } = await supabase
          .from('vehiculos_asignados')
          .select('id, viaje_id, vehiculo_id, chofer_id, observaciones')
          .eq('viaje_id', viajeId)
          .returns<RowVA[]>()

        // Token existente (portal chofer)
        const { data: linkData } = await supabase
          .from('viajes_links')
          .select('token')
          .eq('viaje_id', viajeId)
          .maybeSingle()

        setViaje((viajeData ?? null) as ViajeRow)
        setVehiculos((vehiculosData ?? []) as VehiculoRow[])
        setChoferes((choferesData ?? []) as ChoferRow[])

        const asign: Asignacion[] = (asignacionesData ?? []).map((r) => ({
          id: asId(r.id),
          viaje_id: asId(r.viaje_id),
          vehiculo_id: asId(r.vehiculo_id),
          chofer_id: r.chofer_id == null ? null : asId(r.chofer_id),
          observaciones: r.observaciones == null ? null : asStr(r.observaciones),
        }))
        setAsignaciones(asign)

        const tok =
          linkData && typeof (linkData as any).token === 'string'
            ? String((linkData as any).token)
            : null

        if (tok) {
          setTokenChofer(tok)
          const base = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
          setPortalUrl(`${base}/chofer/${tok}`)
        }

        await refreshProgreso()
      } catch (err) {
        console.error('fetchData error', err)
      }
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viajeId])

  const refreshProgreso = async () => {
    try {
      const { data: todas } = await supabase
        .from('viajes_entregas')
        .select('id, estado')
        .eq('viaje_id', viajeId)
      const total = todas?.length ?? 0
      const done = (todas ?? []).filter(r => r.estado === 'completado').length
      setEntregasTotal(total)
      setEntregasDone(done)
    } catch (e) {
      console.error('refreshProgreso', e)
    }
  }

  const esTractor = () => {
    const v = vehById.get(asId(vehiculoSeleccionado))
    return (getTipoNombre(v) ?? '').toUpperCase() === 'TRACTOR'
  }

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setArchivoDetalle(e.target.files[0])
  }

  const subirArchivoDetalle = async (): Promise<string | null> => {
    if (!archivoDetalle) return null
    try {
      setSubiendoArchivo(true)
      const nombreArchivo = `viaje_${viajeId}_${Date.now()}_${archivoDetalle.name}`
      const { error: uploadError } = await supabase.storage
        .from('adjuntos')
        .upload(nombreArchivo, archivoDetalle, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('adjuntos').getPublicUrl(nombreArchivo)
      return data?.publicUrl || null
    } catch (e) {
      console.error('Error al subir archivo:', e)
      setMensaje('Error al subir el archivo de detalle.')
      return null
    } finally {
      setSubiendoArchivo(false)
    }
  }

  // ====== ASIGNAR o RESERVAR ======
  const asignar = async () => {
    setMensaje('')

    // Se exige al menos vehículo
    if (!vehiculoSeleccionado) {
      setMensaje('Debe seleccionar al menos un vehículo.')
      return
    }
    // Si es tractor, exigir remolque SEMI
    if (esTractor() && !vehiculoRemolque) {
      setMensaje('Debe seleccionar también un vehículo remolcado (SEMI).')
      return
    }

    let archivoUrl: string | null = null
    if (archivoDetalle) archivoUrl = await subirArchivoDetalle()

    // armamos filas a insertar
    const asignacionesInsert: InsertAsignacion[] = [
      {
        viaje_id: viajeId,
        vehiculo_id: asId(vehiculoSeleccionado),
        chofer_id: choferSeleccionado ? asId(choferSeleccionado) : null,
        observaciones: '',
      },
    ]
    if (esTractor()) {
      asignacionesInsert.push({
        viaje_id: viajeId,
        vehiculo_id: asId(vehiculoRemolque),
        chofer_id: choferSeleccionado ? asId(choferSeleccionado) : null,
        observaciones: 'Remolque asignado junto a tractor',
      })
    }

    const { error: insertError } = await supabase
      .from('vehiculos_asignados')
      .insert(asignacionesInsert)

    if (insertError) {
      console.error('Error al asignar:', insertError)
      setMensaje('Error al asignar/reservar vehículo(s).')
      return
    }

    // Determinar próximo estado
    const nextEstado: EstadoViaje = choferSeleccionado ? 'asignado' : 'reservado'

    const { error: updateError } = await supabase
      .from('viajes')
      .update({
        estado: nextEstado,
        ...(archivoUrl ? { archivo_detalle: archivoUrl } : {}),
      })
      .eq('id', viajeId)

    if (updateError) {
      console.error('Error al actualizar estado:', updateError)
      setMensaje('Se guardaron asignaciones, pero no se pudo cambiar el estado.')
    } else {
      // Refetch asignaciones
      type RowVA = {
        id: unknown
        viaje_id: unknown
        vehiculo_id: unknown
        chofer_id: unknown
        observaciones?: unknown
      }
      const { data: asignacionesData } = await supabase
        .from('vehiculos_asignados')
        .select('id, viaje_id, vehiculo_id, chofer_id, observaciones')
        .eq('viaje_id', viajeId)
        .returns<RowVA[]>()

      const asign: Asignacion[] = (asignacionesData ?? []).map((r) => ({
        id: asId(r.id),
        viaje_id: asId(r.viaje_id),
        vehiculo_id: asId(r.vehiculo_id),
        chofer_id: r.chofer_id == null ? null : asId(r.chofer_id),
        observaciones: r.observaciones == null ? null : asStr(r.observaciones),
      }))
      setAsignaciones(asign)

      setMensaje(nextEstado === 'asignado' ? 'Asignación completada.' : 'Reserva registrado.')
    }
  }

  // Listo para despachar: debe existir al menos una asignación con vehículo y chofer
  const listoParaDespachar = useMemo(() => {
    if (!asignaciones?.length) return false
    return asignaciones.some((a) => !!a.chofer_id && !!a.vehiculo_id)
  }, [asignaciones])

  // ====== DESPACHAR (llamada a la API actualizada) ======
  const despachar = async (canal: 'whatsapp' | 'sms' = 'whatsapp') => {
    try {
      if ((viaje?.estado ?? '') !== 'asignado' && !listoParaDespachar) {
        setDespachoMsg('Para despachar, el viaje debe estar ASIGNADO (vehículo y chofer).')
        return
      }

      setEnviando(true)
      setDespachoMsg(null)

      const res = await fetch('/api/operaciones/despachar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viajeId, canal }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }

      // Si la API devolvió portalUrl, la guardamos para abrir rápido
      if (typeof json.portalUrl === 'string') setPortalUrl(json.portalUrl)

      // El route ya pone el viaje en 'en_progreso'; igual actualizamos localmente
      setViaje((v) => (v ? { ...v, estado: 'en_progreso' } : v))
      setDespachoMsg('¡Despachado correctamente!')

    } catch (e: any) {
      setDespachoMsg(`Error al despachar: ${e.message}`)
    } finally {
      setEnviando(false)
    }
  }

  const onImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!archivoEntregas) return
    try {
      setImportando(true)
      const fd = new FormData()
      fd.append('file', archivoEntregas)
      const res = await fetch(`/api/viajes/${viajeId}/import-entregas`, {
        method: 'POST',
        body: fd
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'No se pudo importar el Excel')

      if (typeof json.portalUrl === 'string') setPortalUrl(json.portalUrl)
      if (typeof json.token === 'string') {
        setTokenChofer(json.token)
        if (!json.portalUrl) {
          const base = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
          setPortalUrl(`${base}/chofer/${json.token}`)
        }
      }

      await refreshProgreso()
    } catch (err: any) {
      alert(`Error al importar: ${err.message}`)
    } finally {
      setImportando(false)
    }
  }

  // ====== UI ======
  const botonAsignarLabel =
    !vehiculoSeleccionado
      ? 'Seleccioná un vehículo'
      : choferSeleccionado
        ? 'Asignar (vehículo + chofer)'
        : 'Reservar (solo vehículo)'

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

          {entregasTotal > 0 && (
            <span className="text-sm text-gray-700">
              Progreso: {entregasDone}/{entregasTotal}
            </span>
          )}

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

          <button
            type="button"
            onClick={() => router.push(`/operaciones/viajes/${viajeId}/entregas`)}
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
          <h3 className="font-semibold mb-1">Vehículos ya asignados / reservados:</h3>
          <ul className="list-disc list-inside">
            {asignaciones.map((a) => {
              const vv = vehById.get(asId(a.vehiculo_id))
              return (
                <li key={a.id}>
                  {vv?.patente ?? '—'} - {vv?.descripcion ?? '—'}{' '}
                  {a.observaciones && `(Obs: ${a.observaciones})`}
                  {a.chofer_id ? '' : '  (reservado, sin chofer)'}
                </li>
              )
            })}
          </ul>
        </div>
      )}

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
              <option key={asId(v.id)} value={asId(v.id)}>
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
                .filter((v) => asId(v.id) !== asId(vehiculoSeleccionado) && (getTipoNombre(v) ?? '').toUpperCase() === 'SEMI')
                .map((v) => (
                  <option key={asId(v.id)} value={asId(v.id)}>
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
            <option value="">Seleccione un chofer (opcional para reservar)</option>
            {choferes.map((c) => (
              <option key={asId(c.id)} value={asId(c.id)}>
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
          disabled={subiendoArchivo || !vehiculoSeleccionado}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          title="Reservar (vehículo) o Asignar (vehículo + chofer)"
        >
          {subiendoArchivo ? 'Subiendo archivo...' : botonAsignarLabel}
        </button>

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

      {!!mensaje && <p className="mt-2 text-red-600">{mensaje}</p>}
      {!!despachoMsg && (
        <p className={`mt-2 ${despachoMsg.startsWith('¡') ? 'text-emerald-700' : 'text-red-600'}`}>
          {despachoMsg}
        </p>
      )}
    </div>
  )
}
