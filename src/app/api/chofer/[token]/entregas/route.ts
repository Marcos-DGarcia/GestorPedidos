import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Next 15: params es Promise -> hay que await
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const clean = (token ?? '').trim()
  if (!clean) {
    return NextResponse.json({ error: 'token requerido' }, { status: 400 })
  }

  const { data: link, error: linkErr } = await supabaseAdmin
    .from('viajes_links')
    .select('viaje_id')
    .eq('token', clean)
    .maybeSingle()
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
  if (!link?.viaje_id) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const { data: entregas, error: eErr } = await supabaseAdmin
    .from('viajes_entregas')
    .select('id, viaje_id, orden, subcliente, direccion, localidad, provincia, remito, estado_entrega, completado_at')
    .eq('viaje_id', link.viaje_id)
    .order('orden', { ascending: true })
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, entregas: entregas ?? [] })
}
