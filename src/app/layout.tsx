// app/(dashboard)/layout.tsx
import type { ReactNode } from 'react'
import ResponsiveShell from '@/components/ResponsiveShell'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <ResponsiveShell topbarTitle="Operaciones">{children}</ResponsiveShell>
}
