import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveLink, isExpired } from '../../../_utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  estado: 'entregado' | 'fallido'
  notas?: string
  evidencia_url?: string
  lat?: number
  lng?: number
  device_time?: string // ISO opcional
}
async function tryCloseViaje(viaje_id: string) {
  const { data: entregas, error } = await supabaseAdmin
    .from('viajes_entregas')
    .select('estado')
    .eq('viaje_id', viaje_id)

  if (error || !entregas) return

  const abiertas = entregas.some(
    e => !['entregado','fallido'].includes(e.estado)
  )
  if (!abiertas) {
    await supabaseAdmin
      .from('viajes')
      .update({ 
        estado: 'completado', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', viaje_id)
  }
}


export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string, entregaId: string } }
) {
  const token = params.token
  const entregaId = params.entregaId
  if (!token || !entregaId) {
    return NextResponse.json({ error: 'Token y entregaId requeridos' }, { status: 400 })
  }

  const body = (await req.json()) as Body
  if (!body?.estado || !['entregado', 'fallido'].includes(body.estado)) {
    return NextResponse.json({ error: 'estado inválido (entregado|fallido)' }, { status: 400 })
  }

  const link = await resolveLink(token)
  if (!link) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  if (isExpired(link.expires_at)) {
    return NextResponse.json({ error: 'Link expirado' }, { status: 410 })
  }

  // Validar que la entrega pertenezca al viaje de este link
  const { data: entrega, error: entErr } = await supabaseAdmin
    .from('viajes_entregas')
    .select('id, viaje_id, estado')
    .eq('id', entregaId)
    .maybeSingle()

  if (entErr || !entrega) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })
  if (entrega.viaje_id !== link.viaje_id) {
    return NextResponse.json({ error: 'Entrega no corresponde a este viaje' }, { status: 403 })
  }

  const nowIso = new Date().toISOString()
  const patch: any = {
    estado: body.estado,
    observaciones: body.notas ?? null,
    evidencia_url: body.evidencia_url ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    updated_at: nowIso,
  }

  if (body.estado === 'entregado') {
    patch.entregado_at = body.device_time ?? nowIso
    patch.fallido_at = null
  } else if (body.estado === 'fallido') {
    patch.fallido_at = body.device_time ?? nowIso
    patch.entregado_at = null
  }

  // Después del update de la entrega
const { error: updErr } = await supabaseAdmin
  .from('viajes_entregas')
  .update(patch)
  .eq('id', entregaId)

if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

// 👉 Llamar acá para cerrar viaje si corresponde
await tryCloseViaje(link.viaje_id)

// Opcional: marcar used_at del link la primera vez
await supabaseAdmin
  .from('viajes_links')
  .update({ used_at: nowIso })
  .eq('id', link.link_id)
  .is('used_at', null)

return NextResponse.json({ ok: true })

}
