import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, context: any) {
  try {
    const viajeId = String(context?.params?.id ?? '')
    if (!viajeId) {
      return NextResponse.json({ error: 'viajeId faltante' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const choferId = searchParams.get('choferId') || null

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
      const { error: insErr } = await supabaseAdmin
        .from('viajes_links')
        .insert({ viaje_id: viajeId, chofer_id: choferId, token: finalToken })
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    // helper opcional (puede ir al top del archivo)
    const getPublicBaseUrl = () => {
      // en dev permitimos localhost para probar
      const raw =
        process.env.NEXT_PUBLIC_BASE_URL ||
        (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
      return raw ? raw.replace(/\/+$/, '') : '';
    };

    // ...dentro del handler:
    const base = getPublicBaseUrl();
    if (!base) {
      // no generes un link si no hay dominio público configurado
      return NextResponse.json(
        { error: 'Falta configurar NEXT_PUBLIC_BASE_URL (dominio público)' },
        { status: 500 }
      );
    }
    const portalUrl = `${base}/chofer/${finalToken}`;


    return NextResponse.json({ ok: true, token: finalToken, portalUrl })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
