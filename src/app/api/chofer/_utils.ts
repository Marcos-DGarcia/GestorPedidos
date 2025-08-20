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
    link_id: data.id,
    viaje_id: data.viaje_id,
    chofer_id: data.chofer_id,
    expires_at: data.expires_at
  }
}

export function isExpired(expires_at: string | null) {
  if (!expires_at) return false
  return new Date(expires_at).getTime() < Date.now()
}
