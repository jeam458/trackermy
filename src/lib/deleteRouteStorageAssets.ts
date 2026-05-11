import type { SupabaseClient } from '@supabase/supabase-js'
import { objectPathFromSupabasePublicUrl } from '@/lib/supabasePublicStoragePath'

const BUCKET_ATTEMPT = 'attempt-media'
const BUCKET_PREVIEW = 'route-previews'

/**
 * Borra en Storage los archivos ligados a una ruta antes de eliminar la fila `routes`
 * (la BD borra intentos y filas `route_attempt_media` en cascada, pero Storage no).
 */
export async function deleteRouteStorageAssetsBeforeDb(
  supabase: SupabaseClient,
  routeId: string,
  previewMediaUrl: string | null | undefined
): Promise<void> {
  const attemptPaths = new Set<string>()

  const { data: attempts, error: attErr } = await supabase
    .from('route_attempts')
    .select('id, video_url')
    .eq('route_id', routeId)

  if (attErr) throw new Error(attErr.message)

  const attemptIds = (attempts ?? []).map((a) => String(a.id))

  for (const a of attempts ?? []) {
    const vu = a.video_url as string | null | undefined
    const p = objectPathFromSupabasePublicUrl(vu, BUCKET_ATTEMPT)
    if (p) attemptPaths.add(p)
  }

  const chunkSize = 150
  for (let i = 0; i < attemptIds.length; i += chunkSize) {
    const slice = attemptIds.slice(i, i + chunkSize)
    if (slice.length === 0) continue
    const { data: meds, error: medErr } = await supabase
      .from('route_attempt_media')
      .select('public_url')
      .in('attempt_id', slice)
    if (medErr) throw new Error(medErr.message)
    for (const m of meds ?? []) {
      const p = objectPathFromSupabasePublicUrl(String((m as { public_url: string }).public_url), BUCKET_ATTEMPT)
      if (p) attemptPaths.add(p)
    }
  }

  const list = [...attemptPaths]
  const batch = 95
  for (let i = 0; i < list.length; i += batch) {
    const slice = list.slice(i, i + batch)
    const { error } = await supabase.storage.from(BUCKET_ATTEMPT).remove(slice)
    if (error) {
      console.warn('[deleteRouteStorageAssets] attempt-media remove:', error.message)
    }
  }

  const previewPath = objectPathFromSupabasePublicUrl(previewMediaUrl, BUCKET_PREVIEW)
  if (previewPath) {
    const { error } = await supabase.storage.from(BUCKET_PREVIEW).remove([previewPath])
    if (error) {
      console.warn('[deleteRouteStorageAssets] route-previews remove:', error.message)
    }
  }
}
