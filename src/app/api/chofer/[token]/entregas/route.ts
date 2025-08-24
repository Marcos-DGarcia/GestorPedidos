// src/app/api/chofer/[token]/entregas/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  context: { params?: Record<string, string> }
) {
  const token = context?.params?.token?.trim() || ''
  if (!token) {
    return NextResponse.json({ error: 'token requerido' }, { status: 400 })
  }

  // 1) Buscar el link del viaje
  const { data: link, error: linkErr } = await supabaseAdmin
    .from('viajes_links')
    .select('viaje_id')
    .eq('token', token)
    .maybeSingle()

  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 })
  }
  if (!link?.viaje_id) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }

  // 2) Entregas del viaje
  const { data: entregas, error: eErr } = await supabaseAdmin
    .from('viajes_entregas')
    .select(
      'id, viaje_id, orden, subcliente, direccion, localidad, provincia, remito, estado_entrega, completado_at'
    )
    .eq('viaje_id', link.viaje_id)
    .order('orden', { ascending: true })

  if (eErr) {
    return NextResponse.json({ error: eErr.message }, { status: 500 })
  }

  // 3) Respuesta final
  return NextResponse.json({
    ok: true,
    entregas: entregas ?? [],
  })
}
