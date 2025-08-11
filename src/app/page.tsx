'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  const [status, setStatus] = useState('Cargando...')

  useEffect(() => {
    const testConnection = async () => {
      const { error } = await supabase.auth.getSession()
      if (error) {
        console.error(error)
        setStatus('❌ Error al conectar con Supabase')
      } else {
        setStatus('')
      }
    }

    testConnection()
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
      {/* Logos */}
      <div className="flex flex-col sm:flex-row items-center gap-8 mb-10">
        <Image src="/logo-rojo.png" alt="Logo Rojo" width={400} height={400} />
      </div>

      {/* Bienvenida */}
      <h1 className="text-3xl font-bold text-center mb-4 text-gray-800">
        Bienvenido al Sistema de Gestión de Flota
      </h1>

      <p className="text-lg text-gray-600 mb-6">{status}</p>

      {/* Botón de inicio de sesión */}
      <Link href="/login">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded text-lg font-semibold shadow">
          Iniciar sesión
        </button>
      </Link>
    </main>
  )
}
