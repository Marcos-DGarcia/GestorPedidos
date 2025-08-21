import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: viaje_id } = await params
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

    // 1) Parsear Excel a filas (pseudocódigo)
    // const arrayBuffer = await file.arrayBuffer()
    // const rows = parseExcel(arrayBuffer)  // ← implementá con xlsx

    // 2) Insertar en viajes_entregas (ejemplo con filas mock)
    // const payload = rows.map((r, i) => ({
    //   viaje_id,
    //   orden: i + 1,
    //   subcliente: r.subcliente || null,
    //   direccion: r.direccion || null,
    //   localidad: r.localidad || null,
    //   provincia: r.provincia || null,
    //   remito: r.remito || null,
    //   estado: 'pendiente',
    //   prioridad: 2
    // }))
    // const { error: insErr } = await supabaseAdmin.from('viajes_entregas').insert(payload)
    // if (insErr) throw insErr

    // 3) Asegurar link del chofer
    const token = crypto.randomBytes(16).toString('hex')
    const { data: existing } = await supabaseAdmin
      .from('viajes_links')
      .select('token').eq('viaje_id', viaje_id).maybeSingle()
    let finalToken = existing?.token || token
    if (!existing?.token) {
      const { error: linkErr } = await supabaseAdmin
        .from('viajes_links').insert({ viaje_id, token: finalToken })
      if (linkErr) throw linkErr
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || ''
    const portalUrl = base ? `${base}/chofer/${finalToken}` : null

    return NextResponse.json({ ok: true, token: finalToken, portalUrl })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
