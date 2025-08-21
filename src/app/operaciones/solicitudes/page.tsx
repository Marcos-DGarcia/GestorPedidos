'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Solicitud = {
  id: string
  fecha_necesaria: string
  descripcion: string
  tipo: 'punto_a_punto' | 'reparto'
  estado: string
  cliente_id: string
  archivo_adjunto: string | null
}

const asId = (v: unknown) => String(v ?? '')

export default function MisSolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchSolicitudes = async () => {
    setLoading(true)
    setErrorMsg(null)

    // 1) Usuario actual → id normalizado
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr) {
      setErrorMsg('No se pudo obtener el usuario.')
      setSolicitudes([])
      setLoading(false)
      return
    }
    const usuarioId = asId(userRes?.user?.id) // <- string seguro

    // 2) Query en pasos (nada de select('*'))
    let q = supabase
      .from('solicitudes')
      .select('id, fecha_necesaria, descripcion, tipo, estado, cliente_id, archivo_adjunto')

    if (usuarioId) q = q.eq('cliente_id', usuarioId)
    q = q.order('fecha_necesaria', { ascending: false })

    const { data, error } = await q
    if (error) {
      setErrorMsg('Error al cargar solicitudes.')
      setSolicitudes([])
      setLoading(false)
      return
    }

    // 3) Normalizar filas
    const rows = (data ?? []) as Array<{
      id: unknown; fecha_necesaria?: unknown; descripcion?: unknown; tipo?: unknown;
      estado?: unknown; cliente_id: unknown; archivo_adjunto?: unknown
    }>

    const safe: Solicitud[] = rows.map(r => {
      const tipoRaw = String(r.tipo ?? 'punto_a_punto')
      const tipo: 'punto_a_punto' | 'reparto' = tipoRaw === 'reparto' ? 'reparto' : 'punto_a_punto'
      return {
        id: asId(r.id),
        fecha_necesaria: String(r.fecha_necesaria ?? ''),
        descripcion: String(r.descripcion ?? ''),
        tipo,
        estado: String(r.estado ?? ''),
        cliente_id: asId(r.cliente_id),
        archivo_adjunto: r.archivo_adjunto ? String(r.archivo_adjunto) : null,
      }
    }).filter(s => s.id)

    setSolicitudes(safe)
    setLoading(false)
  }

  useEffect(() => { fetchSolicitudes() }, [])

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Mis solicitudes</h1>
        <Link href="/operaciones/solicitudes/nueva"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + Nueva solicitud
        </Link>
      </div>

      {loading && <p>Cargando…</p>}
      {errorMsg && <p className="text-red-600">{errorMsg}</p>}

      {!loading && !errorMsg && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Fecha</th>
              <th className="border p-2">Descripción</th>
              <th className="border p-2">Tipo</th>
              <th className="border p-2">Estado</th>
              <th className="border p-2">Archivo</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.id}>
                <td className="border p-2">{s.fecha_necesaria}</td>
                <td className="border p-2">{s.descripcion}</td>
                <td className="border p-2">{s.tipo}</td>
                <td className="border p-2 capitalize">{s.estado}</td>
                <td className="border p-2 text-center">
                  {s.archivo_adjunto ? (
                    <a href={s.archivo_adjunto} target="_blank" rel="noopener noreferrer"
                       className="inline-block bg-gray-100 px-2 py-1 rounded text-blue-700 hover:underline">
                      📎 Ver archivo
                    </a>
                  ) : <span className="text-gray-500 italic">Sin archivo</span>}
                </td>
              </tr>
            ))}
            {solicitudes.length === 0 && (
              <tr>
                <td colSpan={5} className="border p-4 text-center text-gray-500 italic">
                  No hay solicitudes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
