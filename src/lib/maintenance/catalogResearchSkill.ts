/**
 * Skill compartido: investigación de catálogo `maintenance_*` (worker servidor + documentación para el guía).
 * Salida = JSON estricto → columna `proposed_payload` (no merge automático al catálogo publicado).
 */

export const MAINTENANCE_CATALOG_RESEARCH_SCHEMA_VERSION = 1 as const

export type MaintenanceCatalogProposedInterval = {
  service_kind_slug: string
  interval_hours: number | null
  interval_km: number | null
  interval_months: number | null
  recommendation_es: string
  recommendation_en: string
  source_label: string
  source_url: string | null
}

/**
 * Payload almacenado en `maintenance_catalog_research_requests.proposed_payload`.
 */
export type MaintenanceCatalogProposedPayload = {
  schema_version: typeof MAINTENANCE_CATALOG_RESEARCH_SCHEMA_VERSION
  inferred_category_slug: string | null
  manufacturer_summary_es: string
  manufacturer_summary_en: string
  key_specs_es: string
  key_specs_en: string
  notes_es: string
  notes_en: string
  travel_mm: number | null
  variant_key: string
  suggested_intervals: MaintenanceCatalogProposedInterval[]
  compatibility_hints_es: string[]
  compatibility_hints_en: string[]
  confidence: 'low' | 'medium' | 'high'
  /** Si el modelo no puede afirmar con seguridad, explicar brevemente (no inventar URLs). */
  caveats_es?: string
  caveats_en?: string
}

export const MAINTENANCE_CATALOG_RESEARCH_SKILL_MARKDOWN = [
  '## Skill: investigación catálogo de componentes (GuardDH)',
  '',
  'Rol: sintetizar datos **orientativos** para MTB/DH (mantenimiento, compatibilidad genérica, uso).',
  'No inventes URLs ni manuales; si no hay fuente, `source_label` = "Heurística interna GuardDH" y `source_url` = null.',
  'Intervalos: slugs en snake_case (`lower_leg_service`, `air_can_service`, `bleed_and_pads`, `pivot_bearing_inspect`, …).',
  'Categorías típicas: suspension_fork, suspension_shock, brake_hydraulic, drivetrain, frame, wheel_hub, tubeless, dropper_post, tires, cockpit, pedals.',
  '',
  'Respondé **solo** un JSON que cumpla `MaintenanceCatalogProposedPayload` (schema_version = 1).',
  'Campos de texto cortos (≤ 400 chars c/u salvo arrays de hints ≤ 6 ítems de ≤ 120 chars).',
  '`confidence`: baja si hay duda de generación o de categoría.',
].join('\n')

/** Entrada al LLM del worker (además del JSON de la fila `research_requests`). */
export function buildCatalogResearchUserPrompt(row: {
  raw_brand: string
  raw_model: string | null
  raw_variant: string | null
  category_slug: string | null
  user_notes: string | null
}): string {
  return [
    'Generá el JSON `MaintenanceCatalogProposedPayload` para esta solicitud:',
    JSON.stringify(row, null, 0),
    '',
    'Recordá: sin URLs inventadas; intervalos orientativos; bilingüe ES/EN.',
  ].join('\n')
}

export function normalizeProposedPayload(raw: unknown): MaintenanceCatalogProposedPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const sv = o.schema_version
  if (sv !== 1 && sv !== '1') return null

  const str = (k: string, max: number) => {
    const v = o[k]
    if (typeof v !== 'string' || !v.trim()) return ''
    return v.trim().slice(0, max)
  }

  const intervalsIn = Array.isArray(o.suggested_intervals) ? o.suggested_intervals : []
  const intervals: MaintenanceCatalogProposedInterval[] = []
  for (const it of intervalsIn.slice(0, 12)) {
    if (!it || typeof it !== 'object') continue
    const x = it as Record<string, unknown>
    const slug = typeof x.service_kind_slug === 'string' ? x.service_kind_slug.trim().slice(0, 64) : ''
    if (!slug) continue
    const ih = Number(x.interval_hours)
    const ik = Number(x.interval_km)
    const im = Number(x.interval_months)
    intervals.push({
      service_kind_slug: slug,
      interval_hours: Number.isFinite(ih) ? Math.round(ih) : null,
      interval_km: Number.isFinite(ik) ? Math.round(ik) : null,
      interval_months: Number.isFinite(im) ? Math.round(im) : null,
      recommendation_es: typeof x.recommendation_es === 'string' ? x.recommendation_es.trim().slice(0, 500) : '',
      recommendation_en: typeof x.recommendation_en === 'string' ? x.recommendation_en.trim().slice(0, 500) : '',
      source_label: typeof x.source_label === 'string' ? x.source_label.trim().slice(0, 200) : 'Heurística interna GuardDH',
      source_url: typeof x.source_url === 'string' && x.source_url.startsWith('http') ? x.source_url.trim().slice(0, 500) : null,
    })
  }

  const hintsEs = Array.isArray(o.compatibility_hints_es)
    ? o.compatibility_hints_es.map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 8)
    : []
  const hintsEn = Array.isArray(o.compatibility_hints_en)
    ? o.compatibility_hints_en.map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 8)
    : []

  const conf = o.confidence === 'low' || o.confidence === 'medium' || o.confidence === 'high' ? o.confidence : 'low'

  const tm = Number(o.travel_mm)
  const variant =
    typeof o.variant_key === 'string' && o.variant_key.trim() ? o.variant_key.trim().slice(0, 64) : ''

  const cat = o.inferred_category_slug
  const inferred =
    typeof cat === 'string' && cat.trim() ? cat.trim().slice(0, 64).replace(/[^a-z0-9_]/gi, '_') : null

  return {
    schema_version: MAINTENANCE_CATALOG_RESEARCH_SCHEMA_VERSION,
    inferred_category_slug: inferred,
    manufacturer_summary_es: str('manufacturer_summary_es', 400) || str('notes_es', 400),
    manufacturer_summary_en: str('manufacturer_summary_en', 400) || str('notes_en', 400),
    key_specs_es: str('key_specs_es', 400),
    key_specs_en: str('key_specs_en', 400),
    notes_es: str('notes_es', 400),
    notes_en: str('notes_en', 400),
    travel_mm: Number.isFinite(tm) ? Math.round(tm) : null,
    variant_key: variant,
    suggested_intervals: intervals,
    compatibility_hints_es: hintsEs,
    compatibility_hints_en: hintsEn,
    confidence: conf,
    caveats_es: str('caveats_es', 400) || undefined,
    caveats_en: str('caveats_en', 400) || undefined,
  }
}
