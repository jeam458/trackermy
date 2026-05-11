import type { User } from '@supabase/supabase-js'
import { createClient } from '@/core/infrastructure/supabase/client'

/**
 * Usuario autenticado: primero sesión en cliente (rápido al navegar);
 * si no hay, `getUser()` valida con Auth (más lento, red).
 */
export async function getAuthUserOrNull(): Promise<User | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.user) return session.user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
}
