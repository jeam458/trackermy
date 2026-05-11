import { z } from 'zod'
import {
  GUIDE_DYNAMIC_ACTION_SANITIZE_FALLBACK,
  GUIDE_DYNAMIC_DOMAIN_LEGACY_STRING,
  GUIDE_DYNAMIC_ACTION_MAX_LEN,
  GUIDE_DYNAMIC_DOMAIN_MAX_LEN,
  GUIDE_DYNAMIC_SUBJECT_MAX_LEN,
  GUIDE_LEGACY_TRIGGER_STRING_MAX_LEN,
  isValidGuideDynamicSegment,
} from '@/lib/affective/config/affectiveLimits'
import { isGuideAppTriggerId, type GuideAppTriggerId } from '@/lib/affective/guideAppTriggerCatalog'

const detailRecordSchema = z.record(z.string(), z.unknown()).optional()

function sanitizeSegment(raw: string, maxLen: number, fallback: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, maxLen)
  const out = s || fallback
  return isValidGuideDynamicSegment(out, maxLen) ? out : fallback
}

export const guideDynamicDomainSchema = z
  .string()
  .transform((raw) => sanitizeSegment(raw, GUIDE_DYNAMIC_DOMAIN_MAX_LEN, GUIDE_DYNAMIC_DOMAIN_LEGACY_STRING))

export const guideDynamicActionSchema = z
  .string()
  .transform((raw) => sanitizeSegment(raw, GUIDE_DYNAMIC_ACTION_MAX_LEN, GUIDE_DYNAMIC_ACTION_SANITIZE_FALLBACK))

export const guideCatalogTriggerIdSchema = z.custom<GuideAppTriggerId>(
  (v): v is GuideAppTriggerId => typeof v === 'string' && isGuideAppTriggerId(v),
  { message: 'id no está en GUIDE_APP_TRIGGER_META' }
)

export const guideSessionReplaySignalSchema = z.object({
  kind: z.literal('replay_signal'),
  action: z.enum(['play', 'pause', 'seek', 'tick']),
  elapsed_sec: z.number(),
  speed_kmh: z.number().nullable(),
  altitude_m: z.number().nullable(),
  at: z.number(),
  grade_pct_est: z.number().nullable().optional(),
  vertical_mode: z.enum(['subida', 'bajada', 'plano', 'desconocido']).nullable().optional(),
  uphill_pedaling_likely: z.boolean().nullable().optional(),
})

export const guideWorldReplayTickSchema = z.object({
  atMs: z.number(),
  elapsed_sec: z.number(),
  speed_kmh: z.number().nullable(),
  altitude_m: z.number().nullable(),
  playing: z.boolean(),
  grade_pct_est: z.number().nullable().optional(),
  vertical_mode: z.enum(['subida', 'bajada', 'plano', 'desconocido']).nullable().optional(),
  uphill_pedaling_likely: z.boolean().optional(),
})

export const guideCatalogTriggerPulseSchema = z.object({
  kind: z.literal('catalog'),
  id: guideCatalogTriggerIdSchema,
  atMs: z.number(),
  detail: detailRecordSchema,
})

export const guideDynamicTriggerPulseSchema = z.object({
  kind: z.literal('dynamic'),
  domain: z.string(),
  action: z.string(),
  subject: z.string().max(GUIDE_DYNAMIC_SUBJECT_MAX_LEN).optional(),
  atMs: z.number(),
  detail: detailRecordSchema,
})

export const guideAppTriggerPulseSchema = z.discriminatedUnion('kind', [
  guideCatalogTriggerPulseSchema,
  guideDynamicTriggerPulseSchema,
])

export const guideTriggerInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('catalog'),
    id: guideCatalogTriggerIdSchema,
    detail: detailRecordSchema,
  }),
  z.object({
    kind: z.literal('dynamic'),
    domain: guideDynamicDomainSchema,
    action: guideDynamicActionSchema,
    subject: z.string().max(GUIDE_DYNAMIC_SUBJECT_MAX_LEN).optional(),
    detail: detailRecordSchema,
  }),
])

export const guideWorldStateSnapshotSchema = z.object({
  version: z.literal(1),
  updatedAtMs: z.number(),
  pathname: z.string().nullable(),
  routeId: z.string().nullable(),
  attemptId: z.string().nullable(),
  gpsHint: z.string().nullable(),
  networkOnline: z.boolean().nullable(),
  replayLastTick: guideWorldReplayTickSchema.nullable(),
  replayStructuralTail: z.array(guideSessionReplaySignalSchema),
  lastAppTrigger: guideAppTriggerPulseSchema.nullable(),
  recentAppTriggers: z.array(guideAppTriggerPulseSchema),
})

export type GuideCatalogTriggerPulse = z.infer<typeof guideCatalogTriggerPulseSchema>
export type GuideDynamicTriggerPulse = z.infer<typeof guideDynamicTriggerPulseSchema>
export type GuideAppTriggerPulse = z.infer<typeof guideAppTriggerPulseSchema>
export type GuideTriggerInput = z.infer<typeof guideTriggerInputSchema>
export type GuideWorldReplayTick = z.infer<typeof guideWorldReplayTickSchema>
export type GuideWorldStateSnapshot = z.infer<typeof guideWorldStateSnapshotSchema>

export function parseGuideTriggerInput(raw: unknown) {
  return guideTriggerInputSchema.safeParse(raw)
}

export function parseGuideWorldStateSnapshot(raw: unknown) {
  return guideWorldStateSnapshotSchema.safeParse(raw)
}

export function sanitizeLegacyTriggerActionKey(raw: string): string {
  const safe =
    raw.trim().slice(0, GUIDE_LEGACY_TRIGGER_STRING_MAX_LEN) || GUIDE_DYNAMIC_ACTION_SANITIZE_FALLBACK
  const slug =
    safe
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase()
      .slice(0, GUIDE_DYNAMIC_ACTION_MAX_LEN) || GUIDE_DYNAMIC_ACTION_SANITIZE_FALLBACK
  return isValidGuideDynamicSegment(slug, GUIDE_DYNAMIC_ACTION_MAX_LEN)
    ? slug
    : GUIDE_DYNAMIC_ACTION_SANITIZE_FALLBACK
}
