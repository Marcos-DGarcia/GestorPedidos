// app/api/webhooks/twilio-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import twilio from 'twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VERIFY_SIG = (process.env.TWILIO_VERIFY_SIGNATURE || '').toLowerCase() === 'true'
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''

function mapEstado(statusRaw: string) {
  const s = (statusRaw || '').toLowerCase()
  // Twilio MessageStatus values comunes:
  // queued, accepted, sending, sent, delivered, undelivered, failed, read, received (inbound)
  if (['failed', 'undelivered', 'canceled', 'cancelled'].includes(s)) return 'fallo'
  if (['delivered', 'read', 'received'].includes(s)) return 'entregado'
  if (['sent', 'sending', 'accepted', 'queued', 'scheduled'].includes(s)) return 'enviado'
  return 'pendiente'
}

export async function POST(req: NextRequest) {
  try {
    // Twilio envía application/x-www-form-urlencoded por defecto
    const ct = req.headers.get('content-type') || ''
    let params: Record<string, string> = {}

    if (ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      form.forEach((v, k) => { params[k] = typeof v === 'string' ? v : '' })
    } else {
      // Por si configuraste JSON en Twilio o llega desde tests
      const json = await req.json().catch(() => ({}))
      for (const k of Object.keys(json)) params[k] = String((json as any)[k] ?? '')
    }

    // Verificación de firma (opcional)
    if (VERIFY_SIG) {
      if (!AUTH_TOKEN) {
        return NextResponse.json({ error: 'Falta TWILIO_AUTH_TOKEN' }, { status: 500 })
      }
      const signature = req.headers.get('x-twilio-signature') || ''
      const url = req.nextUrl.href // URL completa que Twilio llamó
      const valid = twilio.validateRequest(AUTH_TOKEN, signature, url, params)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 403 })
    }

    const sid =
      params['MessageSid'] ||
      params['SmsMessageSid'] ||
      params['MessageSid[]'] || // por si llega raro
      ''
    const status = params['MessageStatus'] || params['SmsStatus'] || ''
    const errorCode = params['ErrorCode'] || ''

    if (!sid) return NextResponse.json({ error: 'MessageSid ausente' }, { status: 400 })

    // Actualizar tu log principal
    const { error: upErr } = await supabaseAdmin
      .from('mensajes_chofer')
      .update({
        estado: mapEstado(status),
        status_detalle: status || null,
        error_detalle: errorCode || null,
        updated_at: new Date().toISOString(),
      })
      .eq('proveedor_msg_id', sid)

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    // (Opcional) Guardar payload crudo para trazabilidad si tenés esta tabla
    // CREATE TABLE twilio_callbacks (id bigserial primary key, message_sid text, status text, to text, from text, payload jsonb, created_at timestamptz default now());
    try {
      await supabaseAdmin.from('twilio_callbacks').insert({
        message_sid: sid,
        status: status || null,
        to: params['To'] || null,
        from: params['From'] || null,
        payload: params,
      })
    } catch { /* opcional, ignorar si no existe la tabla */ }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
