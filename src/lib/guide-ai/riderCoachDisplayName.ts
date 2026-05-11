/**
 * Nombre para el coach: solo perfil / metadata "nombre real".
 * No usar email local ni handles tipo jeancarlos387 (evita saludos monótonos y fríos).
 */
export function resolveRiderDisplayNameForCoach(opts: {
  profileFullName?: string | null
  authMetadataFullName?: string | null
}): string | null {
  const a = typeof opts.profileFullName === 'string' ? opts.profileFullName.trim() : ''
  const b = typeof opts.authMetadataFullName === 'string' ? opts.authMetadataFullName.trim() : ''
  const v = a || b
  return v.length > 0 ? v : null
}

/** Primer nombre para tuteo; null si parece handle/email (mejor solo "vos"). */
export function coachVosFirstName(displayFullName: string | null | undefined): string | null {
  if (!displayFullName?.trim()) return null
  const parts = displayFullName.trim().split(/\s+/).filter(Boolean)
  const first = parts[0] ?? ''
  if (!first) return null
  if (first.includes('@')) return null
  if (/^[^\s@]+@[^\s@]+$/.test(displayFullName.trim())) return null
  const handleLike = /^[a-z0-9._-]{4,}$/i.test(first) && /\d/.test(first)
  if (handleLike) return null
  return first
}
