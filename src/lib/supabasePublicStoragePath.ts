/** Extrae la ruta del objeto dentro del bucket a partir de la URL pública de Supabase Storage. */
export function objectPathFromSupabasePublicUrl(
  url: string | null | undefined,
  bucket: string
): string | null {
  if (!url?.trim()) return null
  const u = url.trim()
  const needle = `/object/public/${bucket}/`
  const i = u.indexOf(needle)
  if (i === -1) return null
  const rest = u.slice(i + needle.length)
  const path = rest.split('?')[0]?.replace(/#.*$/, '')
  if (!path) return null
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}
