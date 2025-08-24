// app/api/chofer/[token]/entregas/[entregaId]/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---- Tipos locales para evitar casts inline problemáticos
type EstadoUI = 'pendiente' | 'entregado' | 'fallido' | 'completado'
type EstadoDB = 'pendiente' | 'entregado' | 'fallido' | 'completado'

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

    const estadoIn = String(body?.estado ?? '')
      .trim()
      .toLowerCase() as EstadoUI

    const PERMITIDOS: ReadonlySet<EstadoUI> = new Set([
      'pendiente',
      'entregado',
      'fallido',
      'completado',
    ])
    if (!PERMITIDOS.has(estadoIn)) {
      return NextResponse.json({ ok: false, error: 'Estado inválido' }, { status: 400 })
    }

    // Mapear UI -> DB (si tu CHECK aún usa 'entregado' para "completado")
    const estadoDB: EstadoDB = (estadoIn === 'completado' ? 'entregado' : estadoIn) as EstadoDB

    const isTerminado =
      estadoDB === 'entregado' ||
      estadoDB === 'completado' ||
      estadoDB === 'fallido'

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

    // 2) Verificar pertenencia
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

    // 3) Actualizar estado + timestamps
    const patch: Record<string, any> = {
      estado_entrega: estadoDB,
      // Seteamos completado_at para entregado/completado/fallido
      completado_at: isTerminado ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    const { error: upErr } = await supabaseAdmin
      .from('viajes_entregas')
      .update(patch)
      .eq('id', cleanEntregaId)
      .eq('viaje_id', link.viaje_id)
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })

    // 4) Cerrar viaje si NO quedan pendientes (fallidos cuentan como terminados)
    const { data: pendientes, error: pendErr } = await supabaseAdmin
      .from('viajes_entregas')
      .select('id')
      .eq('viaje_id', link.viaje_id)
      .eq('estado_entrega', 'pendiente')
      .limit(1)
    if (pendErr) return NextResponse.json({ ok: false, error: pendErr.message }, { status: 500 })

    if (!pendientes || pendientes.length === 0) {
      await supabaseAdmin.from('viajes').update({ estado: 'realizado' }).eq('id', link.viaje_id)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Error' }, { status: 500 })
  }
}
