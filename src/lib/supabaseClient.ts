import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Evitar múltiples instancias durante HMR en el navegador
const globalForSupabase = globalThis as unknown as { __supabase?: ReturnType<typeof createClient> }

export const supabase =
  globalForSupabase.__supabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })

if (!globalForSupabase.__supabase) {
  globalForSupabase.__supabase = supabase
}
