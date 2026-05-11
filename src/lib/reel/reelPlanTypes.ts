/**
 * Contrato de `route_attempts.reel_plan_json` (v1).
 * Pensado para: preview en cliente + futuro worker FFmpeg / Remotion.
 */

export type ReelClipSegmentV1 = {
  type: 'clip'
  id: string
  label: string
  /** Segundo en el vídeo fuente (archivo subido). */
  srcStartSec: number
  srcEndSec: number
  /** 1 = tiempo real; 0.45 ≈ slow-motion ligero */
  playbackRate: number
}

export type ReelPlanSource = 'gps_heuristic' | 'ai'

export type ReelPlanV1 = {
  version: 1
  generatedAt: string
  videoSourceUrl: string
  /**
   * Origen del plan. La UI de música avanzada (YouTube, presets, URL) solo se muestra con `ai`.
   * La heurística GPS (`gps_heuristic`) deja solo vídeo + «Reproducir reel».
   */
  planSource?: ReelPlanSource
  /** Suma de duraciones de reproducción (s), aprox. */
  totalPlaybackEstimateSec: number
  segments: ReelClipSegmentV1[]
  /** URL directa a MP3/AAC, o enlace `youtube.com/watch?v=…` / `youtu.be/…` para preview con embed / API. */
  backgroundMusicUrl?: string
  /** Texto legal / créditos (p. ej. Incompetech). */
  backgroundMusicAttribution?: string
  /** Notas para debugging / futura IA */
  notes?: string[]
}

export function isReelPlanV1(x: unknown): x is ReelPlanV1 {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    o.version === 1 &&
    typeof o.generatedAt === 'string' &&
    typeof o.videoSourceUrl === 'string' &&
    typeof o.totalPlaybackEstimateSec === 'number' &&
    Array.isArray(o.segments)
  )
}
