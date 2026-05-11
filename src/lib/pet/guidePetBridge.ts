/**
 * Puente global pet ↔ guía / MCP / WebLLM.
 * Estado en Zustand (vanilla) para que cualquier capa (LLM, UI, futuros hooks) comparta gesto y “thinking”.
 * El atlas PNG (`GuardDhPetAtlas`) sigue siendo el rostro; `GuidePetMood` se mapea a `PetEmotion`.
 */
import { useStore } from 'zustand/react'
import { createStore } from 'zustand/vanilla'
import type { GuideAttemptSummary } from '@/lib/guide-ai/types'
import type { GuideMcpObservation } from '@/lib/guide-ai/guideMcpClient'
import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import type { RiderGuideMood } from '@/lib/riderGuide'

export type GuidePetMood = 'neutral' | 'happy' | 'analyzing' | 'warning' | 'stoked'

export type GuidePetBridgeSnapshot = {
  /** Si es null, el pet usa solo navegación / `RiderGuideMood` como hasta ahora. */
  petMood: GuidePetMood | null
  message: string
  isThinking: boolean
  updatedAt: number
}

const PET_MOODS: GuidePetMood[] = ['neutral', 'happy', 'analyzing', 'warning', 'stoked']

/** Store compartido (suscribite con `subscribeGuidePetBridge` o `guidePetStore.subscribe`). */
export const guidePetStore = createStore<GuidePetBridgeSnapshot>(() => ({
  petMood: null,
  message: '',
  isThinking: false,
  updatedAt: 0,
}))

export function getGuidePetBridgeSnapshot(): GuidePetBridgeSnapshot {
  return guidePetStore.getState()
}

export function subscribeGuidePetBridge(listener: () => void): () => void {
  return guidePetStore.subscribe(listener)
}

/** Hook React (`zustand/react`) sobre el mismo store que `subscribeGuidePetBridge`. */
export function useGuidePetStore<T>(selector: (s: GuidePetBridgeSnapshot) => T): T {
  return useStore(guidePetStore, selector)
}

export function publishGuidePetThinking(isThinking: boolean) {
  guidePetStore.setState({ isThinking, updatedAt: Date.now() })
}

export function publishGuidePetMood(partial: { petMood: GuidePetMood | null; message?: string }) {
  guidePetStore.setState((s) => ({
    petMood: partial.petMood,
    message: partial.message ?? s.message,
    updatedAt: Date.now(),
  }))
}

/** Tras cerrar el globo del guía: volver al rostro “solo navegación”. */
export function clearGuidePetMood() {
  guidePetStore.setState({ petMood: null, message: '', updatedAt: Date.now() })
}

export function resetGuidePetBridge() {
  guidePetStore.setState({ petMood: null, message: '', isThinking: false, updatedAt: Date.now() })
}

export function isGuidePetMood(v: unknown): v is GuidePetMood {
  return typeof v === 'string' && (PET_MOODS as string[]).includes(v)
}

/** Estados visuales del prompt → frames del atlas existente. */
export function mapGuidePetMoodToPetEmotion(mood: GuidePetMood): PetEmotion {
  switch (mood) {
    case 'happy':
      return 'saludo'
    case 'analyzing':
      return 'pensando_minimal'
    case 'warning':
      return 'obstaculo_detectado'
    case 'stoked':
      return 'ayuda_exitosa_fiesta'
    default:
      return 'principal'
  }
}

/**
 * Heurística desde la ficha de ruta en contexto (sin MCP): variar gesto del atlas en detalle.
 */
/** Heurística desde intento (estadísticas): picos de velocidad → alerta / análisis. */
export function inferPetMoodFromAttemptSummary(s: GuideAttemptSummary | null | undefined): GuidePetMood | null {
  if (!s) return null
  const mx = s.maxSpeedKmh
  if (typeof mx === 'number' && mx >= 55) return 'warning'
  if (typeof mx === 'number' && mx >= 38) return 'analyzing'
  return 'happy'
}

export function inferPetMoodFromCurrentRoute(
  route: {
    distanceKm?: number | null
    elevationGainM?: number | null
    difficulty?: string | null
  } | null | undefined,
  trackPointCount?: number | null
): GuidePetMood | null {
  if (!route) return null
  const diff = String(route.difficulty || '').toLowerCase()
  const km = Number(route.distanceKm)
  const el = Number(route.elevationGainM)
  if (diff.includes('expert') || diff === 'pro') {
    if (Number.isFinite(km) && km > 2) return 'warning'
  }
  if (Number.isFinite(el) && el > 700) return 'analyzing'
  if (Number.isFinite(km) && km >= 8) return 'analyzing'
  if (typeof trackPointCount === 'number' && trackPointCount > 800) return 'analyzing'
  if (diff.includes('beginner') || diff.includes('easy') || diff.includes('fácil') || diff === 'novice') {
    return 'happy'
  }
  if (Number.isFinite(km) && km > 0) return 'happy'
  return 'analyzing'
}

/**
 * Heurística en vivo durante replay: velocidad / altitud / si está corriendo el tiempo.
 * No sustituye al LLM para el globo de texto; solo alimenta el atlas del pet de forma reactiva.
 */
export function inferPetMoodFromReplayLive(
  playing: boolean,
  speedKmh: number | null,
  altitudeM: number | null,
  replay?: {
    vertical_mode?: 'subida' | 'bajada' | 'plano' | 'desconocido' | null
    uphill_pedaling_likely?: boolean
  } | null
): GuidePetMood {
  if (!playing) return 'analyzing'
  const v = typeof speedKmh === 'number' && Number.isFinite(speedKmh) ? speedKmh : null
  const z = typeof altitudeM === 'number' && Number.isFinite(altitudeM) ? altitudeM : null
  if (replay?.uphill_pedaling_likely) return 'analyzing'
  if (replay?.vertical_mode === 'subida' && v != null && v >= 4 && v <= 40) return 'analyzing'
  if (v != null && v >= 55) return 'warning'
  if (v != null && v >= 40) return 'analyzing'
  if (z != null && z >= 4200) return 'analyzing'
  if (v != null && v >= 18) return 'happy'
  return 'neutral'
}

/** Una sola lectura en play/pause/seek (acción explícita del usuario o tick de telemetría). */
export function inferPetMoodFromReplayAction(
  action: 'play' | 'pause' | 'seek' | 'tick',
  speedKmh: number | null,
  altitudeM: number | null,
  playing?: boolean
): GuidePetMood {
  if (action === 'pause' || action === 'seek') return 'analyzing'
  if (action === 'tick') return inferPetMoodFromReplayLive(playing ?? true, speedKmh, altitudeM)
  return inferPetMoodFromReplayLive(playing ?? true, speedKmh, altitudeM)
}

/** Sinergia datos MCP → ánimo del pet (heurística; el modelo puede sobreescribir con `pet_mood` salvo warning por error). */
export function inferPetMoodFromMcpObservations(obs: GuideMcpObservation[]): GuidePetMood | null {
  let best: GuidePetMood | null = null
  const rank = (m: GuidePetMood) =>
    ({ neutral: 0, happy: 1, analyzing: 2, stoked: 3, warning: 4 } as const)[m]

  const consider = (m: GuidePetMood) => {
    if (!best || rank(m) > rank(best)) best = m
  }

  for (const o of obs) {
    if (!o.ok) {
      consider('warning')
      continue
    }
    if (o.tool === 'my_weekly_progress' && o.data && typeof o.data === 'object') {
      const d = o.data as { delta?: { best_time_sec?: number | null; distance_km?: number; attempts?: number } }
      const bt = d.delta?.best_time_sec
      if (typeof bt === 'number' && Number.isFinite(bt)) {
        if (bt < -5) consider('stoked')
        if (bt > 40) consider('warning')
      }
      const km = d.delta?.distance_km
      if (typeof km === 'number' && km > 0.4) consider('happy')
    }
    if (o.tool === 'get_route_by_id' && o.data && typeof o.data === 'object') {
      const r = o.data as { difficulty?: string | null; distance_km?: number | null }
      const diff = String(r.difficulty || '').toLowerCase()
      const km = Number(r.distance_km)
      if ((diff.includes('expert') || diff === 'pro') && Number.isFinite(km) && km > 3.5) {
        consider('warning')
      }
    }
    if (o.tool === 'my_best_times_this_week' && Array.isArray(o.data) && o.data.length > 0) {
      consider('happy')
    }
  }
  return best
}

/** Cuando no hay `pet_mood` del modelo, derivar del mood del globo (RiderGuideMood). */
export function mapRiderGuideMoodToPetMood(m: RiderGuideMood): GuidePetMood {
  switch (m) {
    case 'warning':
    case 'error':
      return 'warning'
    case 'triumph':
      return 'stoked'
    case 'fatigue':
      return 'warning'
    case 'focus':
    case 'loading':
      return 'analyzing'
    default:
      return 'happy'
  }
}

export function mergeGuidePetMood(
  model: GuidePetMood | undefined,
  inferred: GuidePetMood | null
): GuidePetMood {
  const m = model && isGuidePetMood(model) ? model : 'neutral'
  if (inferred === 'warning') return 'warning'
  if (inferred === 'stoked') {
    if (m === 'neutral' || m === 'happy' || m === 'analyzing') return 'stoked'
  }
  if (inferred === 'happy' && (m === 'neutral' || m === 'analyzing')) return 'happy'
  if (inferred === 'analyzing' && m === 'neutral') return 'analyzing'
  return m
}
