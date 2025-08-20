import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveLink, isExpired } from '../../_utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  // 1) Validar token
  const link = await resolveLink(token)
  if (!link) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  if (isExpired(link.expires_at)) return NextResponse.json({ error: 'Link expirado' }, { status: 410 })

  // 2) Traer el viaje (incluyendo solicitud_id si existe en tu tabla)
  const { data: viaje, error: vErr } = await supabaseAdmin
    .from('viajes')
    .select('id, descripcion, fecha_programar, estado, solicitud_id') // <-- ajustá el nombre si es distinto
    .eq('id', link.viaje_id)
    .single()

  if (vErr || !viaje) {
    return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 })
  }

  // 3) Resolver nombre de cliente en pasos (sin joins anidados)
  let clienteNombre: string | null = null
  if (viaje.solicitud_id) {
    const { data: solicitud } = await supabaseAdmin
      .from('solicitudes')
      .select('id, cliente_id')
      .eq('id', viaje.solicitud_id)
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

  // 4) Entregas del viaje (columnas según tu tabla + las nuevas si las agregaste)
  const { data: entregas, error: eErr } = await supabaseAdmin
    .from('viajes_entregas')
    .select(`
      id,
      orden,
      subcliente,
      direccion,
      localidad,
      provincia,
      remito,
      estado,
      observaciones,
      completado_at,
      created_at,
      prioridad,
      evidencia_url,
      lat,
      lng,
      entregado_at,
      fallido_at
    `)
    .eq('viaje_id', link.viaje_id)
    .order('orden', { ascending: true })

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  return NextResponse.json({
    viaje: {
      id: viaje.id,
      descripcion: viaje.descripcion,
      fecha_programar: viaje.fecha_programar,
      estado: viaje.estado,
      cliente: clienteNombre,
    },
    entregas: entregas ?? [],
  })
}
