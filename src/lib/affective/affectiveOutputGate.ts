import type { PetEmotion } from '@/components/pet/guardDhPetTypes'

/** Estado mínimo para histeresis de cara atlas (futuro: `resolveDashboardPetAtlasEmotion`). */
export type AffectiveAtlasGateState = {
  lastCommittedSlug: PetEmotion | null
  lastCommittedAtMs: number
}

export const AFFECTIVE_ATLAS_DEFAULT_MIN_MS = 900

/**
 * Evita cambios de slug “nerviosos” si el modelo u heurística oscilan cada frame.
 * Si no querés filtrar, pasá `minStableMs: 0`.
 */
export function gateAtlasEmotionSwitch(input: {
  proposed: PetEmotion
  nowMs: number
  state: AffectiveAtlasGateState
  minStableMs: number
}): { slug: PetEmotion; state: AffectiveAtlasGateState } {
  const { proposed, nowMs, state, minStableMs } = input
  if (minStableMs <= 0) {
    return {
      slug: proposed,
      state: { lastCommittedSlug: proposed, lastCommittedAtMs: nowMs },
    }
  }
  if (!state.lastCommittedSlug || proposed === state.lastCommittedSlug) {
    return {
      slug: proposed,
      state: { lastCommittedSlug: proposed, lastCommittedAtMs: nowMs },
    }
  }
  if (nowMs - state.lastCommittedAtMs < minStableMs) {
    return { slug: state.lastCommittedSlug, state }
  }
  return {
    slug: proposed,
    state: { lastCommittedSlug: proposed, lastCommittedAtMs: nowMs },
  }
}
