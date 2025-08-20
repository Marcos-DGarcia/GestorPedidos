import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const mapEstado = (status: string) => {
  const s = (status || '').toLowerCase()
  if (['failed', 'undelivered'].includes(s)) return 'fallo'
  if (['delivered', 'read'].includes(s)) return 'entregado'
  if (['sent'].includes(s)) return 'enviado'
  return 'pendiente'
}

export async function POST(req: NextRequest) {
  const form = await req.formData() // Twilio: x-www-form-urlencoded
  const sid = String(form.get('MessageSid') || '')
  const status = String(form.get('MessageStatus') || form.get('SmsStatus') || '')
  const errorCode = String(form.get('ErrorCode') || '')

  if (!sid) return NextResponse.json({ error: 'MessageSid ausente' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('mensajes_chofer')
    .update({ estado: mapEstado(status), error_detalle: errorCode || null, updated_at: new Date().toISOString() })
    .eq('proveedor_msg_id', sid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
