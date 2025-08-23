// app/api/viajes/[id]/import-entregas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helpers
const asStr = (v: unknown) => (v == null ? null : String(v).trim() || null)
const asInt = (v: unknown) => {
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? Math.trunc(n) : null
}
// normaliza claves: quita tildes, espacios, mayus
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const viaje_id = String(params.id || '')
  if (!viaje_id) return NextResponse.json({ error: 'viaje_id requerido' }, { status: 400 })

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

    // 1) Parsear Excel
    const XLSX = (await import('xlsx')).default || (await import('xlsx'))
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return NextResponse.json({ error: 'Excel vacío' }, { status: 400 })
    const rowsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: null })

    if (!rowsRaw.length) {
      return NextResponse.json({ error: 'No se encontraron filas en el Excel' }, { status: 400 })
    }

    // 2) Mapeo flexible de encabezados
    // Intentamos reconocer columnas típicas (admitimos variantes como "Sub Cliente", "Localidad", etc.)
    const mapRow = (r: Record<string, unknown>) => {
      const entries = Object.entries(r).map(([k, v]) => [norm(k), v] as const)
      const obj = Object.fromEntries(entries)

      const subcliente = asStr(obj['subcliente'] ?? obj['cliente'] ?? obj['razon_social'])
      const direccion = asStr(obj['direccion'] ?? obj['domicilio'])
      const localidad = asStr(obj['localidad'] ?? obj['ciudad'])
      const provincia = asStr(obj['provincia'])
      const remito = asStr(obj['remito'] ?? obj['comprobante'] ?? obj['pedido'])
      const prioridad = asInt(obj['prioridad'] ?? obj['prio'])
      const orden = asInt(obj['orden'] ?? obj['n'] ?? obj['nro'] ?? obj['numero'])

      return {
        subcliente,
        direccion,
        localidad,
        provincia,
        remito,
        prioridad,
        orden,
      }
    }

    const mapped = rowsRaw.map(mapRow)

    // 3) Construir payload para viajes_entregas
    //    Usamos estado_entrega = 'pendiente' (coincide con tu lectura en el panel del chofer)
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

    // 4) Reemplazar entregas del viaje (borrar e insertar)
    await supabaseAdmin.from('viajes_entregas').delete().eq('viaje_id', viaje_id)

    const { error: insErr } = await supabaseAdmin.from('viajes_entregas').insert(payload)
    if (insErr) throw insErr

    // 5) Asegurar link del chofer
    const tokenNew = crypto.randomBytes(16).toString('hex')
    const { data: existing } = await supabaseAdmin
      .from('viajes_links')
      .select('token')
      .eq('viaje_id', viaje_id)
      .maybeSingle()

    const finalToken = existing?.token || tokenNew
    if (!existing?.token) {
      const { error: linkErr } = await supabaseAdmin
        .from('viajes_links')
        .insert({ viaje_id, token: finalToken })
      if (linkErr) throw linkErr
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : ''
    const portalUrl = base ? `${base}/chofer/${finalToken}` : null

    return NextResponse.json({
      ok: true,
      insertedCount: payload.length,
      token: finalToken,
      portalUrl,
    })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
