import type { SupabaseClient } from '@supabase/supabase-js'
import type { GuideMaintenanceHint } from '@/lib/guide-ai/types'

type BrandEmbed = { name?: string | null } | null
type CategoryEmbed = { slug?: string | null; name_es?: string | null; name_en?: string | null } | null
type IntervalEmbed = {
  service_kind_slug?: string | null
  interval_hours?: number | null
  interval_km?: number | null
  interval_months?: number | null
  recommendation_es?: string | null
  recommendation_en?: string | null
  source_label?: string | null
} | null

type MaintenanceModelRow = {
  id?: string
  model_name?: string | null
  variant_key?: string | null
  travel_mm?: number | null
  notes_es?: string | null
  notes_en?: string | null
  key_specs_es?: string | null
  key_specs_en?: string | null
  maintenance_component_brands?: BrandEmbed | BrandEmbed[]
  maintenance_component_categories?: CategoryEmbed | CategoryEmbed[]
  maintenance_service_intervals?: IntervalEmbed[] | null
}

function single<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function buildSearchBlob(parts: (string | null | undefined)[]): string {
  return parts
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .join(' ')
    .toLowerCase()
}

function scoreRow(blob: string, row: MaintenanceModelRow): number {
  const b = blob.trim().toLowerCase()
  if (!b) return 0
  let s = 0
  const brandRow = single(row.maintenance_component_brands)
  const bn = typeof brandRow?.name === 'string' ? brandRow.name.toLowerCase() : ''
  const mn = typeof row.model_name === 'string' ? row.model_name.toLowerCase() : ''
  const vk = typeof row.variant_key === 'string' ? row.variant_key.toLowerCase() : ''
  const tm = Number.isFinite(Number(row.travel_mm)) ? Number(row.travel_mm) : null
  if (bn.length >= 2 && b.includes(bn)) s += 6
  if (mn.length >= 3 && b.includes(mn)) s += 8
  for (const part of mn.split(/[^a-z0-9+]+/i)) {
    const p = part.toLowerCase()
    if (p.length >= 2 && b.includes(p)) s += 2
  }
  for (const tok of b.split(/[^a-z0-9+]+/)) {
    if (tok.length < 3) continue
    if (mn.includes(tok) || bn.includes(tok)) s += 1
  }
  if (vk.length > 0) {
    const strokeTok = vk.match(/(\d+)/)
    if (strokeTok && b.includes(strokeTok[1]!)) s += 5
    if (b.includes(vk.replace(/_/g, ' '))) s += 3
  }
  if (tm != null) {
    const num = String(tm)
    if (b.includes(num)) s += 5
    if (b.includes(`${num}mm`) || b.includes(`${num} mm`)) s += 4
  }
  return s
}

function mapRow(row: MaintenanceModelRow): GuideMaintenanceHint {
  const brand = single(row.maintenance_component_brands)
  const cat = single(row.maintenance_component_categories)
  const intervalsRaw = Array.isArray(row.maintenance_service_intervals)
    ? row.maintenance_service_intervals
    : []
  const intervals = intervalsRaw
    .filter((x): x is NonNullable<typeof x> => x != null)
    .map((i) => ({
      serviceKindSlug: String(i.service_kind_slug || ''),
      intervalHours: Number.isFinite(Number(i.interval_hours)) ? Number(i.interval_hours) : null,
      intervalKm: Number.isFinite(Number(i.interval_km)) ? Number(i.interval_km) : null,
      intervalMonths: Number.isFinite(Number(i.interval_months)) ? Number(i.interval_months) : null,
      recommendationEs: String(i.recommendation_es || ''),
      recommendationEn: String(i.recommendation_en || ''),
      sourceLabel: String(i.source_label || ''),
    }))
    .filter((i) => i.serviceKindSlug.length > 0)

  return {
    categorySlug: String(cat?.slug || ''),
    categoryNameEs: String(cat?.name_es || ''),
    categoryNameEn: String(cat?.name_en || ''),
    brandName: typeof brand?.name === 'string' && brand.name.trim() ? brand.name.trim() : null,
    modelName: String(row.model_name || ''),
    variantKey: typeof row.variant_key === 'string' ? row.variant_key : '',
    travelMm: Number.isFinite(Number(row.travel_mm)) ? Number(row.travel_mm) : null,
    notesEs: row.notes_es ?? null,
    notesEn: row.notes_en ?? null,
    keySpecsEs: row.key_specs_es ?? null,
    keySpecsEn: row.key_specs_en ?? null,
    intervals,
  }
}

/**
 * Cruza la bici primaria del usuario con el catálogo `maintenance_*` (Supabase).
 * Sin coincidencias por texto → array vacío (no forzamos genéricos para no “inventar” bici).
 */
export async function fetchMaintenanceHintsForPrimaryBike(
  supabase: SupabaseClient,
  userId: string,
  opts?: { maxHints?: number }
): Promise<GuideMaintenanceHint[]> {
  const maxHints = opts?.maxHints ?? 10

  const { data: bike } = await supabase
    .from('bike_setups')
    .select('frame, fork, drivetrain, brand_id, model_id')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle()

  let brandName = ''
  let modelName = ''
  if (bike && typeof (bike as { brand_id?: string }).brand_id === 'string') {
    const bid = (bike as { brand_id: string }).brand_id
    const { data: br } = await supabase.from('bike_brands').select('name').eq('id', bid).maybeSingle()
    brandName = typeof br?.name === 'string' ? br.name.trim() : ''
  }
  if (bike && typeof (bike as { model_id?: string }).model_id === 'string') {
    const mid = (bike as { model_id: string }).model_id
    const { data: mm } = await supabase.from('bike_models').select('name').eq('id', mid).maybeSingle()
    modelName = typeof mm?.name === 'string' ? mm.name.trim() : ''
  }

  const b = bike as { frame?: string | null; fork?: string | null; drivetrain?: string | null } | null
  const blob = buildSearchBlob([brandName, modelName, b?.frame, b?.fork, b?.drivetrain])

  const { data: rows, error } = await supabase.from('maintenance_component_models').select(`
    id,
    model_name,
    variant_key,
    travel_mm,
    notes_es,
    notes_en,
    key_specs_es,
    key_specs_en,
    maintenance_component_brands ( name ),
    maintenance_component_categories ( slug, name_es, name_en ),
    maintenance_service_intervals (
      service_kind_slug,
      interval_hours,
      interval_km,
      interval_months,
      recommendation_es,
      recommendation_en,
      source_label
    )
  `)

  if (error || !rows?.length) return []

  const list = rows as MaintenanceModelRow[]
  const scored = list
    .map((r) => ({ row: r, score: scoreRow(blob, r) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxHints)
    .map((x) => mapRow(x.row))

  return scored
}
