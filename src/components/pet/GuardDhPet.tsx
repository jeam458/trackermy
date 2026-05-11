'use client'

import { GuardDhPetAtlas, type GuardDhPetAtlasProps } from '@/components/pet/GuardDhPetAtlas'

export type GuardDhPetProps = GuardDhPetAtlasProps

/**
 * Pet GuardDh: flags y prioridad de renderer en `@/lib/pet/petRuntimeConfig` (SVG marca → vector → PNG).
 */
export function GuardDhPet(props: GuardDhPetProps) {
  return <GuardDhPetAtlas {...props} />
}
