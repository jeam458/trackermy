import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import { ALL_PET_EMOTIONS } from '@/components/pet/guardDhPetTypes'

/**
 * Biblioteca modular oficial — PNG `public/brand/guarddh-pet-estados-sheet.png`.
 * Rejilla **7 × 3** = 21 celdas **fila × columna**, misma lectura que la lámina GUARDDH.
 *
 * ```
 * Fila 1: principal | neutral | sin_red | recarga | fiesta_OK | exhausto_1 | exhausto_2
 * Fila 2: inicio_ruta | espera/sync | confusion | datos_ok | pensando_mapa | tramo_alert | fin_ok
 * Fila 3: saludo | baja_px_flor | cansado | velocidad | bat_baja | tiempo_corazon | molesto_Qosqo
 * ```
 *
 * Orden exacto según **`ALL_PET_EMOTIONS`** (índice 0–20).
 */
export const PET_ESTADOS_SHEET_URL = '/brand/guarddh-pet-estados-sheet.png'

export const PET_ROSTRO_SINGLE_URL = '/brand/guarddh-pet-rostro.png'

export const PET_ESTADOS_SHEET_COLS = 7
export const PET_ESTADOS_SHEET_ROWS = 3

/** Tamaño real del PNG en el repo (ajustá si cambiás el asset). */
export const PET_SHEET_NATIVE_WIDTH = 1024
export const PET_SHEET_NATIVE_HEIGHT = 558

/**
 * Rectángulo donde cae la rejilla 7×3 **dentro del PNG** (píxeles).
 * Calibrado para saltar título superior y leyenda inferior; mové estos valores si el recorte no limpia la celda.
 */
export const PET_SHEET_GRID_INSET = {
  left: 36,
  top: 102,
  right: 36,
  bottom: 52,
} as const

/** Si true, `applyRostroFrame` usa `PET_SHEET_GRID_INSET` + posición en px; si false, modo % clásico (rejilla uniforme en todo el PNG). */
export const PET_SHEET_USE_PIXEL_GRID = true

const EXPECTED_SLOTS = PET_ESTADOS_SHEET_COLS * PET_ESTADOS_SHEET_ROWS

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  if (ALL_PET_EMOTIONS.length !== EXPECTED_SLOTS) {
    console.warn(
      `[pet] ALL_PET_EMOTIONS.length=${ALL_PET_EMOTIONS.length}; la hoja modular espera ${EXPECTED_SLOTS} slots (${PET_ESTADOS_SHEET_COLS}×${PET_ESTADOS_SHEET_ROWS}).`
    )
  }
}

export function getAtlasSlotForPetEmotion(emotion: PetEmotion): number {
  const i = ALL_PET_EMOTIONS.indexOf(emotion)
  return i >= 0 ? i : 0
}
