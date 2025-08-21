// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // 👇 NO cortar el build por errores de lint (solo muestra)
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
