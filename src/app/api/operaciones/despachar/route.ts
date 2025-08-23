// app/api/operaciones/despachar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import twilio from 'twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helpers
const asStr = (v: unknown) => String(v ?? '')
const toE164 = (tel: string) => {
  const t = (tel || '').trim()
  if (!t) return ''
  return t.startsWith('+') ? t : `+${t.replace(/\D/g, '')}`
}
const resolveBaseUrl = (req: NextRequest) => {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const host = req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : 'http://localhost:3000'
}

export async function POST(req: NextRequest) {
  let parsedBody: any = null

  try {
    // body
    parsedBody = await req.json().catch(() => ({}))
    const viajeId = asStr(parsedBody?.viajeId)
    const canal: 'whatsapp' | 'sms' = parsedBody?.canal === 'sms' ? 'sms' : 'whatsapp'
    const customMsg: string | undefined = parsedBody?.mensaje
    const mediaUrl: string | undefined = parsedBody?.archivo_url
    if (!viajeId) return NextResponse.json({ error: 'viajeId requerido' }, { status: 400 })

    // chofer del viaje
    const { data: asign, error: asignErr } = await supabaseAdmin
      .from('vehiculos_asignados')
      .select('chofer_id')
      .eq('viaje_id', viajeId)
      .limit(1)
      .single()
    if (asignErr || !asign?.chofer_id) {
      return NextResponse.json({ error: 'No hay chofer asignado al viaje' }, { status: 404 })
    }

    const { data: chofer, error: choferErr } = await supabaseAdmin
      .from('choferes')
      .select('telefono, nombre')
      .eq('id', asign.chofer_id)
      .single()
    if (choferErr || !chofer?.telefono) {
      return NextResponse.json({ error: 'No se encontró teléfono del chofer' }, { status: 404 })
    }

    // link del portal
    const { data: linkRow } = await supabaseAdmin
      .from('viajes_links')
      .select('token')
      .eq('viaje_id', viajeId)
      .maybeSingle()
    const baseUrl = resolveBaseUrl(req)
    const portalUrl = linkRow?.token ? `${baseUrl}/chofer/${linkRow.token}` : baseUrl

    // mensaje
    const texto = customMsg || `Tenés un viaje asignado (ID: ${viajeId}). Link: ${portalUrl}`

    // log preliminar
    const { data: prelim, error: insErr } = await supabaseAdmin
      .from('mensajes_chofer')
      .insert({
        viaje_id: viajeId,
        chofer_id: asign.chofer_id,
        telefono: chofer.telefono,
        canal,
        mensaje: texto,
        archivo_url: mediaUrl ?? null,
        estado: 'pendiente'
      })
      .select('id')
      .single()
    if (insErr) throw insErr

    // Twilio client (validaciones DENTRO del handler para no romper el build)
    const ACC_SID = process.env.TWILIO_ACCOUNT_SID
    const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
    if (!ACC_SID || !AUTH_TOKEN) {
      return NextResponse.json({ error: 'Faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN' }, { status: 500 })
    }
    const client = twilio(ACC_SID, AUTH_TOKEN)

    // payload Twilio
    const to = canal === 'whatsapp'
      ? `whatsapp:${toE164(asStr(chofer.telefono))}`
      : toE164(asStr(chofer.telefono))

    const params: any = { to, body: texto }
    if (baseUrl && !baseUrl.includes('localhost')) {
      params.statusCallback = `${baseUrl}/api/webhooks/twilio-status`
    }
    if (mediaUrl) params.mediaUrl = [mediaUrl]

    const MSG_SVC = process.env.TWILIO_MESSAGING_SERVICE_SID || ''
    if (MSG_SVC) {
      params.messagingServiceSid = MSG_SVC
    } else {
      if (canal === 'whatsapp') {
        const FROM = process.env.TWILIO_WHATSAPP_FROM
        if (!FROM) return NextResponse.json({ error: 'Falta TWILIO_WHATSAPP_FROM' }, { status: 500 })
        params.from = FROM // ej: 'whatsapp:+14155238886' (sandbox) o tu WABA
      } else {
        const FROM = process.env.TWILIO_SMS_FROM
        if (!FROM) return NextResponse.json({ error: 'Falta TWILIO_SMS_FROM' }, { status: 500 })
        params.from = FROM // ej: '+1XXXXXXXXXX'
      }
    }

    const tw = await client.messages.create(params)

    // actualizar log → enviado
    await supabaseAdmin
      .from('mensajes_chofer')
      .update({ proveedor_msg_id: tw.sid, estado: 'enviado', updated_at: new Date().toISOString() })
      .eq('id', prelim.id)

    // avanzar estado del viaje
    await supabaseAdmin.from('viajes').update({ estado: 'en_progreso' }).eq('id', viajeId)

    return NextResponse.json({ ok: true, sid: tw.sid, portalUrl })
  } catch (e: any) {
    // log de fallo (si pudimos parsear body)
    try {
      if (parsedBody?.viajeId) {
        await supabaseAdmin
          .from('mensajes_chofer')
          .insert({
            viaje_id: parsedBody.viajeId,
            chofer_id: null,
            telefono: 'desconocido',
            canal: parsedBody?.canal || 'whatsapp',
            mensaje: parsedBody?.mensaje || null,
            estado: 'fallo',
            error_detalle: String(e?.message || e),
          })
      }
    } catch { /* noop */ }

    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
