// components/ResponsiveShell.tsx
'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function ResponsiveShell({ children, topbarTitle='Operaciones', sidebar }: {
  children: React.ReactNode; topbarTitle?: string; sidebar?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const showSidebar = /^\/(operaciones|viajes|choferes|clientes)(\/|$)/.test(pathname || '')

  // bloquear scroll móvil cuando el menú está abierto (solo cliente)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false
    if (open && isMobile) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // si no corresponde sidebar, render simple
  if (!showSidebar) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 bg-white border-b px-3 py-2">
          <h1 className="font-semibold">{topbarTitle}</h1>
        </header>
        <main className="p-4">{children}</main>
      </div>
    )
  }

  // versión con sidebar (responsive)
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-white border-b px-3 py-2">
        <button onClick={() => setOpen(o=>!o)} className="p-2 rounded-md border md:hidden" aria-label="Toggle menu">
          <div className="space-y-1">
            <span className="block h-0.5 w-5 bg-gray-800" />
            <span className="block h-0.5 w-5 bg-gray-800" />
            <span className="block h-0.5 w-5 bg-gray-800" />
          </div>
        </button>
        <h1 className="font-semibold">{topbarTitle}</h1>
      </header>

      <div className="relative">
        {open && <button onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/30 md:hidden" aria-label="Cerrar menú" />}
        <aside className={[
            'fixed z-40 inset-y-0 left-0 w-72 bg-white border-r shadow-sm',
            'transform transition-transform duration-200 ease-out',
            open ? 'translate-x-0' : '-translate-x-full',
            'md:static md:translate-x-0 md:shadow-none'
          ].join(' ')}>
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
        <main className="p-4 md:ml-72">{children}</main>
      </div>
    </div>
  )
}
