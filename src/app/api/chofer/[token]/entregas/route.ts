import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: { token: string } }

// Helper: resuelve token -> viaje_id de forma directa y defensiva
async function getLinkByToken(tokenRaw: string) {
  const token = String(tokenRaw || '').trim()
  if (!token) throw new Error('Token requerido')

  const { data, error } = await supabaseAdmin
    .from('viajes_links')
    .select('id, token, viaje_id, chofer_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.viaje_id) throw new Error('Link inválido')
  return data
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    // 1) Token -> link
    const link = await getLinkByToken(params.token)

    // 2) (Opcional) Expiración: solo si realmente usás expires_at
    if (link.expires_at) {
      const exp = new Date(link.expires_at).getTime()
      if (Number.isFinite(exp) && Date.now() > exp) {
        return NextResponse.json({ error: 'Link expirado' }, { status: 410 })
      }
    }

    // 3) Viaje (sanity check)
    const { data: viaje, error: vErr } = await supabaseAdmin
      .from('viajes')
      .select('id, descripcion, fecha_programada, estado, solicitud_id')
      .eq('id', link.viaje_id)
      .maybeSingle()

    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })
    if (!viaje) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })

    // 4) Cliente (sin joins)
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

    // 5) Entregas del viaje (usa exactamente los nombres que tenés)
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

    // 6) Devolvé meta útil para validar rápido en prod
    return NextResponse.json({
      ok: true,
      meta: {
        link_viaje_id: link.viaje_id,
        entregas_count: entregas?.length ?? 0,
      },
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
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 })
  }
}
