import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
   { params }: { params: Promise<{ id: string }> }
) {
 const { id } = await params
  const { searchParams } = new URL(_req.url)
  const choferId = searchParams.get('choferId') || undefined
  const viajeId = id
  if (!viajeId) return NextResponse.json({ error: 'viajeId faltante' }, { status: 400 })

  // ¿Ya hay link?
  let query = supabaseAdmin.from('viajes_links').select('id, token, expires_at').eq('viaje_id', viajeId).limit(1)
  if (choferId) query = query.eq('chofer_id', choferId)

  const { data: existing, error: exErr } = await query
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })

  if (existing && existing.length) {
    return NextResponse.json({ token: existing[0].token })
  }

  const token = crypto.randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() // 7 días

  const { data, error } = await supabaseAdmin
    .from('viajes_links')
    .insert({ viaje_id: viajeId, chofer_id: choferId ?? null, token, expires_at: expiresAt })
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token: data.token })
}
