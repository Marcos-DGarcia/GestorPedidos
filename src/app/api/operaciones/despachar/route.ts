// app/api/operaciones/despachar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import twilio from 'twilio'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helpers
const asStr = (v: unknown) => String(v ?? '').trim()
const isE164 = (s: string) => /^\+?[1-9]\d{6,14}$/.test(s)

export async function POST(req: NextRequest) {
  let parsedBody: any = null

  try {
    // 0) Body
    parsedBody = await req.json().catch(() => ({}))
    const viajeId = asStr(parsedBody?.viajeId)
    const canal: 'whatsapp' | 'sms' = parsedBody?.canal === 'sms' ? 'sms' : 'whatsapp'
    const customMsg: string | undefined = parsedBody?.mensaje
    const mediaUrl: string | undefined = parsedBody?.archivo_url
    const dryRun: boolean = !!parsedBody?.dryRun

    if (!viajeId) {
      return NextResponse.json({ ok: false, error: 'viajeId requerido' }, { status: 400 })
    }

    // 1) Base pública fija
    const base = asStr(process.env.NEXT_PUBLIC_BASE_URL)
    if (!base) {
      return NextResponse.json({ ok: false, error: 'NEXT_PUBLIC_BASE_URL no configurado' }, { status: 500 })
    }

    // 2) Chofer asignado al viaje
    const { data: asign, error: asignErr } = await supabaseAdmin
      .from('vehiculos_asignados')
      .select('chofer_id')
      .eq('viaje_id', viajeId)
      .maybeSingle()

    if (asignErr) return NextResponse.json({ ok: false, error: `DB vehiculos_asignados: ${asignErr.message}` }, { status: 500 })
    if (!asign?.chofer_id) return NextResponse.json({ ok: false, error: 'No hay chofer asignado al viaje' }, { status: 404 })

    const { data: chofer, error: choferErr } = await supabaseAdmin
      .from('choferes')
      .select('telefono, nombre')
      .eq('id', asign.chofer_id)
      .maybeSingle()

    if (choferErr) return NextResponse.json({ ok: false, error: `DB choferes: ${choferErr.message}` }, { status: 500 })
    if (!chofer?.telefono) return NextResponse.json({ ok: false, error: 'No se encontró teléfono del chofer' }, { status: 404 })

    // 3) Asegurar link del chofer
    let token: string | null = null
    {
      const { data: linkRow, error: linkErr } = await supabaseAdmin
        .from('viajes_links')
        .select('token')
        .eq('viaje_id', viajeId)
        .maybeSingle()
      if (linkErr) return NextResponse.json({ ok: false, error: `DB viajes_links (select): ${linkErr.message}` }, { status: 500 })

      if (linkRow?.token) {
        token = linkRow.token
      } else {
        token = crypto.randomBytes(16).toString('hex')
        const { error: insErr } = await supabaseAdmin
          .from('viajes_links')
          .insert({ viaje_id: viajeId, token })
        if (insErr) return NextResponse.json({ ok: false, error: `DB viajes_links (insert): ${insErr.message}` }, { status: 500 })
      }
    }

    const portalUrl = `${base}/chofer/${token}`

    // 4) Log preliminar
    const texto = customMsg || `Tenés un viaje asignado (ID: ${viajeId}). Ingresá para marcar entregas: ${portalUrl}`

    const { data: prelim, error: logErr } = await supabaseAdmin
      .from('mensajes_chofer')
      .insert({
        viaje_id: viajeId,
        chofer_id: asign.chofer_id,
        telefono: chofer.telefono,
        canal,
        mensaje: texto,
        archivo_url: mediaUrl ?? null,
        estado: dryRun ? 'simulado' : 'pendiente',
      })
      .select('id')
      .maybeSingle()

    if (logErr) return NextResponse.json({ ok: false, error: `DB mensajes_chofer (insert): ${logErr.message}` }, { status: 500 })

    // 5) Si solo queremos la URL (sin enviar), devolver y salir
    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, portalUrl, preview: texto })
    }

    // 6) Twilio
    const ACC_SID = asStr(process.env.TWILIO_ACCOUNT_SID)
    const AUTH_TOKEN = asStr(process.env.TWILIO_AUTH_TOKEN)
    if (!ACC_SID || !AUTH_TOKEN) {
      return NextResponse.json({ ok: false, error: 'Faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN' }, { status: 500 })
    }
    const client = twilio(ACC_SID, AUTH_TOKEN)

    // Teléfono destino
    const dest = asStr(chofer.telefono)
    if (!isE164(dest)) {
      return NextResponse.json({ ok: false, error: 'Teléfono del chofer inválido (usar formato E.164, ej: +54911...)' }, { status: 400 })
    }
    const to = canal === 'whatsapp' ? (dest.startsWith('whatsapp:') ? dest : `whatsapp:${dest}`) : dest

    // Mensajería: messaging service o from
    const params: any = { to, body: texto }
    if (!base.includes('localhost')) {
      params.statusCallback = `${base}/api/webhooks/twilio-status`
    }
    if (mediaUrl) params.mediaUrl = [mediaUrl]

    const MSG_SVC = asStr(process.env.TWILIO_MESSAGING_SERVICE_SID)
    if (MSG_SVC) {
      params.messagingServiceSid = MSG_SVC
    } else {
      if (canal === 'whatsapp') {
        const FROM = asStr(process.env.TWILIO_WHATSAPP_FROM) // 'whatsapp:+14155238886' o tu WABA
        if (!FROM) return NextResponse.json({ ok: false, error: 'Falta TWILIO_WHATSAPP_FROM' }, { status: 500 })
        params.from = FROM
      } else {
        const FROM = asStr(process.env.TWILIO_SMS_FROM)
        if (!FROM) return NextResponse.json({ ok: false, error: 'Falta TWILIO_SMS_FROM' }, { status: 500 })
        params.from = FROM
      }
    }

    const tw = await client.messages.create(params)

    // 7) Actualizar log + estado del viaje
    await supabaseAdmin
      .from('mensajes_chofer')
      .update({ proveedor_msg_id: tw.sid, estado: 'enviado', updated_at: new Date().toISOString() })
      .eq('id', prelim?.id)

    await supabaseAdmin.from('viajes').update({ estado: 'en_progreso' }).eq('id', viajeId)

    return NextResponse.json({ ok: true, sid: tw.sid, portalUrl })
  } catch (e: any) {
    // log de fallo si se pudo parsear el body
    try {
      if (parsedBody?.viajeId) {
        await supabaseAdmin.from('mensajes_chofer').insert({
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

    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
