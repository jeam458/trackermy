import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import type { RiderGuideMood } from '@/lib/riderGuide'

/** Mapea estados del guía / app → emoción del pet (ajustable por UX). */
export function mapGuideMoodToPetEmotion(mood: RiderGuideMood): PetEmotion {
  switch (mood) {
    case 'loading':
      return 'pensando_minimal'
    case 'focus':
      return 'pensando_mapa'
    case 'triumph':
      return 'ayuda_exitosa_fiesta'
    case 'fatigue':
      return 'cansado'
    case 'warning':
      return 'obstaculo_detectado'
    case 'error':
      return 'confusion_error'
    default:
      return 'principal'
  }
}

/** Eventos de producto → emoción (para futuras integraciones). */
export function mapPetEmotionFromEvent(input: {
  type: 'route_start' | 'route_end' | 'offline' | 'online' | 'save_ok' | 'low_battery' | 'critical_speed'
}): PetEmotion {
  switch (input.type) {
    case 'route_start':
      return 'inicio_ruta'
    case 'route_end':
      return 'fin_ruta'
    case 'offline':
      return 'conexion_perdida'
    case 'online':
      return 'recuperando'
    case 'save_ok':
      return 'datos_guardados'
    case 'low_battery':
      return 'bateria_baja'
    case 'critical_speed':
      return 'velocidad_critica'
    default:
      return 'principal'
  }
}
