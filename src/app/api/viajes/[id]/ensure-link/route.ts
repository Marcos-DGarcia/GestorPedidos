// app/api/viajes/[id]/ensure-link/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const viajeId = String(params.id || '')
    if (!viajeId) {
      return NextResponse.json({ error: 'viajeId faltante' }, { status: 400 })
    }

    // leer ?choferId=...
    const { searchParams } = new URL(req.url)
    const choferId = searchParams.get('choferId') || null

    // ¿ya existe link? (si viene choferId, filtramos también por él)
    let query = supabaseAdmin
      .from('viajes_links')
      .select('id, token')
      .eq('viaje_id', viajeId)
      .limit(1)

    if (choferId) query = query.eq('chofer_id', choferId)

    const { data: existing, error: exErr } = await query
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })

    let finalToken: string
    if (existing && existing.length > 0) {
      finalToken = String(existing[0].token)
    } else {
      finalToken = crypto.randomBytes(24).toString('base64url')

      // inserta sin expires_at (evitamos desfasajes de esquema)
      const { error: insErr } = await supabaseAdmin
        .from('viajes_links')
        .insert({ viaje_id: viajeId, chofer_id: choferId, token: finalToken })

      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    // armar portalUrl
    let base = process.env.NEXT_PUBLIC_BASE_URL || ''
    if (!base) {
      const vercel = process.env.VERCEL_URL // my-app.vercel.app
      if (vercel) base = `https://${vercel}`
    }
    const portalUrl = base ? `${base}/chofer/${finalToken}` : null

    return NextResponse.json({ ok: true, token: finalToken, portalUrl })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
