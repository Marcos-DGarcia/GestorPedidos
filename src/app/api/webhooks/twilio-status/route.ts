import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import twilio from 'twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VERIFY_SIG = (process.env.TWILIO_VERIFY_SIGNATURE || '').toLowerCase() === 'true'
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''

function mapEstado(statusRaw: string) {
  const s = (statusRaw || '').toLowerCase()
  if (['failed', 'undelivered'].includes(s)) return 'fallo'
  if (['delivered', 'read', 'received'].includes(s)) return 'entregado'
  if (['sent', 'sending', 'accepted', 'queued', 'scheduled'].includes(s)) return 'enviado'
  if (['canceled', 'cancelled'].includes(s)) return 'fallo'
  return 'pendiente'
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const params: Record<string, string> = {}
    for (const [k, v] of form.entries()) params[k] = typeof v === 'string' ? v : ''

    if (VERIFY_SIG) {
      if (!AUTH_TOKEN) return NextResponse.json({ error: 'Falta TWILIO_AUTH_TOKEN' }, { status: 500 })
      const signature = req.headers.get('x-twilio-signature') || ''
      const url = req.nextUrl.href
      const valid = twilio.validateRequest(AUTH_TOKEN, signature, url, params)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 403 })
    }

    const sid = String(form.get('MessageSid') || form.get('SmsMessageSid') || '')
    const status = String(form.get('MessageStatus') || form.get('SmsStatus') || '')
    const errorCode = String(form.get('ErrorCode') || '')

    if (!sid) return NextResponse.json({ error: 'MessageSid ausente' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('mensajes_chofer')
      .update({
        estado: mapEstado(status),
        error_detalle: errorCode || null,
        updated_at: new Date().toISOString()
      })
      .eq('proveedor_msg_id', sid)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
