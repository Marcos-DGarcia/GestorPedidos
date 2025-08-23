import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveLink, isExpired } from '../../_utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, context: any) {
  try {
    const token = String(context?.params?.token ?? '')
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    // 1) Validar token -> viaje_id
    const link = await resolveLink(token)
    if (!link) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
    if (isExpired(link.expires_at)) return NextResponse.json({ error: 'Link expirado' }, { status: 410 })

    // 2) Traer viaje (nombres defensivos de columnas)
    const { data: viaje, error: vErr } = await supabaseAdmin
      .from('viajes')
      .select('id, descripcion, fecha_programada, estado, solicitud_id')
      .eq('id', link.viaje_id)
      .maybeSingle()

    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })
    if (!viaje) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })

    // 3) Resolver nombre de cliente (sin joins)
    let clienteNombre: string | null = null
    if ((viaje as any).solicitud_id) {
      const { data: solicitud } = await supabaseAdmin
        .from('solicitudes')
        .select('cliente_id')
        .eq('id', (viaje as any).solicitud_id)
        .maybeSingle()
      const clienteId = solicitud?.cliente_id
      if (clienteId) {
        const { data: cliente } = await supabaseAdmin
          .from('clientes')
          .select('nombre')
          .eq('id', clienteId)
          .maybeSingle()
        clienteNombre = cliente?.nombre ?? null
      }
    }

    // 4) Entregas del viaje — usar estado_entrega (no “estado”)
    const { data: entregas, error: eErr } = await supabaseAdmin
      .from('viajes_entregas')
      .select(`
        id,
        viaje_id,
        orden,
        prioridad,
        subcliente,
        direccion,
        localidad,
        provincia,
        remito,
        observaciones,
        evidencia_url,
        lat,
        lng,
        estado_entrega,
        completado_at,
        entregado_at,
        fallido_at,
        created_at
      `)
      .eq('viaje_id', link.viaje_id)
      .order('orden', { ascending: true })

    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      viaje: {
        id: viaje.id,
        descripcion: (viaje as any).descripcion ?? null,
        fecha_programada: (viaje as any).fecha_programada ?? null,
        estado: (viaje as any).estado ?? null,
        cliente: clienteNombre,
      },
      entregas: entregas ?? [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
