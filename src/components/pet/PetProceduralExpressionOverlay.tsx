'use client'

import { useId, useMemo } from 'react'
import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import { PetProceduralFaceSvg } from '@/components/pet/petProceduralFaceSvg'
import type { PetProceduralFacePartial, PetProceduralFaceRecipe } from '@/lib/pet/petProceduralFaceRecipe'
import { resolveProceduralFaceRecipe } from '@/lib/pet/petProceduralFaceRecipe'

/**
 * Con el PNG oficial de marca, el trazo procedural solo **matiza** la emoción (no sustituye el diseño).
 * Subí a `0.85`–`1` si querés expresión más marcada encima del retrato.
 */
export const PET_PROCEDURAL_OVERLAY_BLEND = 0.4

type Props = {
  emotion: PetEmotion
  /** Parcial desde BD (contexto); se fusiona con catálogo embebido por slug. */
  proceduralFaceFromDb: PetProceduralFacePartial | null
  size: number
  className?: string
}

/**
 * Capa SVG procedural: la receta final sale de `resolveProceduralFaceRecipe`
 * (builtin por slug + merge con `pet_emotion_definitions.procedural_face`).
 */
export function PetProceduralExpressionOverlay({
  emotion,
  proceduralFaceFromDb,
  size,
  className = '',
}: Props) {
  const filterUid = useId().replace(/:/g, '')
  const recipe: PetProceduralFaceRecipe = useMemo(
    () => resolveProceduralFaceRecipe(emotion, proceduralFaceFromDb),
    [emotion, proceduralFaceFromDb]
  )

  const animationKey = useMemo(
    () =>
      `${emotion}:${recipe.brow}:${recipe.mouth}:${recipe.accents.join(',')}:${recipe.browTilt}:${recipe.mouthOpen}:${recipe.intensity}`,
    [emotion, recipe]
  )

  const filterId = `pet-proc-${filterUid}`

  return (
    <svg
      className={`pointer-events-none absolute inset-0 z-[8] transition-opacity duration-300 ease-out ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      data-pet-procedural-expression={emotion}
      style={{ opacity: PET_PROCEDURAL_OVERLAY_BLEND }}
    >
      <defs>
        <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="0.5" stdDeviation="0.85" floodColor="#020617" floodOpacity="0.88" />
          <feDropShadow dx="0" dy="0" stdDeviation="0.35" floodColor="#f8fafc" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        <PetProceduralFaceSvg recipe={recipe} animationKey={animationKey} />
      </g>
    </svg>
  )
}
