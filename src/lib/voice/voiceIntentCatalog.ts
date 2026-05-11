import type { AppLocale } from '@/messages/types'
import { isVoiceNavPathAllowed } from '@/lib/voice/voiceNavigateAllowlist'
import { normalizeVoicePhrase } from '@/lib/voice/voicePrivacy'

export type VoiceShortcutRow = {
  id: string
  phrase_normalized: string
  path: string
  phrase_display?: string
}

/**
 * Reglas fijas (sin modelo externo): orden importa — la primera coincidencia gana.
 */
const BUILTIN_ES: Array<{ needles: string[]; path: string }> = [
  { needles: ['perfil', 'mi perfil', 'cuenta', 'ajustes perfil'], path: '/dashboard/profile' },
  { needles: ['actividad', 'mi actividad', 'progreso'], path: '/dashboard/activity' },
  { needles: ['rutas', 'mis rutas', 'mapa de rutas'], path: '/dashboard/routes' },
  { needles: ['ranking', 'rankings', 'clasificacion'], path: '/dashboard/ranking' },
  { needles: ['notificaciones', 'avisos'], path: '/dashboard/notifications' },
  { needles: ['mascota', 'pet gallery', 'galeria mascota'], path: '/dashboard/pet-gallery' },
  { needles: ['descubrir', 'inicio', 'home', 'principal'], path: '/dashboard' },
]

const BUILTIN_EN: Array<{ needles: string[]; path: string }> = [
  { needles: ['profile', 'my profile', 'account'], path: '/dashboard/profile' },
  { needles: ['activity', 'my activity', 'progress'], path: '/dashboard/activity' },
  { needles: ['routes', 'my routes'], path: '/dashboard/routes' },
  { needles: ['ranking', 'leaderboard'], path: '/dashboard/ranking' },
  { needles: ['notifications', 'alerts'], path: '/dashboard/notifications' },
  { needles: ['pet', 'pet gallery'], path: '/dashboard/pet-gallery' },
  { needles: ['discover', 'home', 'main'], path: '/dashboard' },
]

function matchNeedles(norm: string, needles: string[]): boolean {
  for (const n of needles) {
    const t = normalizeVoicePhrase(n)
    if (t.length >= 2 && norm.includes(t)) return true
  }
  return false
}

function matchBuiltIn(norm: string, locale: AppLocale): string | null {
  const rules = locale === 'en' ? BUILTIN_EN : BUILTIN_ES
  for (const r of rules) {
    if (matchNeedles(norm, r.needles) && isVoiceNavPathAllowed(r.path)) return r.path
  }
  return null
}

/**
 * Prioridad: atajos del usuario (frase más larga primero), luego catálogo fijo.
 */
export function resolveVoiceNavigation(
  transcript: string,
  locale: AppLocale,
  userShortcuts: VoiceShortcutRow[]
): { path: string; source: 'shortcut' | 'builtin'; shortcutId?: string } | null {
  const norm = normalizeVoicePhrase(transcript)
  if (norm.length < 2) return null

  const sorted = [...userShortcuts].sort((a, b) => b.phrase_normalized.length - a.phrase_normalized.length)
  for (const s of sorted) {
    const pn = s.phrase_normalized
    if (pn.length >= 2 && norm.includes(pn) && isVoiceNavPathAllowed(s.path)) {
      return { path: s.path, source: 'shortcut', shortcutId: s.id }
    }
  }

  const built = matchBuiltIn(norm, locale)
  if (built) return { path: built, source: 'builtin' }
  return null
}
