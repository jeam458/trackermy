import { createClient } from '@/core/infrastructure/supabase/client'

/**
 * Llama al worker opcional `replay-service` (FastAPI) para procesar un intento.
 * Requiere `NEXT_PUBLIC_REPLAY_SERVICE_URL` (origen público, sin barra final).
 */
export async function triggerServerReplayJob(attemptId: string): Promise<{
  ok: boolean
  skipped?: boolean
  error?: string
}> {
  const base = process.env.NEXT_PUBLIC_REPLAY_SERVICE_URL?.trim().replace(/\/$/, '')
  if (!base) {
    return { ok: false, skipped: true, error: 'Servidor de replay no configurado' }
  }

  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { ok: false, error: 'Sesión requerida' }
  }

  const res = await fetch(`${base}/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ attempt_id: attemptId }),
  })

  if (!res.ok) {
    const t = await res.text()
    return { ok: false, error: t || res.statusText }
  }

  return { ok: true }
}

export function isReplayServiceConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_REPLAY_SERVICE_URL?.trim())
}
