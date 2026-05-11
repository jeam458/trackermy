/**
 * Estados emocionales del pet GUARDDH: slug + recetas (animejs, overlay procedural).
 * **Rostro de marca:** `public/brand/guarddh-pet-rostro.png` (retrato único; encuadre fino por slug en `guardDhPetRostroFrames.ts`).
 * La lámina modular (`guarddh-pet-estados-sheet.png`) queda como referencia / futuro atlas si exportan celdas limpias.
 */
export type PetEmotion =
  | 'principal'
  | 'pensando_minimal'
  | 'conexion_perdida'
  | 'recuperando'
  | 'ayuda_exitosa_fiesta'
  | 'exhausto'
  | 'exhausto_total'
  | 'inicio_ruta'
  | 'espera_sincronizacion'
  | 'confusion_error'
  | 'datos_guardados'
  | 'pensando_mapa'
  | 'obstaculo_detectado'
  | 'fin_ruta'
  | 'saludo'
  | 'cansado_flor'
  | 'cansado'
  | 'velocidad_critica'
  | 'bateria_baja'
  | 'vinculo_tiempo'
  | 'molesto'

export const PET_EMOTION_LABELS: Record<PetEmotion, string> = {
  principal: 'Perfil principal · estado base (sonrisa)',
  pensando_minimal: 'Neutral · visor más frío',
  conexion_perdida: 'Conexión perdida · sin red',
  recuperando: 'Recuperando · estado de recarga',
  ayuda_exitosa_fiesta: 'Ayuda exitosa · celebración',
  exhausto: 'Exhausto · esfuerzo máximo (variante 1)',
  exhausto_total: 'Exhausto · esfuerzo máximo (variante 2)',
  inicio_ruta: 'Inicio de ruta · preparado',
  espera_sincronizacion: 'Espera · energía y tiempo (sync)',
  confusion_error: 'Error / confusión · alerta',
  datos_guardados: 'Datos guardados · confirmación',
  pensando_mapa: 'Pensando · análisis de ruta',
  obstaculo_detectado: 'Tramo nocturno / alerta en ruta',
  fin_ruta: 'Fin de ruta · éxito total',
  saludo: 'Saludo · bienvenida',
  cansado_flor: 'Baja energía / glitch · flores marchitas',
  cansado: 'Cansado · baja energía',
  velocidad_critica: 'Velocidad crítica · límite alcanzado',
  bateria_baja: 'Batería baja · alerta de carga',
  vinculo_tiempo: 'Tiempo / vínculo roto · reloj de arena',
  molesto: 'Molesto · frustración / obstáculo (Qosqo)',
}

/** Orden = índice de celda en la lámina 7×3 (fila prioritaria sobre columna). */
export const ALL_PET_EMOTIONS: PetEmotion[] = [
  'principal',
  'pensando_minimal',
  'conexion_perdida',
  'recuperando',
  'ayuda_exitosa_fiesta',
  'exhausto',
  'exhausto_total',
  'inicio_ruta',
  'espera_sincronizacion',
  'confusion_error',
  'datos_guardados',
  'pensando_mapa',
  'obstaculo_detectado',
  'fin_ruta',
  'saludo',
  'cansado_flor',
  'cansado',
  'velocidad_critica',
  'bateria_baja',
  'vinculo_tiempo',
  'molesto',
]
