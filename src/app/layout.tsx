import './globals.css'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      {/* meta para iPhone */}
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body className={`${inter.className} bg-slate-50 text-slate-800`}>{children}</body>
    </html>
  )
}
