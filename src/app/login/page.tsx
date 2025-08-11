'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (loginError || !data.session?.user?.id) {
      setError('❌ Login fallido. Verificá el correo y la contraseña.')
      return
    }

    const userId = data.session.user.id

    const { data: usuarioData, error: usuarioError } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', userId)
      .single()

    if (usuarioError || !usuarioData) {
      setError('❌ No se encontró el usuario en la base de datos.')
      return
    }

    const rol = usuarioData.rol

    if (rol === 'cliente') {
      router.push('/solicitudes')
    } else if (rol === 'oficina') {
      router.push('/operaciones/solicitudes')
    } else if (rol === 'administrador') {
      router.push('/admin')
    } else {
      setError('⚠️ Rol desconocido. Contacte al administrador.')
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
      {/* Logos arriba */}
      <div className="flex flex-col sm:flex-row items-center gap-8 mb-8">
        <Image src="/logo-rojo.png" alt="Logo Rojo" width={320} height={320} />

      </div>

      {/* Formulario */}
      <div className="w-full max-w-md bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Iniciar Sesión</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 border rounded text-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            className="w-full p-2 border rounded text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
          >
            Ingresar
          </button>
        </form>
      </div>
    </main>
  )
}
