/**
 * Recetas declarativas para animejs (lista blanca). Lo que venga de la BD debe pasar por estos parsers.
 */

export type PetAnimTarget = 'wrap' | 'face'

const EASE = new Set([
  'linear',
  'inOutSine',
  'inOutQuad',
  'inOutCubic',
  'inQuad',
  'outQuad',
  'outCubic',
  'inOutQuart',
])

const PROP = new Set(['y', 'x', 'rotate', 'scale', 'opacity', 'boxShadow', 'filter'])

const FILTER_KF = /^[0-9a-zA-Z\s().%,+-]{1,200}$/
/** Sombras tipo `0 0 18px 4px rgba(45,212,191,0.45)` (sin caracteres raros). */
const BOX_KF = /^[0-9a-zA-Z\s().%,+-/]{12,240}$/i

export type PetAnimTween = {
  prop: 'y' | 'x' | 'rotate' | 'scale' | 'opacity' | 'boxShadow' | 'filter'
  keyframes: Array<number | string>
  duration: number
  ease?: string
  loop?: boolean
  delay?: number
}

export type PetAnimTrack = {
  target: PetAnimTarget
  tween: PetAnimTween
}

export type PetAmbientRecipe = {
  tracks: PetAnimTrack[]
  /** CSS aplicado al contenedor al iniciar (se limpia al parar la receta). */
  wrapStyle?: { filter?: string }
}

export type PetEnterRecipe = { tracks: PetAnimTrack[] }

function isFiniteNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function parseTween(raw: unknown): PetAnimTween | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const prop = o.prop
  if (typeof prop !== 'string' || !PROP.has(prop)) return null
  const kf = o.keyframes
  if (!Array.isArray(kf) || kf.length < 2 || kf.length > 12) return null
  const keyframes: Array<number | string> = []
  for (const v of kf) {
    if (isFiniteNum(v)) keyframes.push(v)
    else if (typeof v === 'string') {
      if (prop === 'filter' && !FILTER_KF.test(v)) return null
      if (prop === 'boxShadow' && !BOX_KF.test(v)) return null
      keyframes.push(v)
    } else return null
  }
  const duration = o.duration
  if (!isFiniteNum(duration) || duration < 80 || duration > 30_000) return null
  const ease = o.ease
  if (ease != null && (typeof ease !== 'string' || !EASE.has(ease))) return null
  const delay = o.delay
  if (delay != null && (!isFiniteNum(delay) || delay < 0 || delay > 20_000)) return null
  const loop = o.loop
  if (loop != null && typeof loop !== 'boolean') return null
  return {
    prop: prop as PetAnimTween['prop'],
    keyframes,
    duration,
    ease: typeof ease === 'string' ? ease : undefined,
    loop: typeof loop === 'boolean' ? loop : undefined,
    delay: typeof delay === 'number' ? delay : undefined,
  }
}

function parseTrack(raw: unknown): PetAnimTrack | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const target = o.target
  if (target !== 'wrap' && target !== 'face') return null
  const tween = parseTween(o.tween)
  if (!tween) return null
  return { target, tween }
}

function parseWrapStyle(raw: unknown): PetAmbientRecipe['wrapStyle'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const f = o.filter
  if (typeof f !== 'string' || !FILTER_KF.test(f)) return undefined
  return { filter: f }
}

export function parseAmbientRecipe(raw: unknown): PetAmbientRecipe | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const tracksRaw = o.tracks
  if (!Array.isArray(tracksRaw) || tracksRaw.length < 1 || tracksRaw.length > 8) return null
  const tracks: PetAnimTrack[] = []
  for (const t of tracksRaw) {
    const tr = parseTrack(t)
    if (!tr) return null
    tracks.push(tr)
  }
  const wrapStyle = parseWrapStyle(o.wrapStyle)
  return wrapStyle ? { tracks, wrapStyle } : { tracks }
}

export function parseEnterRecipe(raw: unknown): PetEnterRecipe | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const tracksRaw = o.tracks
  if (!Array.isArray(tracksRaw) || tracksRaw.length < 1 || tracksRaw.length > 6) return null
  const tracks: PetAnimTrack[] = []
  for (const t of tracksRaw) {
    const tr = parseTrack(t)
    if (!tr) return null
    tracks.push(tr)
  }
  return { tracks }
}
