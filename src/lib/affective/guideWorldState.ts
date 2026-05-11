import type { GuideContext } from '@/lib/guide-ai/types'
import type { GuideSessionReplaySignal } from '@/lib/guide-ai/types'
import type { PetReplayTickDetail } from '@/lib/guide-ai/guideUiTelemetry'
import type { GuideAppTriggerId } from '@/lib/affective/guideAppTriggerCatalog'
import { isGuideAppTriggerId } from '@/lib/affective/guideAppTriggerCatalog'
import {
  GUIDE_DYNAMIC_DOMAIN_LEGACY_STRING,
  GUIDE_DYNAMIC_DOMAIN_SCHEMA_FALLBACK,
  GUIDE_LEGACY_TRIGGER_STRING_MAX_LEN,
  GUIDE_WORLD_RECENT_TRIGGERS_MAX,
  GUIDE_WORLD_REPLAY_TAIL_MAX,
} from '@/lib/affective/config/affectiveLimits'
import {
  guideTriggerInputSchema,
  sanitizeLegacyTriggerActionKey,
  type GuideAppTriggerPulse,
  type GuideTriggerInput,
  type GuideWorldReplayTick,
  type GuideWorldStateSnapshot,
} from '@/lib/affective/schema/guideAffectiveSchemas'

function emptySnapshot(): GuideWorldStateSnapshot {
  return {
    version: 1,
    updatedAtMs: 0,
    pathname: null,
    routeId: null,
    attemptId: null,
    gpsHint: null,
    networkOnline: null,
    replayLastTick: null,
    replayStructuralTail: [],
    lastAppTrigger: null,
    recentAppTriggers: [],
  }
}

function pulseFromNormalizedInput(input: GuideTriggerInput, now: number): GuideAppTriggerPulse {
  if (input.kind === 'catalog') {
    return { kind: 'catalog', id: input.id, atMs: now, detail: input.detail }
  }
  const pulse: GuideAppTriggerPulse = {
    kind: 'dynamic',
    domain: input.domain,
    action: input.action,
    atMs: now,
    detail: input.detail,
  }
  if (input.subject?.trim()) pulse.subject = input.subject.trim()
  return pulse
}

function normalizeTriggerInputLoose(input: GuideTriggerInput): GuideTriggerInput {
  const parsed = guideTriggerInputSchema.safeParse(input)
  if (parsed.success) return parsed.data
  return {
    kind: 'dynamic',
    domain: GUIDE_DYNAMIC_DOMAIN_SCHEMA_FALLBACK,
    action: 'invalid_trigger_input',
    detail: { issues: parsed.error.flatten() },
  }
}

/**
 * Buffer de “mundo” para afectiva / guía: un solo lugar donde aterrizan navegación,
 * contexto Supabase y telemetría de replay. La IA local lee el snapshot serializado.
 */
export class GuideWorldStateController {
  private s: GuideWorldStateSnapshot = emptySnapshot()

  reset(): void {
    this.s = emptySnapshot()
  }

  ingestFromGuideContext(ctx: GuideContext): void {
    const now = Date.now()
    this.s = {
      ...this.s,
      version: 1,
      updatedAtMs: now,
      pathname: ctx.pathname ?? null,
      routeId: ctx.routeId ?? null,
      attemptId: ctx.attemptId ?? null,
      gpsHint: ctx.gpsHint ?? null,
      networkOnline: ctx.networkOnline ?? null,
    }
  }

  ingestReplayTick(raw: PetReplayTickDetail): void {
    const now = Date.now()
    const tick: GuideWorldReplayTick = {
      atMs: now,
      elapsed_sec: raw.elapsed_sec,
      speed_kmh: raw.speed_kmh,
      altitude_m: raw.altitude_m,
      playing: raw.playing,
      grade_pct_est: raw.grade_pct_est ?? undefined,
      vertical_mode: raw.vertical_mode ?? undefined,
      uphill_pedaling_likely: raw.uphill_pedaling_likely,
    }
    this.s = {
      ...this.s,
      updatedAtMs: now,
      replayLastTick: tick,
    }
  }

  ingestReplayStructuralTail(tail: GuideSessionReplaySignal[]): void {
    const now = Date.now()
    this.s = {
      ...this.s,
      updatedAtMs: now,
      replayStructuralTail: tail.slice(-GUIDE_WORLD_REPLAY_TAIL_MAX),
    }
  }

  ingestTrigger(input: GuideTriggerInput): void {
    const now = Date.now()
    const normalized = normalizeTriggerInputLoose(input)
    const pulse = pulseFromNormalizedInput(normalized, now)
    const tail = [...this.s.recentAppTriggers, pulse].slice(-GUIDE_WORLD_RECENT_TRIGGERS_MAX)
    this.s = {
      ...this.s,
      updatedAtMs: now,
      lastAppTrigger: pulse,
      recentAppTriggers: tail,
    }
  }

  ingestAppTrigger(id: string, detail?: Record<string, unknown>): void {
    if (isGuideAppTriggerId(id)) {
      this.ingestTrigger({ kind: 'catalog', id: id as GuideAppTriggerId, detail })
      return
    }
    const safe = id.trim().slice(0, GUIDE_LEGACY_TRIGGER_STRING_MAX_LEN) || 'unknown'
    this.ingestTrigger({
      kind: 'dynamic',
      domain: GUIDE_DYNAMIC_DOMAIN_LEGACY_STRING,
      action: sanitizeLegacyTriggerActionKey(safe),
      detail: { original_id: safe, ...detail },
    })
  }

  getSnapshot(): GuideWorldStateSnapshot {
    return {
      ...this.s,
      replayStructuralTail: [...this.s.replayStructuralTail],
      recentAppTriggers: [...this.s.recentAppTriggers],
    }
  }
}
