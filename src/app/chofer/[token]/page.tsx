// src/app/chofer/[token]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ChoferClient from '@/components/ChoferClient'

export const dynamic = 'force-dynamic'

type Entrega = {
  id: string
  orden: number | null
  subcliente: string | null
  direccion: string | null
  localidad: string | null
  provincia: string | null
  remito: string | null
  estado: 'pendiente' | 'en_progreso' | 'entregado' | 'fallido'
  observaciones: string | null
  completado_at: string | null
  entregado_at?: string | null
  fallido_at?: string | null
}

const asStr = (v: unknown) => (v == null ? null : String(v))
const asNum = (v: unknown) => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const asEstado = (v: unknown): Entrega['estado'] => {
  const s = String(v ?? '').toLowerCase()
  if (s === 'en_progreso') return 'en_progreso'
  if (s === 'entregado') return 'entregado'
  if (s === 'fallido' || s === 'no_entregado') return 'fallido'
  return 'pendiente'
}

export default function PortalChoferPage() {
  const { token } = useParams<{ token: string }>()
  const [entregas, setEntregas] = useState<Entrega[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        if (!token) throw new Error('Token inválido')
        const res = await fetch(`/api/chofer/${token}/entregas`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()

        // Normalización -> Entrega[]
        const rows = (json?.entregas ?? []) as Array<Record<string, unknown>>
        const safe: Entrega[] = rows.map((r) => ({
          id: String(r.id ?? ''),
          orden: asNum(r.orden),
          subcliente: asStr(r.subcliente),
          direccion: asStr(r.direccion),
          localidad: asStr(r.localidad),
          provincia: asStr(r.provincia),
          remito: asStr(r.remito),
          estado: asEstado((r as any).estado_entrega ?? (r as any).estado),
          observaciones: asStr((r as any).observaciones ?? (r as any).obs),
          completado_at: asStr((r as any).completado_at),
          entregado_at: asStr((r as any).entregado_at),
          fallido_at: asStr((r as any).fallido_at),
        })).filter(e => e.id)

        if (!cancelled) setEntregas(safe)
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e))
      }
    }
    run()
    return () => { cancelled = true }
  }, [token])

  if (!token) return <div className="p-6 text-red-600">Token inválido.</div>
  if (error)  return <div className="p-6 text-red-600">Error: {error}</div>
  if (entregas === null) return <div className="p-6">Cargando…</div>

  return <ChoferClient token={String(token)} initialEntregas={entregas} />
}
