import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import { mapGuideMoodToPetEmotion } from '@/components/pet/mapGuideToPetEmotion'
import type { RiderGuideMood } from '@/lib/riderGuide'

/**
 * Emoción del atlas del pet según **ruta** + humor del guía.
 * Para `guide` usa variantes por pantalla; el resto sigue el mapa mood→pet.
 */
export function resolveDashboardPetEmotion(pathname: string, mood: RiderGuideMood): PetEmotion {
  if (mood !== 'guide') {
    return mapGuideMoodToPetEmotion(mood)
  }

  const p = (pathname || '/dashboard').replace(/\/$/, '') || '/dashboard'

  if (p === '/dashboard') {
    return 'pensando_mapa'
  }
  if (p.startsWith('/dashboard/activity')) {
    return 'principal'
  }
  if (p.includes('/dashboard/routes/attempt-stats')) {
    return 'principal'
  }
  if (p.includes('/dashboard/routes/record')) {
    return 'inicio_ruta'
  }
  if (p.includes('/dashboard/routes/create')) {
    return 'pensando_minimal'
  }
  if (p.includes('/dashboard/routes/view')) {
    return 'pensando_mapa'
  }
  if (p.startsWith('/dashboard/routes')) {
    return 'pensando_mapa'
  }
  if (p.startsWith('/dashboard/profile')) {
    return 'saludo'
  }
  if (p.startsWith('/dashboard/ranking')) {
    return 'ayuda_exitosa_fiesta'
  }
  if (p.startsWith('/dashboard/notifications')) {
    return 'obstaculo_detectado'
  }

  return 'principal'
}
