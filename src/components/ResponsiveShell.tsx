'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Props = {
  sidebar?: React.ReactNode
  topbarTitle?: string
  children: React.ReactNode
}

export default function ResponsiveShell({ sidebar, topbarTitle = 'Panel', children }: Props) {
  const [open, setOpen] = useState(false)

  // Bloquea el scroll SOLO en cliente y SOLO en mobile cuando está abierto
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false
    if (open && isMobile) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Cerrar con ESC (solo cliente)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-white border-b px-3 py-2">
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          className="p-2 rounded-md border md:hidden"
        >
          <div className="space-y-1">
            <span className="block h-0.5 w-5 bg-gray-800" />
            <span className="block h-0.5 w-5 bg-gray-800" />
            <span className="block h-0.5 w-5 bg-gray-800" />
          </div>
        </button>
        <h1 className="font-semibold">{topbarTitle}</h1>
      </header>

      {/* Contenedor principal */}
      <div className="relative">
        {/* Overlay mobile */}
        {open && (
          <button
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 md:hidden"
          />
        )}

        {/* Sidebar */}
        <aside
          className={[
            'fixed z-40 inset-y-0 left-0 w-72 bg-white border-r shadow-sm',
            'transform transition-transform duration-200 ease-out',
            open ? 'translate-x-0' : '-translate-x-full',
            'md:static md:translate-x-0 md:shadow-none'
          ].join(' ')}
          role="navigation"
        >
          <div className="h-12 md:hidden" />
          <div className="p-3">
            {sidebar ?? (
              <nav className="space-y-1 text-sm">
                <Link className="block px-2 py-2 rounded hover:bg-gray-100" href="/operaciones">Operaciones</Link>
                <Link className="block px-2 py-2 rounded hover:bg-gray-100" href="/viajes">Viajes</Link>
                <Link className="block px-2 py-2 rounded hover:bg-gray-100" href="/choferes">Choferes</Link>
                <Link className="block px-2 py-2 rounded hover:bg-gray-100" href="/clientes">Clientes</Link>
              </nav>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="p-4 md:ml-72">
          {children}
        </main>
      </div>
    </div>
  )
}
