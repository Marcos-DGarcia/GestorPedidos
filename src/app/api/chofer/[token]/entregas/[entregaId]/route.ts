import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: Request,
  { params }: { params: { token: string; entregaId: string } }
) {
  const token = (params.token || '').trim()
  const entregaId = params.entregaId || ''
  if (!token || !entregaId) {
    return NextResponse.json({ error: 'parámetros inválidos' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({} as any))
  const estado: 'completado' | 'pendiente' | 'fallido' | undefined = body?.estado

  const { data: link, error: linkErr } = await supabaseAdmin
    .from('viajes_links')
    .select('viaje_id')
    .eq('token', token)
    .maybeSingle()
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
  if (!link?.viaje_id) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const { data: entrega, error: entErr } = await supabaseAdmin
    .from('viajes_entregas')
    .select('id, viaje_id')
    .eq('id', entregaId)
    .maybeSingle()
  if (entErr) return NextResponse.json({ error: entErr.message }, { status: 500 })
  if (!entrega || entrega.viaje_id !== link.viaje_id) {
    return NextResponse.json({ error: 'entrega no pertenece al viaje del token' }, { status: 403 })
  }

  const patch: Record<string, any> = {}
  if (estado === 'completado') { patch.estado_entrega = 'completado'; patch.completado_at = new Date().toISOString() }
  else if (estado === 'fallido') { patch.estado_entrega = 'fallido'; patch.completado_at = null }
  else if (estado === 'pendiente') { patch.estado_entrega = 'pendiente'; patch.completado_at = null }

  if (Object.keys(patch).length) {
    const { error: upErr } = await supabaseAdmin
      .from('viajes_entregas')
      .update(patch)
      .eq('id', entregaId)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  const { data: pendientes, error: pendErr } = await supabaseAdmin
    .from('viajes_entregas')
    .select('id')
    .eq('viaje_id', link.viaje_id)
    .neq('estado_entrega', 'completado')
    .limit(1)
  if (pendErr) return NextResponse.json({ error: pendErr.message }, { status: 500 })

  if (!pendientes || pendientes.length === 0) {
    await supabaseAdmin.from('viajes').update({ estado: 'realizado' }).eq('id', link.viaje_id)
  }

  return NextResponse.json({ ok: true })
}
