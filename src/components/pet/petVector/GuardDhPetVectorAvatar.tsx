'use client'

import { useId, useMemo } from 'react'
import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import { PetProceduralFaceSvg } from '@/components/pet/petProceduralFaceSvg'
import type { PetProceduralFacePartial } from '@/lib/pet/petProceduralFaceRecipe'
import { resolveProceduralFaceRecipe } from '@/lib/pet/petProceduralFaceRecipe'
import { GuardDhPetBodySvg } from '@/components/pet/petVector/GuardDhPetBodySvg'
import { PetEmotionVectorDecors } from '@/components/pet/petVector/PetEmotionVectorDecors'

type Props = {
  emotion: PetEmotion
  proceduralFaceFromDb: PetProceduralFacePartial | null
  className?: string
}

/** Avatar completo en SVG: cuerpo + decor por emoción + expresión procedural (mismo viewBox 100×100). */
export function GuardDhPetVectorAvatar({ emotion, proceduralFaceFromDb, className = '' }: Props) {
  const rawId = useId().replace(/:/g, '')
  const filterId = `pet-vec-${rawId}`

  const recipe = useMemo(
    () => resolveProceduralFaceRecipe(emotion, proceduralFaceFromDb),
    [emotion, proceduralFaceFromDb]
  )

  const animationKey = useMemo(
    () =>
      `${emotion}:${recipe.brow}:${recipe.mouth}:${recipe.accents.join(',')}:${recipe.browTilt}:${recipe.mouthOpen}:${recipe.intensity}`,
    [emotion, recipe]
  )

  return (
    <svg
      className={`pointer-events-none absolute inset-0 block h-full w-full ${className}`}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      data-pet-vector-avatar={emotion}
    >
      <defs>
        <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="0.5" stdDeviation="0.85" floodColor="#020617" floodOpacity="0.88" />
          <feDropShadow dx="0" dy="0" stdDeviation="0.35" floodColor="#f8fafc" floodOpacity="0.35" />
        </filter>
      </defs>
      <GuardDhPetBodySvg />
      <PetEmotionVectorDecors emotion={emotion} />
      <g filter={`url(#${filterId})`}>
        <PetProceduralFaceSvg recipe={recipe} animationKey={animationKey} />
      </g>
    </svg>
  )
}
