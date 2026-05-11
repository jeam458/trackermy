/**
 * Límites y patrones compartidos (única fuente para Zod + runtime).
 * No mezclar estos valores dentro de la lógica de negocio.
 */

/** Valida segmento snake_case con longitud total máxima (incluye primera letra). */
export function isValidGuideDynamicSegment(value: string, maxTotalLen: number): boolean {
  if (!value || maxTotalLen < 1 || value.length > maxTotalLen) return false
  return new RegExp(`^[a-z][a-z0-9_]{0,${maxTotalLen - 1}}$`).test(value)
}

export const GUIDE_DYNAMIC_DOMAIN_MAX_LEN = 48
export const GUIDE_DYNAMIC_ACTION_MAX_LEN = 62
export const GUIDE_DYNAMIC_SUBJECT_MAX_LEN = 160
export const GUIDE_LEGACY_TRIGGER_STRING_MAX_LEN = 80

/** Ventanas del estado unificado */
export const GUIDE_WORLD_RECENT_TRIGGERS_MAX = 12
export const GUIDE_WORLD_REPLAY_TAIL_MAX = 8

/** Dominios dinámicos reservados / conocidos (solo documentación y etiquetas; no cerramos el union). */
export const GUIDE_DYNAMIC_DOMAIN_LEGACY_STRING = 'legacy_string'
/** Pulso cuando `guideTriggerInputSchema.safeParse` falla (payload corrupto). */
export const GUIDE_DYNAMIC_DOMAIN_SCHEMA_FALLBACK = 'schema'
export const GUIDE_DYNAMIC_ACTION_FALLBACK = 'unknown'
export const GUIDE_DYNAMIC_ACTION_DEFAULT_FROM_DOM = 'interact'
export const GUIDE_DYNAMIC_ACTION_SANITIZE_FALLBACK = 'event'

/** Labels DOM / detail */
export const GUIDE_POINTER_LABEL_MAX_LEN = 80
export const GUIDE_POINTER_CARD_SLUG_MAX_LEN = 80
