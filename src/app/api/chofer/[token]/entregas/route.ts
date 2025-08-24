import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ✅ Funciona en local y en producción (Vercel)
export async function GET(req: Request, context: any) {
  const token = String(context?.params?.token ?? '').trim()
  if (!token) {
    return NextResponse.json({ error: 'token requerido' }, { status: 400 })
  }

  // 1) Buscar link por token
  const { data: link, error: linkErr } = await supabaseAdmin
    .from('viajes_links')
    .select('viaje_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 })
  }
  if (!link?.viaje_id) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }

  // 2) Buscar entregas asociadas
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
    meta: {
      link_viaje_id: link.viaje_id,
      entregas_count: entregas?.length ?? 0,
    },
    entregas: entregas ?? [],
  })
}
