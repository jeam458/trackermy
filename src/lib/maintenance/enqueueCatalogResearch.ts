import type { SupabaseClient } from '@supabase/supabase-js'

const PLACEHOLDER_MODEL = '(nueva marca catálogo bici)'

/**
 * True si ya existe par marca/modelo en el catálogo de mantenimiento (case-insensitive).
 * `rawModel` vacío o placeholder solo compara marca.
 */
export async function maintenanceCatalogCoversBikeInput(
  supabase: SupabaseClient,
  rawBrand: string,
  rawModel: string | null
): Promise<boolean> {
  const brand = rawBrand.trim()
  if (!brand) return true
  const { data: mb } = await supabase
    .from('maintenance_component_brands')
    .select('id')
    .ilike('name', brand)
    .maybeSingle()
  if (!mb?.id) return false

  const model = (rawModel || '').trim()
  if (!model || model === PLACEHOLDER_MODEL || model.startsWith('(')) {
    return true
  }

  const { data: mm } = await supabase
    .from('maintenance_component_models')
    .select('id')
    .eq('brand_id', mb.id)
    .ilike('model_name', model)
    .maybeSingle()

  return !!mm?.id
}

export type EnqueueCatalogResearchInput = {
  userId: string
  rawBrand: string
  rawModel: string | null
  rawVariant?: string | null
  categorySlug?: string | null
  userNotes?: string | null
  sourceContext: string
}

/**
 * Inserta fila `pending` si el catálogo de mantenimiento aún no cubre marca+modelo.
 */
export async function enqueueMaintenanceCatalogResearchIfNeeded(
  supabase: SupabaseClient,
  input: EnqueueCatalogResearchInput
): Promise<{ inserted: boolean; id?: string; reason?: 'covered' | 'db_error' | 'invalid' }> {
  const rawBrand = input.rawBrand.trim()
  if (!rawBrand) return { inserted: false, reason: 'invalid' }

  const rawModel = input.rawModel?.trim() || null
  const covered = await maintenanceCatalogCoversBikeInput(supabase, rawBrand, rawModel)
  if (covered) return { inserted: false, reason: 'covered' }

  const { data, error } = await supabase
    .from('maintenance_catalog_research_requests')
    .insert({
      user_id: input.userId,
      source_context: input.sourceContext.slice(0, 120),
      category_slug: input.categorySlug?.trim().slice(0, 64) || null,
      raw_brand: rawBrand.slice(0, 240),
      raw_model: (rawModel || PLACEHOLDER_MODEL).slice(0, 240),
      raw_variant: input.rawVariant?.trim().slice(0, 240) || null,
      user_notes: input.userNotes?.trim().slice(0, 500) || null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.warn('[enqueueMaintenanceCatalogResearchIfNeeded]', error.message)
    return { inserted: false, reason: 'db_error' }
  }
  const id = typeof data?.id === 'string' ? data.id : undefined
  return { inserted: true, id }
}

export { PLACEHOLDER_MODEL }
