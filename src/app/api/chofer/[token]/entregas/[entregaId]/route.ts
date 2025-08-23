// app/api/chofer/[token]/entregas/[entregaId]/route.ts
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

// Cierra el viaje cuando TODAS las entregas están en estado final
async function tryCloseViaje(viaje_id: string) {
  const { data: entregas, error } = await supabaseAdmin
    .from('viajes_entregas')
    .select('estado_entrega')
    .eq('viaje_id', viaje_id)

  if (error || !entregas) return

  const abiertas = entregas.some(e => !['entregado', 'fallido'].includes((e as any).estado_entrega))
  if (!abiertas) {
    await supabaseAdmin
      .from('viajes')
      .update({
        estado: 'realizado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', viaje_id)
  }
}

export async function PATCH(req: NextRequest, context: any) {
  try {
    const token = String(context?.params?.token ?? '')
    const entregaId = String(context?.params?.entregaId ?? '')
    if (!token || !entregaId) {
      return NextResponse.json({ error: 'Token y entregaId requeridos' }, { status: 400 })
    }

    const body = (await req.json()) as Body
    if (!body?.estado || !['entregado', 'fallido'].includes(body.estado)) {
      return NextResponse.json({ error: 'estado inválido (entregado|fallido)' }, { status: 400 })
    }

    // Link del viaje
    const link = await resolveLink(token)
    if (!link) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
    if (isExpired((link as any).expires_at)) {
      return NextResponse.json({ error: 'Link expirado' }, { status: 410 })
    }

    // Validar que la entrega pertenezca al viaje de este link
    const { data: entrega, error: entErr } = await supabaseAdmin
      .from('viajes_entregas')
      .select('id, viaje_id')
      .eq('id', entregaId)
      .maybeSingle()

    if (entErr || !entrega) {
      return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })
    }
    if (String((entrega as any).viaje_id) !== String((link as any).viaje_id)) {
      return NextResponse.json({ error: 'Entrega no corresponde a este viaje' }, { status: 403 })
    }

    // Armar patch
    const nowIso = new Date().toISOString()
    const patch: Record<string, unknown> = {
      estado_entrega: body.estado,          // <- columna correcta
      observaciones: body.notas ?? null,
      evidencia_url: body.evidencia_url ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      updated_at: nowIso,
      completado_at: nowIso,                // útil para panel
    }

    if (body.estado === 'entregado') {
      patch.entregado_at = body.device_time ?? nowIso
      patch.fallido_at = null
    } else {
      patch.fallido_at = body.device_time ?? nowIso
      patch.entregado_at = null
    }

    // Actualizar entrega
    const { error: updErr } = await supabaseAdmin
      .from('viajes_entregas')
      .update(patch)
      .eq('id', entregaId)

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    // Intentar cerrar viaje si corresponde
    await tryCloseViaje(String((link as any).viaje_id))

    // Marcar used_at del link la primera vez (no molesta si no existe esa columna)
    await supabaseAdmin
      .from('viajes_links')
      .update({ used_at: nowIso })
      .eq('id', (link as any).link_id)
      .is('used_at', null)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
