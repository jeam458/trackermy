import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCoachKnowledgeNodesFromDb } from '@/lib/guide-ai/coachKnowledgeDb'
import { COACH_KNOWLEDGE_NODES } from '@/lib/guide-ai/coachKnowledgeTree'
import type { CoachKnowledgeNode } from '@/lib/guide-ai/coachKnowledgeTree.types'
import {
  computeRiderCoachSpectrumFromRows,
  isRiderSpectrumStale,
  RIDER_COACH_SPECTRUM_WINDOW_DAYS,
  type AttemptSpectrumRow,
} from '@/lib/guide-ai/riderCoachSpectrum'

type AttemptJoinRow = {
  max_speed: number
  avg_speed: number
  distance: number
  overall_score: number | null
  hard_brakes_count: number | null
  stops_count: number | null
  elevation_gain: number | null
  routes?: { difficulty?: string | null; elevation_gain_m?: number | null } | { difficulty?: string | null; elevation_gain_m?: number | null }[] | null
}

function mapAttemptWithRoute(row: AttemptJoinRow): AttemptSpectrumRow {
  const r = row.routes
  const route = Array.isArray(r) ? r[0] : r
  return {
    max_speed: Number(row.max_speed),
    avg_speed: Number(row.avg_speed),
    distance: Number(row.distance),
    overall_score: row.overall_score != null ? Number(row.overall_score) : null,
    hard_brakes_count: row.hard_brakes_count != null ? Number(row.hard_brakes_count) : null,
    stops_count: row.stops_count != null ? Number(row.stops_count) : null,
    elevation_gain: row.elevation_gain != null ? Number(row.elevation_gain) : null,
    route_difficulty: route && typeof route.difficulty === 'string' ? route.difficulty : null,
    route_elevation_gain_m:
      route && route.elevation_gain_m != null && Number.isFinite(Number(route.elevation_gain_m))
        ? Number(route.elevation_gain_m)
        : null,
  }
}
import type { GuideRiderCoachingSpectrum } from '@/lib/guide-ai/types'

export type GuideCoachAttachments = {
  riderCoachingSpectrum: GuideRiderCoachingSpectrum
  coachKnowledgeNodes: CoachKnowledgeNode[]
  coachKnowledgeSource: 'database' | 'seed'
}

/**
 * Carga biblioteca de coaching (BD con fallback a seed) y espectro del rider (recomputo si está viejo).
 */
export async function loadGuideCoachAttachments(supabase: SupabaseClient, userId: string): Promise<GuideCoachAttachments> {
  let coachKnowledgeNodes: CoachKnowledgeNode[] = []
  let coachKnowledgeSource: 'database' | 'seed' = 'seed'
  try {
    const fromDb = await fetchCoachKnowledgeNodesFromDb(supabase)
    if (fromDb.length) {
      coachKnowledgeNodes = fromDb
      coachKnowledgeSource = 'database'
    }
  } catch {
    /* tabla ausente o RLS */
  }
  if (!coachKnowledgeNodes.length) {
    coachKnowledgeNodes = [...COACH_KNOWLEDGE_NODES]
    coachKnowledgeSource = 'seed'
  }

  let riderCoachingSpectrum: GuideRiderCoachingSpectrum
  try {
    riderCoachingSpectrum = await ensureRiderCoachingSpectrum(supabase, userId)
  } catch {
    riderCoachingSpectrum = computeRiderCoachSpectrumFromRows([])
  }

  return { riderCoachingSpectrum, coachKnowledgeNodes, coachKnowledgeSource }
}

async function ensureRiderCoachingSpectrum(
  supabase: SupabaseClient,
  userId: string
): Promise<GuideRiderCoachingSpectrum> {
  const { data: row } = await supabase
    .from('rider_coach_spectrum')
    .select('spectrum, computed_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (row && !isRiderSpectrumStale(String(row.computed_at ?? ''))) {
    const s = row.spectrum as GuideRiderCoachingSpectrum | null
    if (s && typeof s.attempts_count === 'number' && s.computed_at) return s
  }

  const since = new Date(Date.now() - RIDER_COACH_SPECTRUM_WINDOW_DAYS * 86400000).toISOString()
  const { data: attempts, error } = await supabase
    .from('route_attempts')
    .select(
      `max_speed, avg_speed, distance, overall_score, hard_brakes_count, stops_count, elevation_gain,
       routes ( difficulty, elevation_gain_m )`
    )
    .eq('user_id', userId)
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })
    .limit(200)

  if (error) {
    return computeRiderCoachSpectrumFromRows([])
  }

  const mapped = (attempts || []).map(mapAttemptWithRoute)
  const spectrum = computeRiderCoachSpectrumFromRows(mapped)
  void (async () => {
    try {
      await supabase.from('rider_coach_spectrum').upsert(
        {
          user_id: userId,
          spectrum,
          suggested_coach_level: spectrum.suggested_coach_level,
          attempts_in_window: spectrum.attempts_count,
          computed_at: spectrum.computed_at,
          updated_at: spectrum.computed_at,
        },
        { onConflict: 'user_id' }
      )
    } catch {
      /* tabla o RLS ausentes en entornos sin migración */
    }
  })()

  return spectrum
}
