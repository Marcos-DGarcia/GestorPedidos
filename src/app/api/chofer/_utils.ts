// app/api/chofer/_utils.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type LinkInfo = {
  link_id: string
  viaje_id: string
  chofer_id: string | null
  expires_at: string | null
}

export async function resolveLink(token: string): Promise<LinkInfo | null> {
  const { data, error } = await supabaseAdmin
    .from('viajes_links')
    .select('id, viaje_id, chofer_id, expires_at')
    .eq('token', token)
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  return {
    link_id: String(data.id),
    viaje_id: String(data.viaje_id),
    chofer_id: data.chofer_id ? String(data.chofer_id) : null,
    // si viene Date, lo pasamos a ISO string; si es string, lo dejamos
    expires_at:
      (data as any).expires_at
        ? typeof (data as any).expires_at === 'string'
          ? (data as any).expires_at
          : new Date((data as any).expires_at).toISOString()
        : null,
  }
}

export function isExpired(expires_at: string | null) {
  if (!expires_at) return false
  const ts = Date.parse(expires_at)
  if (Number.isNaN(ts)) return false // no rompas por fechas inválidas
  return ts < Date.now()
}
