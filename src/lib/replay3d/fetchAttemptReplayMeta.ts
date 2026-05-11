import { createClient } from '@/core/infrastructure/supabase/client'

/** Una lectura puntual de `replay_3d_meta` (mismo origen que usa el polling en la UI). */
export async function fetchAttemptReplay3dMeta(attemptId: string): Promise<unknown | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('route_attempts')
    .select('replay_3d_meta')
    .eq('id', attemptId)
    .maybeSingle()

  if (error) {
    console.warn('fetchAttemptReplay3dMeta:', error.message)
    return null
  }
  return data?.replay_3d_meta ?? null
}
