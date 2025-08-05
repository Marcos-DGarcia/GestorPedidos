import { supabase } from '@/lib/supabaseClient'

export async function getUsuarioActual() {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return null

  const user = userData.user

  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('id, nombre')
    .eq('usuario_id', user.id)
    .single()

  if (clienteError || !cliente) {
    console.error('Error al obtener cliente asociado', clienteError)
    return null
  }

  return {
    id: cliente.id,
    rol: user.user_metadata?.rol || 'cliente',
    nombre: cliente.nombre
  }
}