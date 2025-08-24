// app/api/chofer/[token]/entregas/[entregaId]/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Next 15: params es Promise -> await
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ token: string; entregaId: string }> }
) {
  try {
    const { token, entregaId } = await params
    const cleanToken = (token ?? '').trim()
    const cleanEntregaId = (entregaId ?? '').trim()

    if (!cleanToken || !cleanEntregaId) {
      return NextResponse.json({ ok: false, error: 'Parámetros inválidos' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({} as any))
    const estado = String(body?.estado ?? '').trim() as 'pendiente' | 'completado' | 'fallido'

    const PERMITIDOS = new Set(['pendiente', 'completado', 'fallido'])
    if (!PERMITIDOS.has(estado)) {
      return NextResponse.json({ ok: false, error: 'Estado inválido' }, { status: 400 })
    }

    // 1) Resolver viaje por token
    const { data: link, error: linkErr } = await supabaseAdmin
      .from('viajes_links')
      .select('viaje_id')
      .eq('token', cleanToken)
      .maybeSingle()

    if (linkErr) return NextResponse.json({ ok: false, error: linkErr.message }, { status: 500 })
    if (!link?.viaje_id) {
      return NextResponse.json({ ok: false, error: 'Link inválido' }, { status: 404 })
    }

    // 2) Verificar que la entrega pertenezca al viaje del token
    const { data: entrega, error: entErr } = await supabaseAdmin
      .from('viajes_entregas')
      .select('id, viaje_id')
      .eq('id', cleanEntregaId)
      .maybeSingle()

    if (entErr) return NextResponse.json({ ok: false, error: entErr.message }, { status: 500 })
    if (!entrega || entrega.viaje_id !== link.viaje_id) {
      return NextResponse.json(
        { ok: false, error: 'La entrega no pertenece al viaje del token' },
        { status: 403 }
      )
    }

    // 3) Actualizar estado (columna correcta: `estado`) y timestamp
    const patch: Record<string, any> = {
      estado,
      completado_at: estado === 'completado' ? new Date().toISOString() : null,
    }

    const { error: upErr } = await supabaseAdmin
      .from('viajes_entregas')
      .update(patch)
      .eq('id', cleanEntregaId)
      .eq('viaje_id', link.viaje_id) // defensa extra
      .select('id')
      .maybeSingle()

    if (upErr) {
      // Si acá tiraba el constraint, era por usar `estado_entrega` o un valor no permitido
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })
    }

    // 4) Si no quedan pendientes -> cerrar viaje
    const { data: abierto, error: pendErr } = await supabaseAdmin
      .from('viajes_entregas')
      .select('id')
      .eq('viaje_id', link.viaje_id)
      .neq('estado', 'completado') // <— columna correcta
      .limit(1)

    if (pendErr) return NextResponse.json({ ok: false, error: pendErr.message }, { status: 500 })

    if (!abierto || abierto.length === 0) {
      await supabaseAdmin.from('viajes').update({ estado: 'realizado' }).eq('id', link.viaje_id)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Error' }, { status: 500 })
  }
}
