// app/api/webhooks/twilio-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import twilio from 'twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Opcional: activá verificación poniendo TWILIO_VERIFY_SIGNATURE=true
const VERIFY_SIG = (process.env.TWILIO_VERIFY_SIGNATURE || '').toLowerCase() === 'true'
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''

function mapEstado(statusRaw: string) {
  const s = (statusRaw || '').toLowerCase()

  // Estados típicos de Twilio:
  // queued, accepted, scheduled, sending, sent, delivered, undelivered, failed, read, canceled, receiving, received
  if (['failed', 'undelivered'].includes(s)) return 'fallo'
  if (['delivered', 'read', 'received'].includes(s)) return 'entregado'
  if (['sent', 'sending', 'accepted', 'queued', 'scheduled'].includes(s)) return 'enviado'
  if (['canceled', 'cancelled'].includes(s)) return 'fallo' // opcional: otro estado si preferís
  return 'pendiente'
}

export async function POST(req: NextRequest) {
  try {
    // Twilio envía application/x-www-form-urlencoded
    const form = await req.formData()

    // Construir objeto params (clave/valor) para verificación de firma
    const params: Record<string, string> = {}
    for (const [k, v] of form.entries()) {
      params[k] = typeof v === 'string' ? v : ''
    }

    // Verificación de firma (opcional pero recomendado en prod)
    if (VERIFY_SIG) {
      if (!AUTH_TOKEN) {
        return NextResponse.json({ error: 'Falta TWILIO_AUTH_TOKEN para verificar firma' }, { status: 500 })
      }
      const signature = req.headers.get('x-twilio-signature') || ''
      const url = req.nextUrl.href // URL pública del webhook
      const valid = twilio.validateRequest(AUTH_TOKEN, signature, url, params)
      if (!valid) {
        return NextResponse.json({ error: 'Firma de Twilio inválida' }, { status: 403 })
      }
    }

    const sid = String(form.get('MessageSid') || form.get('SmsMessageSid') || '')
    const status = String(form.get('MessageStatus') || form.get('SmsStatus') || '')
    const errorCode = String(form.get('ErrorCode') || '')
    // útil si querés guardar más info
    // const from = String(form.get('From') || '')
    // const to = String(form.get('To') || '')

    if (!sid) {
      return NextResponse.json({ error: 'MessageSid ausente' }, { status: 400 })
    }

    const estado = mapEstado(status)

    const { error } = await supabaseAdmin
      .from('mensajes_chofer')
      .update({
        estado,
        error_detalle: errorCode || null,
        updated_at: new Date().toISOString()
      })
      .eq('proveedor_msg_id', sid)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Twilio solo necesita 200 para no reintentar
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // No devuelvas 500 si no es necesario; Twilio reintenta. Pero si es fallo real, 500 está bien.
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
