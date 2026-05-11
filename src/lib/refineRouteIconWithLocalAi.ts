'use client'

import { createClient } from '@/core/infrastructure/supabase/client'
import { pickRouteThemedIconKeyWithLocalLlm } from '@/lib/localAiCoach'

/** Tras crear/editar ruta: si hay WebLLM, persiste una clave de ícono más acorde al texto. */
export async function tryPersistRouteIconFromLocalAi(input: {
  routeId: string
  name: string
  description?: string
  difficulty: string
}): Promise<void> {
  const key = await pickRouteThemedIconKeyWithLocalLlm({
    name: input.name,
    description: input.description,
    difficulty: input.difficulty,
  })
  if (!key) return
  const supabase = createClient()
  const { error } = await supabase
    .from('routes')
    .update({ icon_symbol_key: key })
    .eq('id', input.routeId)
  if (error) console.warn('[icono ruta IA]', error.message)
}
