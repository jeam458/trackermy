'use client'

import { useEffect } from 'react'

/**
 * Vuelve a consultar Supabase (p. ej. `load()` que refresca intentos) mientras haya
 * algún `replay_3d_meta.status === 'processing'`. Así la UI refleja cuando LingBot termina
 * sin recargar la página.
 */
export function useReplay3dMetaPolling(opts: {
  shouldPoll: boolean
  poll: () => void | Promise<void>
  intervalMs?: number
}): void {
  const { shouldPoll, poll, intervalMs = 3500 } = opts

  useEffect(() => {
    if (!shouldPoll) return
    const id = window.setInterval(() => {
      void poll()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [shouldPoll, intervalMs, poll])
}
