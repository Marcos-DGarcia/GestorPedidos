// app/operaciones/pendientes/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'

type PendienteDetalle = {
  id: string
  orden: number | null
  subcliente: string | null
  direccion: string | null
  localidad: string | null
  provincia: string | null
  remito: string | null
}

type CompletadaDetalle = {
  id: string
  estado: 'entregado' | 'completado' | 'fallido'
  orden: number | null
  subcliente: string | null
  remito: string | null
  completado_at: string | null
}

type Item = {
  viaje_id: string
  fecha_programar: string | null
  estado_viaje: string | null
  cliente: string | null
  solicitud_desc: string | null
  vehiculo_id: string | null
  patente: string | null
  tipo_vehiculo: string | null
  chofer_id: string | null
  chofer: string | null
  telefono_chofer: string | null
  total: number
  pendientes: number
  completadas: number
  fallidas: number
  pendientes_detalle: PendienteDetalle[]
  completadas_detalle?: CompletadaDetalle[]
}

export default function PendientesFlotaPage() {
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [q, setQ] = useState('') // búsqueda local opcional
  const [soloEnProgreso, setSoloEnProgreso] = useState(true)
  const [mostrarCompletadas, setMostrarCompletadas] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Item[]>([])

  const [patente, setPatente] = useState('')            // NUEVO: filtro que viaja a la API
  const [apiError, setApiError] = useState<string|null>(null) // NUEVO: mostrar errores de API

  const buildUrl = () => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    if (soloEnProgreso) {
      params.set('estado', 'en_progreso')
    } else {
      params.set('estado', 'programado,en_progreso,realizado')
    }

    if (mostrarCompletadas) params.set('includeCompleted', '1')

    if (patente.trim()) params.set('patente', patente.trim()) // NUEVO: mandar patente al backend

    const qs = params.toString()
    return `/api/operaciones/pendientes${qs ? `?${qs}` : ''}`
  }

  const fetchData = async () => {
    setLoading(true)
    setApiError(null) // NUEVO
    const url = buildUrl()
    const res = await fetch(url, { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok) {
      setItems([])
      setApiError(json?.error ?? 'Error consultando API') // NUEVO
    } else {
      setItems(json?.items ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return items
    return items.filter((it) =>
      (it.patente ?? '').toLowerCase().includes(needle) ||
      (it.chofer ?? '').toLowerCase().includes(needle) ||
      (it.cliente ?? '').toLowerCase().includes(needle) ||
      (it.tipo_vehiculo ?? '').toLowerCase().includes(needle)
    )
  }, [q, items])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Seguimiento de entregas por vehículo</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col">
          <label className="text-sm">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={soloEnProgreso}
            onChange={(e) => setSoloEnProgreso(e.target.checked)}
          />
          Solo en progreso
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mostrarCompletadas}
            onChange={(e) => setMostrarCompletadas(e.target.checked)}
          />
          Mostrar detalle de completadas
        </label>

        <button
          onClick={fetchData}
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Cargando…' : 'Aplicar filtros'}
        </button>

        <div className="flex-1" />

        {/* NUEVO: filtro que va al backend */}
        <input
          placeholder="Filtrar por patente (API)…"
          value={patente}
          onChange={(e) => setPatente(e.target.value)}
          className="border rounded px-3 py-2 w-64"
        />

        {/* Búsqueda local opcional (no viaja a API) */}
        <input
          placeholder="Buscar en la lista (chofer/cliente/tipo)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border rounded px-3 py-2 w-80"
        />
      </div>

      {apiError && ( // NUEVO
        <div className="text-sm text-red-600">{apiError}</div>
      )}

      <div className="grid gap-4">
        {filtered.map((v) => {
          const terminadas = v.completadas + v.fallidas
          const progreso = v.total ? Math.round(((terminadas) / v.total) * 100) : 0

          return (
            <div key={v.viaje_id} className="rounded-2xl border p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="space-y-1">
                  <div className="text-lg font-medium">
                    {v.tipo_vehiculo ?? 'Vehículo'} – {v.patente ?? 'S/PAT'}
                  </div>
                  <div className="text-sm text-gray-600">
                    Chofer: <b>{v.chofer ?? 'Sin asignar'}</b>{' '}
                    {v.telefono_chofer ? `(${v.telefono_chofer})` : ''}
                    {' • '}Cliente: <b>{v.cliente ?? '—'}</b>
                    {' • '}Viaje: <b>{v.viaje_id.slice(0, 8)}</b>
                    {v.fecha_programar ? ` • Fecha: ${v.fecha_programar}` : ''}
                    {v.estado_viaje ? ` • Estado: ${v.estado_viaje}` : ''}
                  </div>
                </div>

                <div className="flex gap-2">
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">Total: {v.total}</span>
                  <span className="text-xs bg-yellow-100 px-2 py-1 rounded">Pendientes: {v.pendientes}</span>
                  <span className="text-xs bg-green-100 px-2 py-1 rounded">Completadas: {v.completadas}</span>
                  <span className="text-xs bg-red-100 px-2 py-1 rounded">Fallidas: {v.fallidas}</span>
                </div>
              </div>

              <div className="mt-3 h-2 w-full bg-gray-100 rounded">
                <div
                  className="h-2 bg-green-500 rounded"
                  style={{ width: `${progreso}%` }}
                  title={`${progreso}%`}
                />
              </div>

              {/* Detalle de pendientes */}
              {v.pendientes_detalle.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-semibold mb-1">Pendientes:</div>
                  <div className="grid gap-2">
                    {v.pendientes_detalle.map((p) => (
                      <div key={p.id} className="text-sm border rounded p-2">
                        <div className="flex flex-wrap gap-2 justify-between">
                          <div>
                            <b>#{p.orden ?? '-'}</b>{' '}
                            {p.subcliente ? `· ${p.subcliente}` : ''}{' '}
                            {p.remito ? `· Remito: ${p.remito}` : ''}
                          </div>
                          <div className="text-gray-600">
                            {p.direccion ? `${p.direccion}, ` : ''}
                            {p.localidad ?? ''}{p.provincia ? `, ${p.provincia}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detalle de completadas/fallidas (opcional) */}
              {mostrarCompletadas && v.completadas_detalle && v.completadas_detalle.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-semibold mb-1">Completadas / Fallidas:</div>
                  <div className="grid gap-2">
                    {v.completadas_detalle.map((c) => (
                      <div key={c.id} className="text-sm border rounded p-2">
                        <div className="flex flex-wrap gap-2 justify-between">
                          <div>
                            <b>#{c.orden ?? '-'}</b>{' '}
                            {c.subcliente ? `· ${c.subcliente}` : ''}{' '}
                            {c.remito ? `· Remito: ${c.remito}` : ''}
                          </div>
                          <div className="text-gray-600">
                            Estado: <b>{c.estado}</b>{' '}
                            {c.completado_at ? `• ${new Date(c.completado_at).toLocaleString()}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {!loading && filtered.length === 0 && (
          <div className="text-gray-500">Sin resultados para los filtros actuales.</div>
        )}
      </div>
    </div>
  )
}
