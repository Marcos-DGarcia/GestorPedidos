// app/api/operaciones/notify-chofer/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import twilio from 'twilio'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------- helpers ----------
const asStr = (v: unknown) => String(v ?? '')
const toE164 = (tel: string) => {
  const t = tel.trim()
  if (!t) return ''
  if (t.startsWith('+')) return t
  return `+${t.replace(/\D/g, '')}`
}
const requireEnv = (key: string) => {
  const v = process.env[key]
  if (!v) throw new Error(`Falta env ${key}`)
  return v
}

// Twilio client
const ACC_SID = requireEnv('TWILIO_ACCOUNT_SID')
const AUTH_TOKEN = requireEnv('TWILIO_AUTH_TOKEN')
const client = twilio(ACC_SID, AUTH_TOKEN)

// arma base pública robusta
function resolveBaseUrl(req: NextRequest) {
  let base = process.env.NEXT_PUBLIC_BASE_URL
  if (base) return base
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  // último recurso: host del request
  const host = req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : 'http://localhost:3000'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const viajeId = asStr(body?.viajeId)
    const choferId = asStr(body?.choferId)
    const canal: 'whatsapp' | 'sms' = body?.canal === 'sms' ? 'sms' : 'whatsapp'
    const msgManual: string | undefined = body?.mensaje
    const archivo_url: string | undefined = body?.archivo_url

    if (!viajeId || !choferId) {
      return NextResponse.json({ error: 'viajeId y choferId son obligatorios' }, { status: 400 })
    }

    // 1) Traer chofer
    const { data: chofer, error: chErr } = await supabaseAdmin
      .from('choferes')
      .select('telefono, nombre')
      .eq('id', choferId)
      .single()
    if (chErr || !chofer?.telefono) {
      return NextResponse.json({ error: 'No se encontró teléfono del chofer' }, { status: 404 })
    }

    // 2) Asegurar token/link (sin llamar a otra ruta)
    const { data: existing } = await supabaseAdmin
      .from('viajes_links')
      .select('token')
      .eq('viaje_id', viajeId)
      .maybeSingle()

    let finalToken = existing?.token as string | undefined
    if (!finalToken) {
      finalToken = crypto.randomBytes(24).toString('base64url')
      const { error: linkErr } = await supabaseAdmin
        .from('viajes_links')
        .insert({ viaje_id: viajeId, chofer_id: choferId, token: finalToken })
      if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
    }

    const baseUrl = resolveBaseUrl(req)
    const linkChofer = `${baseUrl}/chofer/${finalToken}`

    // 3) Construir mensaje (si no viene manual)
    let mensaje = msgManual
    if (!mensaje) {
      const { data: entregas } = await supabaseAdmin
        .from('viajes_entregas')
        .select('id, subcliente, remito, estado_entrega, orden')
        .eq('viaje_id', viajeId)
        .order('orden', { ascending: true })
        .limit(5)

      const primeras =
        (entregas ?? [])
          .map((e) => `• ${e.subcliente || 'Entrega'} ${e.remito ? `(#${e.remito})` : ''}`)
          .join('\n')

      mensaje =
`Hola ${chofer?.nombre || ''} 👋
Tenés un viaje asignado. Primeras paradas:
${primeras || '• Ver detalle en el link'}
Ingresá para gestionar entregas:
${linkChofer}`
    }

    // 4) Log preliminar
    const { data: prelim, error: insErr } = await supabaseAdmin
      .from('mensajes_chofer')
      .insert({
        viaje_id: viajeId,
        chofer_id: choferId,
        telefono: chofer.telefono,
        canal,
        mensaje,
        archivo_url: archivo_url ?? null,
        estado: 'pendiente'
      })
      .select('id')
      .single()
    if (insErr) throw insErr

    // 5) Twilio payload
    const to = canal === 'whatsapp' ? `whatsapp:${toE164(chofer.telefono)}` : toE164(chofer.telefono)

    const params: any = {
      to,
      body: mensaje,
    }

    // status callback opcional solo si tenemos dominio público
    if (baseUrl && !baseUrl.includes('localhost')) {
      params.statusCallback = `${baseUrl}/api/webhooks/twilio-status`
    }

    // media opcional
    if (archivo_url) params.mediaUrl = [archivo_url]

    // preferí Messaging Service si existe, sino FROM por canal
    const MSG_SVC = process.env.TWILIO_MESSAGING_SERVICE_SID || ''
    if (MSG_SVC) {
      params.messagingServiceSid = MSG_SVC
    } else {
      if (canal === 'whatsapp') {
        params.from = requireEnv('TWILIO_WHATSAPP_FROM') // ej 'whatsapp:+14155238886'
      } else {
        params.from = requireEnv('TWILIO_SMS_FROM')       // ej '+1XXXXXXXXXX'
      }
    }

    const tw = await client.messages.create(params)

    // 6) Actualizar log a 'enviado'
    await supabaseAdmin
      .from('mensajes_chofer')
      .update({ proveedor_msg_id: tw.sid, estado: 'enviado', updated_at: new Date().toISOString() })
      .eq('id', prelim.id)

    // 7) Opcional: marcar viaje en_progreso
    await supabaseAdmin.from('viajes').update({ estado: 'en_progreso' }).eq('id', viajeId)

    return NextResponse.json({ ok: true, sid: tw.sid, link: linkChofer })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
