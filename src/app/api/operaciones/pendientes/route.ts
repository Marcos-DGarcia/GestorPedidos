import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EstadoEntrega = 'pendiente' | 'entregado' | 'completado' | 'fallido'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const from = url.searchParams.get('from') ?? undefined
    const to = url.searchParams.get('to') ?? undefined

    const estadoParam = url.searchParams.get('estado') ?? 'en_progreso'
    const estados = estadoParam.split(',').map(s => s.trim()).filter(Boolean)

    const includeCompleted = url.searchParams.get('includeCompleted') === '1'
    const patente = url.searchParams.get('patente')?.trim() || '' // NUEVO

    // --- (A) Si hay filtro por patente, resolvemos los viaje_ids de esos vehículos
    let viajeIdsPatente: string[] | null = null
    if (patente) {
      // 1) Vehículos que matcheen la patente
      const { data: vehs, error: vehErr } = await supabaseAdmin
        .from('vehiculos')
        .select('id, patente')
        .ilike('patente', `%${patente}%`)
      if (vehErr) return NextResponse.json({ ok: false, error: vehErr.message }, { status: 400 })

      const vehIds = (vehs ?? []).map(v => v.id)
      if (vehIds.length === 0) {
        // No hay vehículos que matcheen -> no habrá viajes
        return NextResponse.json({ ok: true, items: [] })
      }

      // 2) Asignaciones con esos vehículos -> viaje_ids
      const { data: asigsPat, error: asPatErr } = await supabaseAdmin
        .from('vehiculos_asignados')
        .select('viaje_id, vehiculo_id')
        .in('vehiculo_id', vehIds)
      if (asPatErr) return NextResponse.json({ ok: false, error: asPatErr.message }, { status: 400 })

      const setIds = new Set<string>()
      for (const a of asigsPat ?? []) if (a.viaje_id) setIds.add(a.viaje_id)
      viajeIdsPatente = Array.from(setIds)

      if (viajeIdsPatente.length === 0) {
        return NextResponse.json({ ok: true, items: [] })
      }
    }

    // --- (B) VIAJES (sin embeds ambiguos), aplicando estado/fecha y (si corresponde) filtro por ids
    let vq = supabaseAdmin
      .from('viajes')
      .select(`
        id,
        fecha_programada,
        estado,
        solicitudes (descripcion, clientes (nombre))
      `)
      .in('estado', estados)

    if (from) vq = vq.gte('fecha_programada', from)
    if (to) vq = vq.lte('fecha_programada', to)
    if (viajeIdsPatente && viajeIdsPatente.length > 0) {
      vq = vq.in('id', viajeIdsPatente)
    }

    const { data: viajes, error: vErr } = await vq
    if (vErr) return NextResponse.json({ ok: false, error: vErr.message }, { status: 400 })
    if (!viajes?.length) return NextResponse.json({ ok: true, items: [] })

    const viajeIds = viajes.map(v => v.id)

    // --- (C) ASIGNACIONES (para patente/chofer en la tarjeta)
    const { data: asignaciones, error: aErr } = await supabaseAdmin
      .from('vehiculos_asignados')
      .select(`
        id,
        viaje_id,
        vehiculo_id,
        chofer_id,
        vehiculos (patente, descripcion, tipo_id, tipos_vehiculo (nombre)),
        choferes (nombre, telefono)
      `)
      .in('viaje_id', viajeIds)
    if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 400 })

    const asigByViaje = new Map<string, any>()
    for (const a of asignaciones ?? []) {
      if (!asigByViaje.has(a.viaje_id)) asigByViaje.set(a.viaje_id, a)
    }

    // --- (D) ENTREGAS
    const { data: entregas, error: eErr } = await supabaseAdmin
      .from('viajes_entregas')
      .select(`
        id,
        viaje_id,
        orden,
        subcliente,
        direccion,
        localidad,
        provincia,
        remito,
        estado_entrega,
        completado_at
      `)
      .in('viaje_id', viajeIds)
    if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 400 })

    // --- (E) Reducir a la estructura pedida
    const byViaje = new Map<string, any>()
    for (const v of viajes) {
      const asig = asigByViaje.get(v.id) ?? null
      const veh = asig?.vehiculos ?? null
      const cho = asig?.choferes ?? null

      byViaje.set(v.id, {
        viaje_id: v.id,
        fecha_programada: v.fecha_programada,
        estado_viaje: v.estado,
        cliente: (v as any).solicitudes?.clientes?.nombre ?? null,
        solicitud_desc: (v as any).solicitudes?.descripcion ?? null,

        vehiculo_id: asig?.vehiculo_id ?? null,
        patente: veh?.patente ?? null,
        tipo_vehiculo: veh?.tipos_vehiculo?.nombre ?? null,

        chofer_id: asig?.chofer_id ?? null,
        chofer: cho?.nombre ?? null,
        telefono_chofer: cho?.telefono ?? null,

        total: 0,
        pendientes: 0,
        completadas: 0,
        fallidas: 0,

        pendientes_detalle: [] as any[],
        completadas_detalle: includeCompleted ? [] as any[] : undefined,
      })
    }

    for (const e of entregas ?? []) {
      const row = byViaje.get(e.viaje_id)
      if (!row) continue
      row.total++

      const st = (e.estado_entrega ?? 'pendiente') as EstadoEntrega
      if (st === 'pendiente') {
        row.pendientes++
        row.pendientes_detalle.push({
          id: e.id,
          orden: e.orden ?? null,
          subcliente: e.subcliente ?? null,
          direccion: e.direccion ?? null,
          localidad: e.localidad ?? null,
          provincia: e.provincia ?? null,
          remito: e.remito ?? null,
        })
      } else if (st === 'fallido') {
        row.fallidas++
        if (includeCompleted) row.completadas_detalle!.push({
          id: e.id, estado: 'fallido', orden: e.orden ?? null,
          subcliente: e.subcliente ?? null, remito: e.remito ?? null,
          completado_at: e.completado_at,
        })
      } else {
        row.completadas++
        if (includeCompleted) row.completadas_detalle!.push({
          id: e.id, estado: st, orden: e.orden ?? null,
          subcliente: e.subcliente ?? null, remito: e.remito ?? null,
          completado_at: e.completado_at,
        })
      }
    }

    const items = Array.from(byViaje.values()).sort((a, b) => {
      const ta = (a.tipo_vehiculo ?? '') + (a.patente ?? '')
      const tb = (b.tipo_vehiculo ?? '') + (b.patente ?? '')
      return ta.localeCompare(tb)
    })

    return NextResponse.json({ ok: true, items })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Error' }, { status: 500 })
  }
}
