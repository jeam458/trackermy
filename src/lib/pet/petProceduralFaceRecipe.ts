/**
 * Receta de “cara procedural” (SVG sobre atlas): lista blanca parseable desde
 * `pet_emotion_definitions.procedural_face` (JSONB) con fallback embebido por `slug`.
 */

export const PET_PROCEDURAL_BROW_KINDS = [
  'neutral',
  'up',
  'down',
  'furrow',
  'sad',
  'asym',
] as const
export type PetProceduralBrowKind = (typeof PET_PROCEDURAL_BROW_KINDS)[number]

export const PET_PROCEDURAL_MOUTH_KINDS = [
  'neutral',
  'smile',
  'smileWide',
  'frown',
  'wavy',
  'grit',
  'o',
  'flat',
] as const
export type PetProceduralMouthKind = (typeof PET_PROCEDURAL_MOUTH_KINDS)[number]

export const PET_PROCEDURAL_ACCENT_KINDS = ['sweat', 'spark'] as const
export type PetProceduralAccentKind = (typeof PET_PROCEDURAL_ACCENT_KINDS)[number]

/** Claves permitidas en JSON `procedural_face` (cualquier otra → 400 en POST). */
export const PET_PROCEDURAL_FACE_JSON_KEYS = [
  'brow',
  'mouth',
  'accents',
  'brow_tilt',
  'mouth_open',
  'intensity',
] as const

export type PetProceduralFaceRecipe = {
  brow: PetProceduralBrowKind
  mouth: PetProceduralMouthKind
  accents: PetProceduralAccentKind[]
  /** -1…1 inclina ligeramente las cejas (control points en viewBox). */
  browTilt: number
  /** 0…1 abre la boca tipo “o” y acentúa curvas suaves. */
  mouthOpen: number
  /** 0.4…1.6 grosor/opacidad de trazos. */
  intensity: number
}

export const DEFAULT_PROCEDURAL_FACE_RECIPE: PetProceduralFaceRecipe = {
  brow: 'neutral',
  mouth: 'neutral',
  accents: [],
  browTilt: 0,
  mouthOpen: 0,
  intensity: 1,
}

function isBrow(v: unknown): v is PetProceduralBrowKind {
  return typeof v === 'string' && (PET_PROCEDURAL_BROW_KINDS as readonly string[]).includes(v)
}

function isMouth(v: unknown): v is PetProceduralMouthKind {
  return typeof v === 'string' && (PET_PROCEDURAL_MOUTH_KINDS as readonly string[]).includes(v)
}

function isAccent(v: unknown): v is PetProceduralAccentKind {
  return typeof v === 'string' && (PET_PROCEDURAL_ACCENT_KINDS as readonly string[]).includes(v)
}

/** Fragmento válido desde BD (merge encima del builtin del mismo slug). */
export type PetProceduralFacePartial = Partial<Omit<PetProceduralFaceRecipe, 'accents'>> & {
  accents?: PetProceduralAccentKind[]
}

/**
 * Parsea JSON de columna `procedural_face`. Objeto vacío → null (se usa solo builtin).
 * Campos desconocidos se ignoran.
 */
export function parseProceduralFacePartial(raw: unknown): PetProceduralFacePartial | null {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (Object.keys(o).length === 0) return null

  const out: PetProceduralFacePartial = {}

  if ('brow' in o && isBrow(o.brow)) out.brow = o.brow
  if ('mouth' in o && isMouth(o.mouth)) out.mouth = o.mouth
  if ('accents' in o && Array.isArray(o.accents)) {
    const acc = o.accents.filter(isAccent) as PetProceduralAccentKind[]
    if (acc.length) out.accents = acc
  }
  if ('brow_tilt' in o && typeof o.brow_tilt === 'number' && Number.isFinite(o.brow_tilt)) {
    out.browTilt = Math.max(-1, Math.min(1, o.brow_tilt))
  }
  if ('mouth_open' in o && typeof o.mouth_open === 'number' && Number.isFinite(o.mouth_open)) {
    out.mouthOpen = Math.max(0, Math.min(1, o.mouth_open))
  }
  if ('intensity' in o && typeof o.intensity === 'number' && Number.isFinite(o.intensity)) {
    out.intensity = Math.max(0.35, Math.min(1.65, o.intensity))
  }

  return Object.keys(out).length ? out : null
}

export function mergeProceduralFaceRecipe(
  base: PetProceduralFaceRecipe,
  patch: PetProceduralFacePartial | null
): PetProceduralFaceRecipe {
  if (!patch) return base
  return {
    brow: patch.brow ?? base.brow,
    mouth: patch.mouth ?? base.mouth,
    accents: patch.accents ?? base.accents,
    browTilt: patch.browTilt ?? base.browTilt,
    mouthOpen: patch.mouthOpen ?? base.mouthOpen,
    intensity: patch.intensity ?? base.intensity,
  }
}

/** Catálogo embebido (misma semántica que antes en el overlay); BD puede sustituir por slug. */
const BUILTIN_SLUG_PATCHES: Record<string, PetProceduralFacePartial> = {
  ayuda_exitosa_fiesta: { brow: 'up', mouth: 'smileWide', accents: ['spark'] },
  saludo: { brow: 'up', mouth: 'smile' },
  inicio_ruta: { brow: 'up', mouth: 'smile' },
  datos_guardados: { brow: 'up', mouth: 'smile' },
  espera_sincronizacion: { brow: 'neutral', mouth: 'flat' },
  fin_ruta: { brow: 'up', mouth: 'smile' },
  recuperando: { brow: 'neutral', mouth: 'smile' },
  pensando_mapa: { brow: 'furrow', mouth: 'flat' },
  pensando_minimal: { brow: 'furrow', mouth: 'flat' },
  obstaculo_detectado: { brow: 'down', mouth: 'grit', accents: ['sweat'], intensity: 1.38 },
  velocidad_critica: { brow: 'down', mouth: 'grit', accents: ['sweat'], intensity: 1.38 },
  bateria_baja: { brow: 'furrow', mouth: 'frown' },
  molesto: { brow: 'furrow', mouth: 'frown' },
  cansado_flor: { brow: 'sad', mouth: 'frown' },
  cansado: { brow: 'sad', mouth: 'frown' },
  exhausto: { brow: 'sad', mouth: 'frown' },
  exhausto_total: { brow: 'sad', mouth: 'frown' },
  confusion_error: { brow: 'asym', mouth: 'wavy' },
  conexion_perdida: { brow: 'up', mouth: 'o', mouthOpen: 0.45 },
  vinculo_tiempo: { brow: 'sad', mouth: 'frown' },
}

export function getBuiltinProceduralFaceForSlug(slug: string): PetProceduralFaceRecipe {
  const patch = BUILTIN_SLUG_PATCHES[slug]
  return mergeProceduralFaceRecipe(DEFAULT_PROCEDURAL_FACE_RECIPE, patch ?? null)
}

/** Motor: builtin(slug) + merge parcial desde fila `pet_emotion_definitions`. */
export function resolveProceduralFaceRecipe(slug: string, dbPartial: unknown): PetProceduralFaceRecipe {
  const base = getBuiltinProceduralFaceForSlug(slug)
  const parsed = parseProceduralFacePartial(dbPartial)
  return mergeProceduralFaceRecipe(base, parsed)
}
