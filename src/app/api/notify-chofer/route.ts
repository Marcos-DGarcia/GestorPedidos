import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import twilio from 'twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

export async function POST(req: NextRequest) {
  try {
    const { viajeId, choferId, canal = 'whatsapp', mensaje: msgManual, archivo_url } = await req.json()

    if (!viajeId || !choferId) {
      return NextResponse.json({ error: 'viajeId y choferId son obligatorios' }, { status: 400 })
    }

    // 1) Teléfono del chofer
    const { data: chofer, error: chErr } = await supabaseAdmin
      .from('choferes')
      .select('telefono, nombre')
      .eq('id', choferId)
      .single()
    if (chErr || !chofer?.telefono) {
      return NextResponse.json({ error: 'No se encontró teléfono del chofer' }, { status: 404 })
    }

    // 2) Asegurar token/link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    const res = await fetch(`${baseUrl}/api/viajes/${viajeId}/ensure-link?choferId=${choferId}`, { method: 'POST' })
    const { token } = await res.json()
    if (!token) return NextResponse.json({ error: 'No se pudo crear/obtener link del chofer' }, { status: 500 })

    const linkChofer = `${baseUrl}/chofer/${token}`

    // 3) Construir mensaje (si no viene uno manual)
    //    Acá podés personalizar “tareas del día” según tus entregas/descripcion
    let mensaje = msgManual
    if (!mensaje) {
      // Traer breve resumen de entregas (opcional)
      const { data: entregas } = await supabaseAdmin
        .from('viajes_entregas')
        .select('id, subcliente, remito, estado')
        .eq('viaje_id', viajeId)
        .order('orden', { ascending: true })
        .limit(5)
      const primeras = (entregas || []).map((e, i) => `• ${e.subcliente || 'Entrega'} ${e.remito ? `(#${e.remito})` : ''}`).join('\n')
      mensaje =
`Hola ${chofer?.nombre || ''} 👋
Tenés asignado un viaje con estas paradas:
${primeras || '• Ver detalle en el link'}
Marcá cada entrega como ENTREGADA o FALLIDA desde:
${linkChofer}`
    }

    // 4) Crear registro preliminar (pendiente)
    const { data: prelim, error: insErr } = await supabaseAdmin
      .from('mensajes_chofer')
      .insert({
        viaje_id: viajeId,
        chofer_id: choferId,
        telefono: chofer.telefono,
        canal,
        mensaje,
        archivo_url,
        estado: 'pendiente'
      })
      .select('id')
      .single()
    if (insErr) throw insErr

    // 5) Twilio payload
    const to = canal === 'whatsapp' ? `whatsapp:${chofer.telefono}` : chofer.telefono
    const from = canal === 'whatsapp' ? process.env.TWILIO_WHATSAPP_FROM! : process.env.TWILIO_SMS_FROM!
    const statusCallback = (baseUrl && !baseUrl.includes('localhost'))
      ? `${baseUrl}/api/webhooks/twilio-status`
      : undefined

    const payload: any = { to, from, body: mensaje }
    if (statusCallback) payload.statusCallback = statusCallback
    if (archivo_url) payload.mediaUrl = [archivo_url]

    const result = await twilioClient.messages.create(payload)

    await supabaseAdmin
      .from('mensajes_chofer')
      .update({ proveedor_msg_id: result.sid, estado: 'enviado', updated_at: new Date().toISOString() })
      .eq('id', prelim.id)

    return NextResponse.json({ ok: true, id: prelim.id, sid: result.sid, link: linkChofer })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
