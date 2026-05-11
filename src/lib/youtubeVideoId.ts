/** Extrae el id de vídeo (11 caracteres) de enlaces comunes de YouTube. */
export function extractYoutubeVideoId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const prefixed = s.match(/^youtube:(.+)$/i)
  if (prefixed?.[1]) {
    const id = prefixed[1].trim()
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
  }
  const m = s.match(
    /(?:youtube\.com\/(?:watch\?(?:[^#&]*&)*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  if (m?.[1]) return m[1]
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  return null
}

export function buildYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

export function isLikelyYoutubeMusicUrl(url: string): boolean {
  return extractYoutubeVideoId(url) != null
}

/** Título legible desde el texto de atribución generado al elegir en YouTube. */
export function formatYoutubeMusicLabel(attribution: string): string {
  const m = attribution.match(/YouTube:\s*«([^»]+)»/)
  if (m?.[1]) return m[1].trim().slice(0, 80)
  const t = attribution.trim()
  return t.length > 72 ? `${t.slice(0, 70)}…` : t
}
