// app/api/operaciones/despachar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import twilio from 'twilio'

export const runtime = 'nodejs'      // Twilio SDK requiere Node
export const dynamic = 'force-dynamic'

// --- Helpers ---
const requireEnv = (key: string) => {
  const v = process.env[key]
  if (!v || v.length === 0) throw new Error(`Falta env ${key}`)
  return v
}
const asStr = (v: unknown) => String(v ?? '')
const toE164 = (tel: string) => {
  const t = tel.trim()
  if (!t) return ''
  if (t.startsWith('+')) return t
  return `+${t.replace(/\D/g, '')}`
}

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''
// Opcionales según tu setup
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || ''   // ej: 'whatsapp:+14155238886'
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM || ''             // ej: '+1XXXXXXXXXX'
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID || ''

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  // Lanzamos al cargar el módulo para fallar rápido si faltan credenciales
  throw new Error('Faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN')
}

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

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
  let parsedBody: any = null

  try {
    parsedBody = await req.json().catch(() => ({}))
    const viajeId = asStr(parsedBody?.viajeId)
    const canal: 'whatsapp' | 'sms' = parsedBody?.canal === 'sms' ? 'sms' : 'whatsapp'
    const customMsg: string | undefined = parsedBody?.mensaje
    const mediaUrl: string | undefined = parsedBody?.archivo_url

    if (!viajeId) {
      return NextResponse.json({ error: 'viajeId requerido' }, { status: 400 })
    }

    // 1) Traer asignación → chofer
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

    // 2) Link del portal de chofer (si existe token)
    const { data: linkRow } = await supabaseAdmin
      .from('viajes_links')
      .select('token')
      .eq('viaje_id', viajeId)
      .maybeSingle()

    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    if (!baseUrl) {
      const vercelUrl = process.env.VERCEL_URL // p.ej. myapp.vercel.app
      baseUrl = vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000'
    }
    const portalUrl = linkRow?.token ? `${baseUrl}/chofer/${linkRow.token}` : baseUrl

    // 3) Armado del mensaje
    const texto = customMsg || `Tenés un viaje asignado (ID: ${viajeId}). Link: ${portalUrl}`

    // 4) Crear log preliminar en mensajes_chofer (estado 'pendiente')
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

    // 5) Enviar por Twilio
    //   - Si usás Messaging Service, NO seteamos "from"
    //   - Si no, usamos TWILIO_WHATSAPP_FROM o TWILIO_SMS_FROM según canal
    const toE = toE164(asStr(chofer.telefono))
    const to = canal === 'whatsapp' ? `whatsapp:${toE}` : toE

    const params: any = {
      to,
      body: texto
    }

    // Callback de estado (opcional)
    const publicBase = process.env.NEXT_PUBLIC_BASE_URL || ''
    if (publicBase && !publicBase.includes('localhost')) {
      params.statusCallback = `${publicBase}/api/webhooks/twilio-status`
    }

    if (mediaUrl) params.mediaUrl = [mediaUrl]

    if (TWILIO_MESSAGING_SERVICE_SID) {
      params.messagingServiceSid = TWILIO_MESSAGING_SERVICE_SID
    } else {
      if (canal === 'whatsapp') {
        requireEnv('TWILIO_WHATSAPP_FROM') // valida que exista
        params.from = TWILIO_WHATSAPP_FROM
      } else {
        requireEnv('TWILIO_SMS_FROM')
        params.from = TWILIO_SMS_FROM
      }
    }

    const result = await twilioClient.messages.create(params)

    // 6) Guardar SID y marcar 'enviado'
    await supabaseAdmin
      .from('mensajes_chofer')
      .update({
        proveedor_msg_id: result.sid,
        estado: 'enviado',
        updated_at: new Date().toISOString()
      })
      .eq('id', prelim.id)

    // 7) Avanzar estado del viaje a EN_PROGRESO
    await supabaseAdmin.from('viajes').update({ estado: 'en_progreso' }).eq('id', viajeId)

    return NextResponse.json({ ok: true, sid: result.sid, portalUrl })
  } catch (e: any) {
    // Intentar dejar log de fallo SOLO si tenemos body parseado con viajeId
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
