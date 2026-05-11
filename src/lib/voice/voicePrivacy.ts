/**
 * Privacidad: la transcripción de voz no se envía a servidores externos para clasificar
 * (solo catálogo local + atajos propios en Supabase). Al guardar un atajo, solo persistimos
 * texto que el usuario confirma y rutas en lista blanca.
 */

const MAX_TRANSCRIPT = 280

/** Quita acentos para emparejar frases (es-PE / en). */
export function normalizeVoicePhrase(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TRANSCRIPT)
}

/** Transcripción mostrada en UI (sin recortar agresivamente). */
export function sanitizeTranscriptForDisplay(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TRANSCRIPT)
}
