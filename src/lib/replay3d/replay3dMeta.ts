/**
 * Contrato de `route_attempts.replay_3d_meta` (JSONB) actualizado por replay-service / LingBot.
 * El cliente solo lee este objeto desde Supabase; el worker debe ir poniendo `status` y mensajes.
 */

export type Replay3dPipelineStatus = 'none' | 'processing' | 'ready' | 'failed'

export type Replay3dMeta = {
  status?: string
  engine?: string
  message?: string
  requested_at?: string
  processed_at?: string
  video_url?: string
  error?: string
  result?: unknown
  native_fallback_hint?: string
}

export function parseReplay3dMeta(raw: unknown): Replay3dMeta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as Replay3dMeta
}

export function getReplay3dPipelineStatus(meta: unknown): Replay3dPipelineStatus {
  const m = parseReplay3dMeta(meta)
  const s = m?.status
  if (s === 'processing') return 'processing'
  if (s === 'ready') return 'ready'
  if (s === 'failed') return 'failed'
  return 'none'
}

export function isReplay3dProcessing(meta: unknown): boolean {
  return getReplay3dPipelineStatus(meta) === 'processing'
}

/** Texto corto para UI (español). */
export function replay3dStatusLabel(status: Replay3dPipelineStatus): string {
  switch (status) {
    case 'processing':
      return 'Procesando (servidor / LingBot-Map)…'
    case 'ready':
      return 'Procesamiento listo'
    case 'failed':
      return 'Error en el procesamiento'
    default:
      return 'Sin procesar en servidor'
  }
}

/** Mensaje opcional del worker (`message` o `error`). */
export function replay3dUserFacingDetail(meta: unknown): string | null {
  const m = parseReplay3dMeta(meta)
  if (!m) return null
  if (typeof m.error === 'string' && m.error.trim()) return m.error.trim()
  if (typeof m.message === 'string' && m.message.trim()) return m.message.trim()
  return null
}
