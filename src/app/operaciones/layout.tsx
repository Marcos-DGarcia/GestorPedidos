import { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from "@/utils/utils"
 
const navItems = [
  { label: 'Solicitudes', href: '/operaciones/solicitudes' },
  { label: 'Viajes', href: '/operaciones/viajes' },
  { label: 'Vehículos', href: '/operaciones/vehiculos' },
  { label: 'Choferes', href: '/operaciones/choferes' }, // ← agregado
  { label: 'Clientes', href: '/operaciones/clientes' },
  { label: 'Planificacion', href: '/operaciones/planificacion' },
  { label: 'Mantenimiento', href: '/operaciones/mantenimientos' },
  
]

export default function OperacionesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-900 text-white p-4 space-y-4">
        <h2 className="text-xl font-bold mb-6">Panel Operativo</h2>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block px-3 py-2 rounded hover:bg-gray-800 transition-colors'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 bg-gray-100 p-6 overflow-auto">{children}</main>
    </div>
  )
}
