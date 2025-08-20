import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import twilio from 'twilio'

export const runtime = 'nodejs'      // Twilio SDK requiere Node
export const dynamic = 'force-dynamic'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

/**
 * POST /api/operaciones/despachar
 * Body:
 * {
 *   viajeId: string,                  // requerido
 *   canal?: 'whatsapp' | 'sms',       // default: 'whatsapp'
 *   mensaje?: string,                 // opcional (si no, se arma uno base)
 *   archivo_url?: string              // opcional (media)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { viajeId, canal = 'whatsapp', mensaje, archivo_url } = await req.json()

    if (!viajeId) {
      return NextResponse.json({ error: 'viajeId requerido' }, { status: 400 })
    }
    if (!['whatsapp', 'sms'].includes(canal)) {
      return NextResponse.json({ error: 'canal inválido' }, { status: 400 })
    }

    // 1) Traer la asignación (chofer_id) del viaje
    const { data: asign, error: asignErr } = await supabaseAdmin
      .from('vehiculos_asignados')
      .select('chofer_id')
      .eq('viaje_id', viajeId)
      .limit(1)
      .single()

    if (asignErr || !asign?.chofer_id) {
      return NextResponse.json({ error: 'No hay chofer asignado al viaje' }, { status: 404 })
    }

    // 2) Traer el chofer por id (teléfono y nombre)
    const { data: chofer, error: choferErr } = await supabaseAdmin
      .from('choferes')
      .select('telefono, nombre')
      .eq('id', asign.chofer_id)
      .single()

    if (choferErr || !chofer?.telefono) {
      return NextResponse.json({ error: 'No se encontró teléfono del chofer' }, { status: 404 })
    }

    // Mensaje base (si no viene custom)
    const texto = mensaje || `Tenés un viaje asignado (ID: ${viajeId}). Por favor, confirmá recepción.`

    // Crear log preliminar en mensajes_chofer (estado 'pendiente')
    const { data: prelim, error: insErr } = await supabaseAdmin
      .from('mensajes_chofer')
      .insert({
        viaje_id: viajeId,
        chofer_id: asign.chofer_id,
        telefono: chofer.telefono,
        canal,
        mensaje: texto,
        archivo_url: archivo_url || null,
        estado: 'pendiente'
      })
      .select('id')
      .single()

    if (insErr) throw insErr

    // statusCallback solo si tenemos BASE_URL pública
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    const statusCallback =
      baseUrl && !baseUrl.includes('localhost')
        ? `${baseUrl}/api/webhooks/twilio-status`
        : undefined

    // Destinatarios Twilio
    const to = canal === 'whatsapp' ? `whatsapp:${chofer.telefono}` : chofer.telefono
    const from = canal === 'whatsapp' ? process.env.TWILIO_WHATSAPP_FROM! : process.env.TWILIO_SMS_FROM!

    const payload: any = { to, from, body: texto }
    if (statusCallback) payload.statusCallback = statusCallback
    if (archivo_url) payload.mediaUrl = [archivo_url]

    // Enviar por Twilio
    const result = await twilioClient.messages.create(payload)

    // Guardar SID y marcar como 'enviado'
    await supabaseAdmin
      .from('mensajes_chofer')
      .update({
        proveedor_msg_id: result.sid,
        estado: 'enviado',
        updated_at: new Date().toISOString()
      })
      .eq('id', prelim.id)

    return NextResponse.json({ ok: true, sid: result.sid })
  } catch (e: any) {
    // Falla general: intentar dejar un log con estado 'fallo'
    try {
      const body = await req.json().catch(() => null)
      if (body?.viajeId) {
        await supabaseAdmin
          .from('mensajes_chofer')
          .insert({
            viaje_id: body.viajeId,
            chofer_id: null,
            telefono: 'desconocido',
            canal: body?.canal || 'whatsapp',
            mensaje: body?.mensaje || null,
            estado: 'fallo',
            error_detalle: String(e?.message || e),
          })
      }
    } catch { /* noop */ }

    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
