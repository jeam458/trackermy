import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import {
  getAtlasSlotForPetEmotion,
  PET_ESTADOS_SHEET_COLS,
  PET_ESTADOS_SHEET_ROWS,
  PET_ESTADOS_SHEET_URL,
  PET_ROSTRO_SINGLE_URL,
  PET_SHEET_GRID_INSET,
  PET_SHEET_NATIVE_HEIGHT,
  PET_SHEET_NATIVE_WIDTH,
  PET_SHEET_USE_PIXEL_GRID,
} from '@/components/pet/guardDhPetEstadosSheet'
import { USE_PET_ESTADOS_SPRITE_SHEET } from '@/lib/pet/petRuntimeConfig'

export type RostroExprFrame = {
  focusX: number
  focusY: number
  zoom: number
}

/**
 * La lámina 7×3 incluye títulos y padding; el recorte CSS quedó frágil. Usar el **retrato único** de marca
 * (`PET_ROSTRO_SINGLE_URL`) hasta tener celdas exportadas limpias o vector fiel.
 */
export const ROSTRO_ATLAS_URL = USE_PET_ESTADOS_SPRITE_SHEET ? PET_ESTADOS_SHEET_URL : PET_ROSTRO_SINGLE_URL

const SINGLE_PORTRAIT: RostroExprFrame = {
  focusX: 50,
  focusY: 44,
  zoom: 1.32,
}

/** Ajuste fino por slug (tile); en rejilla en px se aplica como fracción ~1% del tamaño del contenedor sobre posición. */
const SPRITE_CELL_NUDGE_PCT: Partial<Record<PetEmotion, { dx?: number; dy?: number; zoom?: number }>> = {
  datos_guardados: { dy: 1.5, zoom: 1.04 },
  bateria_baja: { zoom: 1.06 },
  pensando_mapa: { dx: -0.8 },
  vinculo_tiempo: { dy: -0.5 },
}

const EMOTION_ROSTRO_NUDGE_SINGLE: Partial<Record<PetEmotion, Partial<RostroExprFrame>>> = {
  principal: {},
  saludo: { focusY: 42.5, zoom: 1.28 },
  inicio_ruta: { focusY: 42, zoom: 1.29 },
  datos_guardados: { focusY: 41.5, zoom: 1.27 },
  espera_sincronizacion: { focusY: 41, zoom: 1.27 },
  ayuda_exitosa_fiesta: { focusY: 40, zoom: 1.24 },
  recuperando: { focusY: 43, zoom: 1.31 },
  pensando_mapa: { focusY: 45, zoom: 1.36 },
  pensando_minimal: { focusY: 45.5, zoom: 1.37 },
  obstaculo_detectado: { focusX: 49, focusY: 43, zoom: 1.38 },
  velocidad_critica: { focusX: 48.5, focusY: 42.5, zoom: 1.4 },
  bateria_baja: { focusY: 44, zoom: 1.35 },
  molesto: { focusX: 51, focusY: 43, zoom: 1.36 },
  cansado_flor: { focusY: 47, zoom: 1.36 },
  cansado: { focusY: 47.5, zoom: 1.37 },
  exhausto: { focusY: 48, zoom: 1.38 },
  exhausto_total: { focusY: 48.5, zoom: 1.39 },
  confusion_error: { focusX: 52, focusY: 45, zoom: 1.35 },
  conexion_perdida: { focusX: 47, focusY: 44, zoom: 1.33 },
  vinculo_tiempo: { focusX: 50.5, focusY: 44, zoom: 1.34 },
  fin_ruta: { focusY: 42, zoom: 1.28 },
}

function mergeRostro(base: RostroExprFrame, ...layers: Array<Partial<RostroExprFrame> | null | undefined>): RostroExprFrame {
  let out = { ...base }
  for (const p of layers) {
    if (!p) continue
    out = {
      focusX: p.focusX ?? out.focusX,
      focusY: p.focusY ?? out.focusY,
      zoom: p.zoom ?? out.zoom,
    }
  }
  return out
}

function spriteCellPercent(slot: number): { x: number; y: number } {
  const cols = PET_ESTADOS_SHEET_COLS
  const rows = PET_ESTADOS_SHEET_ROWS
  const c = slot % cols
  const r = Math.floor(slot / cols)
  const x = cols <= 1 ? 50 : (c / (cols - 1)) * 100
  const y = rows <= 1 ? 50 : (r / (rows - 1)) * 100
  return { x, y }
}

export function getRostroExpressionFrame(emotion: PetEmotion): RostroExprFrame {
  if (!USE_PET_ESTADOS_SPRITE_SHEET) {
    const nudge = EMOTION_ROSTRO_NUDGE_SINGLE[emotion]
    return mergeRostro(SINGLE_PORTRAIT, nudge)
  }
  const slot = getAtlasSlotForPetEmotion(emotion)
  const { x, y } = spriteCellPercent(slot)
  const tune = SPRITE_CELL_NUDGE_PCT[emotion]
  return {
    focusX: x + (tune?.dx ?? 0),
    focusY: y + (tune?.dy ?? 0),
    zoom: tune?.zoom ?? 1,
  }
}

/** Recorte de celda con márgenes de lámina (píxeles del PNG → `background-position`/`background-size` en px). */
function applySheetPixelSprite(
  el: HTMLElement,
  slot: number,
  zoomMul: number
): boolean {
  const ew = el.clientWidth || el.getBoundingClientRect().width
  const eh = el.clientHeight || el.getBoundingClientRect().height
  if (!(ew > 4 && eh > 4)) return false

  const Iw = PET_SHEET_NATIVE_WIDTH
  const Ih = PET_SHEET_NATIVE_HEIGHT
  const il = PET_SHEET_GRID_INSET.left
  const it = PET_SHEET_GRID_INSET.top
  const ir = PET_SHEET_GRID_INSET.right
  const ib = PET_SHEET_GRID_INSET.bottom
  const cols = PET_ESTADOS_SHEET_COLS
  const rows = PET_ESTADOS_SHEET_ROWS

  const usableW = Math.max(1, Iw - il - ir)
  const usableH = Math.max(1, Ih - it - ib)
  const baseCellW = usableW / cols
  const baseCellH = usableH / rows
  const safeZoom = Math.max(0.78, Math.min(1.55, zoomMul || 1))
  const cellW = baseCellW / safeZoom
  const cellH = baseCellH / safeZoom

  const col = slot % cols
  const row = Math.floor(slot / cols)

  const bgW = (Iw * ew) / cellW
  const bgH = (Ih * eh) / cellH

  const posXPx = -((il + col * baseCellW) * ew) / cellW
  const posYPx = -((it + row * baseCellH) * eh) / cellH

  el.style.backgroundImage = `url(${PET_ESTADOS_SHEET_URL})`
  el.style.backgroundRepeat = 'no-repeat'
  el.style.backgroundSize = `${bgW}px ${bgH}px`
  el.style.backgroundPosition = `${posXPx}px ${posYPx}px`
  return true
}

function applyUniformPercentSprite(el: HTMLElement, base: RostroExprFrame, overrideZoom?: number | null) {
  const cols = PET_ESTADOS_SHEET_COLS
  const rows = PET_ESTADOS_SHEET_ROWS
  const zoomMul =
    overrideZoom != null && Number.isFinite(overrideZoom) ? overrideZoom : base.zoom ?? 1

  const posX = base.focusX
  const posY = base.focusY

  el.style.backgroundImage = `url(${PET_ESTADOS_SHEET_URL})`
  el.style.backgroundRepeat = 'no-repeat'
  el.style.backgroundSize = `${cols * 100 * zoomMul}% ${rows * 100 * zoomMul}%`
  el.style.backgroundPosition = `${posX}% ${posY}%`
}

export function applyRostroFrame(
  el: HTMLElement | null,
  emotion: PetEmotion,
  override?: Partial<RostroExprFrame> | null
) {
  if (!el) return

  const base = getRostroExpressionFrame(emotion)

  if (!USE_PET_ESTADOS_SPRITE_SHEET) {
    const f: RostroExprFrame = override
      ? {
          focusX: override.focusX ?? base.focusX,
          focusY: override.focusY ?? base.focusY,
          zoom: override.zoom ?? base.zoom,
        }
      : base
    el.style.backgroundImage = `url(${PET_ROSTRO_SINGLE_URL})`
    el.style.backgroundRepeat = 'no-repeat'
    el.style.backgroundSize = `${f.zoom * 100}% auto`
    el.style.backgroundPosition = `${f.focusX}% ${f.focusY}%`
    return
  }

  const tune = SPRITE_CELL_NUDGE_PCT[emotion]
  /**
   * `focus_*` de BD siguen pensados como retrato antiguo: en sprite solo usamos zoom si viene numérico.
   * `base.zoom` ya incluye nudge de tile vía `getRostroExpressionFrame`.
   */
  const mergedZoom = Math.max(0.78, Math.min(1.55, (override?.zoom ?? 1) * (base.zoom ?? 1)))

  const slot = getAtlasSlotForPetEmotion(emotion)
  let appliedPx = false
  if (PET_SHEET_USE_PIXEL_GRID) {
    appliedPx = applySheetPixelSprite(el, slot, mergedZoom)
  }
  if (!appliedPx) {
    applyUniformPercentSprite(el, base, mergedZoom)
  }

  /** Micro-nudge XY en rejilla px: corrige decenas de px si hay padding entre tiles. */
  if (appliedPx && (tune?.dx || tune?.dy)) {
    const prev = el.style.backgroundPosition.split(' ')
    const px = parseFloat(prev[0]) || 0
    const py = parseFloat(prev[1]) || 0
    const ew = el.clientWidth || el.getBoundingClientRect().width
    const eh = el.clientHeight || el.getBoundingClientRect().height
    const dxPx = (((tune?.dx ?? 0) / 100) * ew) / (mergedZoom || 1)
    const dyPx = (((tune?.dy ?? 0) / 100) * eh) / (mergedZoom || 1)
    el.style.backgroundPosition = `${px + dxPx}px ${py + dyPx}px`
  }
}
