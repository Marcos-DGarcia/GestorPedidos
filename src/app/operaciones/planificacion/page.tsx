'use client'

// PLANIFICACION
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import dayjs from 'dayjs'
import clsx from 'clsx'

type VasRow = { viaje_id: string; vehiculo_id: string; chofer_id: string | null }

// Helpers de IDs y colecciones
const asId = (v: unknown) => String(v ?? '')
const toIdSet = <T,>(rows: T[] | null | undefined, pick: (r: T) => unknown) =>
  new Set<string>((rows ?? []).map(pick).map(asId).filter(Boolean))

// ✅ mapById sin tuplas inferidas (evita Map<string, unknown>)
const mapById = <T,>(
  rows: T[] | null | undefined,
  pickId: (r: T) => unknown
): Map<string, T> => {
  const m = new Map<string, T>()
  for (const r of rows ?? []) {
    m.set(asId(pickId(r)), r)
  }
  return m
}

const ORDER = ['CHASIS','BALANCIN','TRACTOR','SEMI','CAMIONETA'] as const
type TipoVeh = typeof ORDER[number]
const LABEL: Record<TipoVeh, string> = {
  CHASIS:'Chasis', BALANCIN:'Balancines', TRACTOR:'Tractores', SEMI:'Semis', CAMIONETA:'Camionetas'
}

// Tipos mínimos para lecturas
type VehiculoRow = {
  id: string
  patente?: string | null
  descripcion?: string | null
  tipos_vehiculo?: { nombre?: string | null } | { nombre?: string | null }[] | null
}
type ViajeRow = {
  id: string
  descripcion?: string | null
  fecha_programada?: string | null
  solicitudes?: { clientes?: { nombre?: string | null } | null } | null
}
type MantenimientoRow = { vehiculo_id: string | null }

// NOTA: Evitamos relaciones directas en la query de reservas para no chocar con typegen
type ReservaMin = {
  id: string
  fecha: string
  estado: string
  observaciones?: string | null
  vehiculo_id?: string | null
  tipo_vehiculo_id?: string | null
  viaje_id?: string | null
}
type TipoVehiculoRow = { id: string; nombre?: string | null }

// Lee el nombre de tipo sin importar si la relación viene como objeto o array
const getTipoNombre = (vehiculo: any): string | undefined => {
  const rel = vehiculo?.tipos_vehiculo
  if (Array.isArray(rel)) return rel[0]?.nombre
  return rel?.nombre
}
// Normaliza contra los 5 tipos
const normTipo = (nombre?: string): TipoVeh | undefined => {
  if (!nombre) return undefined
  const up = String(nombre).toUpperCase()
  return (ORDER as readonly string[]).includes(up) ? (up as TipoVeh) : undefined
}

export default function PlanificacionFlota() {
  const [fecha, setFecha] = useState(dayjs().format('YYYY-MM-DD'))
  const [vehiculos, setVehiculos] = useState<VehiculoRow[]>([])
  const [viajesPorVehiculo, setViajesPorVehiculo] = useState<Map<string, ViajeRow>>(new Map())
  const [enMantenimiento, setEnMantenimiento] = useState<Set<string>>(new Set())
  const [reservasPorVehiculo, setReservasPorVehiculo] = useState<Map<string, { reserva: ReservaMin; viaje?: ViajeRow }>>(new Map())
  const [reservasPorTipo, setReservasPorTipo] = useState<Record<string, number>>({})
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<ViajeRow | null>(null)

  // FILTRO: 'TODOS' o un tipo
  type Filtro = 'TODOS' | TipoVeh
  const [filtroTipo, setFiltroTipo] = useState<Filtro>('TODOS')

  useEffect(() => {
    const fetchData = async () => {
      // Vehículos activos
      const { data: vehiculosData } = await supabase
        .from('vehiculos')
        .select('id, patente, descripcion, tipos_vehiculo(nombre)')
        .eq('activo', true)

      setVehiculos((vehiculosData ?? []) as VehiculoRow[])

      // VIAJES DEL DÍA
      const { data: viajesData, error: viajesErr } = await supabase
        .from('viajes')
        .select('id, descripcion, fecha_programada, solicitudes (clientes (nombre))')
        .eq('fecha_programada', fecha)

      if (viajesErr) console.error('viajes error', viajesErr)

      const viajes = (viajesData ?? []) as ViajeRow[]
      const byViajeId = mapById<ViajeRow>(viajes, (v) => v.id)

      // ASIGNACIONES de esos viajes
      const viajeIds: string[] = viajes.map((v) => asId(v.id))

      let asignacionesData: Array<{ viaje_id: string; vehiculo_id: string }> = []
      if (viajeIds.length) {
        const { data: vasData, error: vasErr } = await supabase
          .from('vehiculos_asignados')
          .select('viaje_id, vehiculo_id')
          .in('viaje_id', viajeIds)

        if (vasErr) console.error('vehiculos_asignados error', vasErr)

        asignacionesData = (vasData ?? []).map((r: any) => ({
          viaje_id: asId(r?.viaje_id),
          vehiculo_id: asId(r?.vehiculo_id),
        }))
      }

      // vehiculo_id -> viaje
      const mapAsignados = new Map<string, ViajeRow>()
      asignacionesData.forEach((va) => {
        const v = byViajeId.get(va.viaje_id)
        if (v) mapAsignados.set(va.vehiculo_id, v)
      })
      setViajesPorVehiculo(mapAsignados)

      // MANTENIMIENTOS
      const { data: mantenimientoData } = await supabase
        .from('vehiculos_mantenimiento')
        .select('vehiculo_id')
        .lte('fecha_inicio', fecha)
        .gte('fecha_fin', fecha)

      setEnMantenimiento(toIdSet<MantenimientoRow>(mantenimientoData as MantenimientoRow[] | null, (m) => m.vehiculo_id))

          // =========================
    // RESERVAS (sin relaciones)
    // =========================
    const { data: reservasRaw } = await supabase
      .from('reservas_vehiculo')
      .select('id, fecha, estado, observaciones, vehiculo_id, tipo_vehiculo_id, viaje_id')
      .eq('fecha', fecha)
      .eq('estado', 'reservado')

    const reservas = (reservasRaw ?? []) as ReservaMin[]

    // Cargar viajes referenciados por reservas (para mostrar cliente)
    const viajeIdsFromReservas = Array.from(
      new Set(reservas.map((r) => asId(r.viaje_id)).filter(Boolean))
    )

    let reservasViajesById = new Map<string, ViajeRow>()
    if (viajeIdsFromReservas.length) {
      const { data: viajesFromReservas } = await supabase
        .from('viajes')
        .select('id, descripcion, fecha_programada, solicitudes (clientes (nombre))')
        .in('id', viajeIdsFromReservas)

      reservasViajesById = mapById<ViajeRow>(
        (viajesFromReservas ?? []) as ViajeRow[],
        (v) => v.id
      )
    }

    // Cargar nombres de tipos para reservas sin vehículo asignado
    const tipoIds = Array.from(
      new Set(
        reservas
          .filter((r) => !asId(r.vehiculo_id))
          .map((r) => asId(r.tipo_vehiculo_id))
          .filter(Boolean)
      )
    )

    let tiposById = new Map<string, TipoVehiculoRow>()
    if (tipoIds.length) {
      const { data: tiposRows } = await supabase
        .from('tipos_vehiculo')
        .select('id, nombre')
        .in('id', tipoIds)

      tiposById = mapById<TipoVehiculoRow>(
        (tiposRows ?? []) as TipoVehiculoRow[],
        (t) => t.id
      )
    }

    // Construir mapa de reservas por vehiculo_id y acumulado por tipo
    const mapReservas = new Map<string, { reserva: ReservaMin; viaje?: ViajeRow }>()
    const acumPorTipo: Record<string, number> = {}

    for (const r of reservas) {
      const vehId = asId(r.vehiculo_id)
      if (vehId) {
        const v = r.viaje_id ? reservasViajesById.get(asId(r.viaje_id)) : undefined
        mapReservas.set(vehId, { reserva: r, viaje: v })
      } else {
        const nombreTipo = tiposById.get(asId(r.tipo_vehiculo_id))?.nombre
        if (nombreTipo) {
          const key = String(nombreTipo)
          acumPorTipo[key] = (acumPorTipo[key] || 0) + 1
        }
      }
    }

    setReservasPorVehiculo(mapReservas)
setReservasPorTipo(acumPorTipo)


      for (const r of reservas) {
        const vehId = asId(r.vehiculo_id)
        if (vehId) {
          // Reserva asignada a vehículo
          const v = r.viaje_id ? reservasViajesById.get(asId(r.viaje_id)) : undefined
          mapReservas.set(vehId, { reserva: r, viaje: v })
        } else {
          // Reserva por tipo (sin vehículo)
          const nombreTipo = tiposById.get(asId(r.tipo_vehiculo_id))?.nombre
          if (nombreTipo) {
            const key = String(nombreTipo)
            acumPorTipo[key] = (acumPorTipo[key] || 0) + 1
          }
        }
      }

      setReservasPorVehiculo(mapReservas)
      setReservasPorTipo(acumPorTipo)
    }

    fetchData()
  }, [fecha])

  const estadoVehiculo = (vehiculo: VehiculoRow) => {
    const id = asId(vehiculo.id)
    if (enMantenimiento.has(id)) return 'mantenimiento'
    if (viajesPorVehiculo.has(id)) return 'ocupado'
    if (reservasPorVehiculo.has(id)) return 'reservado'
    return 'libre'
  }

  // Agrupado por tipo -> { CHASIS: [...], BALANCIN: [...], ... }
  const agrupado = useMemo(() => {
    const base: Record<TipoVeh, VehiculoRow[]> = {
      CHASIS: [], BALANCIN: [], TRACTOR: [], SEMI: [], CAMIONETA: []
    }
    for (const v of vehiculos) {
      const t = normTipo(getTipoNombre(v))
      if (!t) continue
      base[t].push(v)
    }
    // orden interno
    ORDER.forEach(t => {
      base[t] = base[t].sort((a, b) =>
        (a.patente || a.descripcion || '').localeCompare(b.patente || b.descripcion || '')
      )
    })
    return base
  }, [vehiculos])

  // Qué tipos mostrar según el filtro
  const tiposParaMostrar: TipoVeh[] =
    filtroTipo === 'TODOS' ? [...ORDER] : [filtroTipo as TipoVeh]

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">Hoja de Guía / Planificación de Flota</h1>

      {/* Controles: fecha + filtro tipo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border p-2 rounded"
          />
          {/* Resumen reservas por tipo (sin vehículo asignado) */}
          {Object.keys(reservasPorTipo).length > 0 && (
            <div className="text-sm bg-yellow-100 border border-yellow-300 px-3 py-1 rounded">
              {Object.entries(reservasPorTipo).map(([tipo, cant]) => (
                <span key={tipo} className="mr-3">
                  <strong>{tipo}:</strong> {cant} reservado(s)
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFiltroTipo('TODOS')}
            className={clsx(
              'px-3 py-1 rounded-full text-sm border',
              filtroTipo === 'TODOS' ? 'bg-black text-white border-black' : 'bg-white'
            )}
          >
            Todos
          </button>
          {ORDER.map(t => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={clsx(
                'px-3 py-1 rounded-full text-sm border',
                filtroTipo === t ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white'
              )}
            >
              {LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Leyenda de estados */}
      <div className="text-sm mb-4 flex gap-3">
        <span className="px-2 py-1 rounded bg-green-600 text-white">Ocupado</span>
        <span className="px-2 py-1 rounded bg-yellow-400 text-black">Reservado</span>
        <span className="px-2 py-1 rounded bg-red-600 text-white">Mantenimiento</span>
        <span className="px-2 py-1 rounded bg-gray-200 text-black">Libre</span>
      </div>

      {/* UNA TARJETA POR TIPO (fila). Dentro: cuadrados por vehículo */}
      <div className="space-y-4">
        {tiposParaMostrar.map((tipo) => (
          <div key={tipo} className="rounded-2xl border p-4">
            {/* Header de la tarjeta del tipo */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">{LABEL[tipo]}</h2>
              <span className="text-xs text-neutral-500">
                {agrupado[tipo].length} unidades
              </span>
            </div>

            {/* Grid de “cuadrados” (las patentes) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {agrupado[tipo].map((vehiculo: VehiculoRow) => {
                const id = asId(vehiculo.id)
                const estado = estadoVehiculo(vehiculo)
                const viaje = viajesPorVehiculo.get(id)
                const reservaEntry = reservasPorVehiculo.get(id)

                return (
                  <div
                    key={id}
                    className={clsx(
                      'p-3 rounded-xl border text-sm',
                      estado === 'ocupado' && 'bg-green-600 text-white border-green-700',
                      estado === 'mantenimiento' && 'bg-red-600 text-white border-red-700',
                      estado === 'reservado' && 'bg-yellow-400 text-black border-yellow-500',
                      estado === 'libre' && 'bg-gray-100 text-black border-gray-200'
                    )}
                    title={
                      estado === 'ocupado' ? 'Con viaje asignado'
                      : estado === 'reservado' ? 'Reservado'
                      : estado === 'mantenimiento' ? 'En mantenimiento'
                      : 'Libre'
                    }
                  >
                    <div className="font-semibold truncate">{vehiculo.patente}</div>
                    <div className="text-xs opacity-90 truncate">
                      {vehiculo.descripcion || '—'}
                    </div>

                    {/* Info contextual */}
                    {estado === 'ocupado' && (
                      <button
                        onClick={() => setDetalleSeleccionado(viaje ?? null)}
                        className="mt-2 underline"
                      >
                        Ver detalle
                      </button>
                    )}
                    {estado === 'reservado' && (
                      <div className="mt-2 text-xs">
                        {reservaEntry?.viaje?.solicitudes?.clientes?.nombre || '—'}
                      </div>
                    )}
                  </div>
                )
              })}

              {agrupado[tipo].length === 0 && (
                <div className="col-span-full text-xs text-neutral-400 italic">
                  Sin vehículos
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Panel lateral de detalle */}
      {detalleSeleccionado && (
        <div className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-lg border-l z-50 p-6 overflow-y-auto">
          <button
            onClick={() => setDetalleSeleccionado(null)}
            className="mb-4 text-sm text-red-600 underline"
          >
            Cerrar
          </button>
          <h2 className="text-xl font-bold mb-2">Detalle del viaje</h2>
          <p><strong>Cliente:</strong> {detalleSeleccionado.solicitudes?.clientes?.nombre ?? '—'}</p>
          <p><strong>Descripción:</strong> {detalleSeleccionado.descripcion ?? '—'}</p>
          <p>
            <strong>Fecha:</strong>{' '}
            {detalleSeleccionado.fecha_programada
              ? dayjs(detalleSeleccionado.fecha_programada).format('DD/MM/YYYY')
              : '—'}
          </p>
          <a
            href={`/operaciones/viajes/${asId(detalleSeleccionado.id)}`}
            target="_blank"
            className="block mt-4 text-blue-600 underline text-sm"
          >
            Abrir viaje completo ↗
          </a>
        </div>
      )}
    </div>
  )
}
