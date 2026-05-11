import { resolveDashboardPetAtlasEmotion } from '@/lib/pet/resolveDashboardPetAtlasEmotion'

describe('resolveDashboardPetAtlasEmotion', () => {
  it('loading → pensando_minimal', () => {
    expect(
      resolveDashboardPetAtlasEmotion({
        pathname: '/dashboard',
        riderMood: 'loading',
        guideBubbleSource: null,
        guidePetMood: null,
      })
    ).toBe('pensando_minimal')
  })

  it('toast usa solo mapa mood→pet (ignora navegación)', () => {
    expect(
      resolveDashboardPetAtlasEmotion({
        pathname: '/dashboard/activity',
        riderMood: 'triumph',
        guideBubbleSource: 'toast',
        guidePetMood: null,
      })
    ).toBe('ayuda_exitosa_fiesta')
  })

  it('guide + actividad sin pet_mood → emoción de ruta', () => {
    expect(
      resolveDashboardPetAtlasEmotion({
        pathname: '/dashboard/activity',
        riderMood: 'guide',
        guideBubbleSource: 'navigation',
        guidePetMood: null,
      })
    ).toBe('principal')
  })

  it('guide + pet_mood warning → obstáculo (precedencia sobre nav)', () => {
    expect(
      resolveDashboardPetAtlasEmotion({
        pathname: '/dashboard/activity',
        riderMood: 'guide',
        guideBubbleSource: 'navigation',
        guidePetMood: 'warning',
      })
    ).toBe('obstaculo_detectado')
  })

  it('guide + pet_mood stoked → fiesta', () => {
    expect(
      resolveDashboardPetAtlasEmotion({
        pathname: '/dashboard/activity',
        riderMood: 'guide',
        guideBubbleSource: 'navigation',
        guidePetMood: 'stoked',
      })
    ).toBe('ayuda_exitosa_fiesta')
  })

  it('guide + pet_mood happy → sigue navegación (happy no fuerza slug)', () => {
    expect(
      resolveDashboardPetAtlasEmotion({
        pathname: '/dashboard/activity',
        riderMood: 'guide',
        guideBubbleSource: 'navigation',
        guidePetMood: 'happy',
      })
    ).toBe('principal')
  })
})
