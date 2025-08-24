'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/utils/utils'

const navItems = [
  { label: 'Solicitudes',   href: '/operaciones/solicitudes' },
  { label: 'Viajes',        href: '/operaciones/viajes' },
  { label: 'Vehículos',     href: '/operaciones/vehiculos' },
  { label: 'Choferes',      href: '/operaciones/choferes' },
  { label: 'Clientes',      href: '/operaciones/clientes' },
  { label: 'Planificacion', href: '/operaciones/planificacion' },
  { label: 'Mantenimiento', href: '/operaciones/mantenimientos' },
]

// Alto del header fijo
const HEADER_H = 48 // px

export default function OperacionesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // Visibilidad del sidebar (mobile y desktop)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Al montar: abierto en desktop, cerrado en mobile
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 768px)')
    setSidebarOpen(mq.matches)
    const onChange = () => setSidebarOpen(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  // Cerrar al navegar (solo mobile)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.innerWidth < 768) setSidebarOpen(false)
  }, [pathname])

  // Bloquear scroll detrás cuando está abierto en mobile
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    const prev = document.body.style.overflow
    const isMobile = window.innerWidth < 768
    if (sidebarOpen && isMobile) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [sidebarOpen])

  const toggleSidebar = () => setSidebarOpen(v => !v)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* HEADER fijo */}
      <header
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-between bg-blue-600 text-white px-3 shadow"
          style={{ height: HEADER_H }}
        >

        <div className="flex items-center gap-2">
          {/* Botón mobile */}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded border md:hidden"
            aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <div className="space-y-1">
              <span className="block h-0.5 w-5 bg-black" />
              <span className="block h-0.5 w-5 bg-black" />
              <span className="block h-0.5 w-5 bg-black" />
            </div>
          </button>
          <h1 className="text-base font-semibold">Operaciones</h1>
        </div>

        {/* Botón desktop para ocultar/mostrar */}
        <button
          onClick={toggleSidebar}
          className="hidden md:inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded border hover:bg-gray-50"
          aria-label={sidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}
          title={sidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}
        >
          {sidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}
        </button>
      </header>

      {/* OVERLAY (solo mobile cuando está abierto) */}
      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          aria-label="Cerrar menú"
        />
      )}

      {/* SIDEBAR fijo, alineado bajo el header */}
      <Sidebar open={sidebarOpen} headerH={HEADER_H} />

      {/* CONTENIDO: compensar header y, si sidebar está visible en desktop, margen izquierdo */}
<main
  className={cn(
    'transition-[margin] duration-200',
    sidebarOpen ? 'md:ml-64' : 'md:ml-0'
  )}
  style={{ paddingTop: HEADER_H }}
>
  {/* contenedor fluido para las páginas */}
  <div className="mx-auto max-w-7xl px-4 py-6">
    {children}
  </div>
</main>

    </div>
  )
}

function Sidebar({ open, headerH }: { open: boolean; headerH: number }) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'fixed left-0 z-50 w-64 bg-slate-900 text-slate-100 p-4 space-y-6 border-r border-black/10 shadow-lg',
        'transform transition-transform duration-200 ease-out',
        open ? 'translate-x-0' : '-translate-x-full',
        // En desktop, que quede fuera si está oculto
        'md:will-change-[transform]'
      )}
      style={{ top: headerH, bottom: 0 }}
      role="navigation"
      aria-hidden={!open}
    >
      
      <nav className="space-y-1 text-sm">
        {navItems.map((item) => {
          const active = pathname?.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-md px-3 py-2 transition',
                active
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-200 hover:bg-slate-800 hover:text-white'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
