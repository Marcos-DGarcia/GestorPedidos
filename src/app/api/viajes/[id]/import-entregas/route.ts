import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const asStr = (v: unknown) => (v == null ? null : String(v).trim() || null)
const asInt = (v: unknown) => {
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? Math.trunc(n) : null
}
const norm = (s: string) =>
  s.toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

export async function POST(req: NextRequest, context: any) {
  const viaje_id = String(context?.params?.id ?? '')
  if (!viaje_id) return NextResponse.json({ error: 'viaje_id requerido' }, { status: 400 })

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

    const XLSX = (await import('xlsx')).default || (await import('xlsx'))
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return NextResponse.json({ error: 'Excel vacío' }, { status: 400 })

    const rowsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: null })
    if (!rowsRaw.length) return NextResponse.json({ error: 'No se encontraron filas' }, { status: 400 })

    const mapRow = (r: Record<string, unknown>) => {
      const entries = Object.entries(r).map(([k, v]) => [norm(k), v] as const)
      const obj = Object.fromEntries(entries)
      return {
        subcliente: asStr(obj['subcliente'] ?? obj['cliente'] ?? obj['razon_social']),
        direccion: asStr(obj['direccion'] ?? obj['domicilio']),
        localidad: asStr(obj['localidad'] ?? obj['ciudad']),
        provincia: asStr(obj['provincia']),
        remito: asStr(obj['remito'] ?? obj['comprobante'] ?? obj['pedido']),
        prioridad: asInt(obj['prioridad'] ?? obj['prio']),
        orden: asInt(obj['orden'] ?? obj['n'] ?? obj['nro'] ?? obj['numero']),
      }
    }

    const mapped = rowsRaw.map(mapRow)
    const payload = mapped.map((r, i) => ({
      viaje_id,
      orden: r.orden ?? i + 1,
      subcliente: r.subcliente,
      direccion: r.direccion,
      localidad: r.localidad,
      provincia: r.provincia,
      remito: r.remito,
      prioridad: r.prioridad ?? 2,
      estado_entrega: 'pendiente' as const,
    }))

    await supabaseAdmin.from('viajes_entregas').delete().eq('viaje_id', viaje_id)
    const { error: insErr } = await supabaseAdmin.from('viajes_entregas').insert(payload)
    if (insErr) throw insErr

    const { data: existing } = await supabaseAdmin
      .from('viajes_links').select('token').eq('viaje_id', viaje_id).maybeSingle()

    const finalToken = existing?.token || crypto.randomBytes(16).toString('hex')
    if (!existing?.token) {
      const { error: linkErr } = await supabaseAdmin
        .from('viajes_links').insert({ viaje_id, token: finalToken })
      if (linkErr) throw linkErr
    }

    let base = process.env.NEXT_PUBLIC_BASE_URL || ''
    if (!base && process.env.VERCEL_URL) base = `https://${process.env.VERCEL_URL}`
    const portalUrl = base ? `${base}/chofer/${finalToken}` : null

    return NextResponse.json({ ok: true, insertedCount: payload.length, token: finalToken, portalUrl })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
