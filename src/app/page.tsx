'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  const [status, setStatus] = useState('Cargando...')

  useEffect(() => {
    const testConnection = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error(error)
        setStatus('❌ Error al conectar con Supabase')
      } else {
        setStatus('✅ Conexión con Supabase exitosa')
      }
    }

    testConnection()
  }, [])

  return (
    <main className="p-6 text-xl font-semibold">
    </main>
  )
}
