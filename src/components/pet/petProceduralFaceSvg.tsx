'use client'

import type {
  PetProceduralBrowKind,
  PetProceduralFaceRecipe,
  PetProceduralMouthKind,
} from '@/lib/pet/petProceduralFaceRecipe'

function browPaths(kind: PetProceduralBrowKind, tilt: number): { left: string; right: string } {
  const t = tilt * 3.2
  switch (kind) {
    case 'up':
      return {
        left: `M 18 31 Q 30 ${24 + t} 44 29`,
        right: `M 82 31 Q 70 ${24 + t} 56 29`,
      }
    case 'down':
      return {
        left: `M 20 27 Q 32 ${33 + t} 46 31`,
        right: `M 80 27 Q 68 ${33 + t} 54 31`,
      }
    case 'furrow':
      return {
        left: `M 22 29 Q 34 ${32 + t * 0.8} 46 30`,
        right: `M 78 29 Q 66 ${32 + t * 0.8} 54 30`,
      }
    case 'sad':
      return {
        left: `M 20 28 Q 32 ${36 + t * 0.6} 46 33`,
        right: `M 80 28 Q 68 ${36 + t * 0.6} 54 33`,
      }
    case 'asym':
      return {
        left: `M 18 30 Q 30 ${27 + t} 42 32`,
        right: `M 82 28 Q 70 ${34 - t * 0.5} 56 31`,
      }
    case 'neutral':
    default:
      return {
        left: `M 20 29 Q 32 ${27 + t} 44 29`,
        right: `M 80 29 Q 68 ${27 + t} 56 29`,
      }
  }
}

function outlinedPath(d: string, sw: number, opacity = 1) {
  return (
    <g opacity={opacity}>
      <path
        d={d}
        fill="none"
        stroke="#020617"
        strokeWidth={sw + 2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.82}
      />
      <path d={d} fill="none" stroke="#f8fafc" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

function MouthPath({
  kind,
  intensity,
  mouthOpen,
}: {
  kind: PetProceduralMouthKind
  intensity: number
  mouthOpen: number
}) {
  const sw = Math.max(1.85, 1.45 * intensity)
  const open = mouthOpen
  const strong = kind === 'grit' || kind === 'frown' || kind === 'wavy'
  const swUse = strong ? sw * 1.12 : sw

  switch (kind) {
    case 'smile': {
      const dip = 74 + open * 4
      const d = `M 32 64 Q 50 ${dip} 68 64`
      return outlinedPath(d, swUse * 0.92)
    }
    case 'smileWide': {
      const dip = 78 + open * 5
      const d = `M 28 62 Q 50 ${dip} 72 62`
      return outlinedPath(d, swUse)
    }
    case 'frown': {
      const d = 'M 34 68 Q 50 58 66 68'
      return outlinedPath(d, swUse)
    }
    case 'wavy': {
      const d = 'M 30 66 L 38 62 L 46 68 L 54 62 L 62 68 L 70 64'
      return outlinedPath(d, swUse * 0.95)
    }
    case 'grit': {
      const d = 'M 32 66 H 68'
      return outlinedPath(d, swUse + 0.35 * intensity)
    }
    case 'o': {
      const rx = 5.5 + open * 4.5
      const ry = 4.2 + open * 3.8
      return (
        <g>
          <ellipse cx="50" cy="66" rx={rx + 1.1} ry={ry + 0.9} fill="none" stroke="#020617" strokeWidth={2.2} strokeOpacity={0.78} />
          <ellipse cx="50" cy="66" rx={rx} ry={ry} fill="none" stroke="#f8fafc" strokeWidth={swUse * 0.85} />
        </g>
      )
    }
    case 'flat': {
      const d = 'M 36 66 H 64'
      return outlinedPath(d, swUse * 0.88, 0.88)
    }
    case 'neutral':
    default: {
      const d = `M 36 65 Q 50 ${68 + open * 3} 64 65`
      return outlinedPath(d, swUse * 0.9, Math.min(0.92, 0.72 + open * 0.08))
    }
  }
}

export type PetProceduralFaceSvgProps = {
  recipe: PetProceduralFaceRecipe
  /** Clave para animar transición al cambiar receta */
  animationKey: string
  className?: string
}

/**
 * Dibuja cejas, boca y acentos a partir de una `PetProceduralFaceRecipe` ya resuelta
 * (builtin + merge BD). Sin lógica de negocio por emoción aquí.
 */
export function PetProceduralFaceSvg({ recipe, animationKey, className = '' }: PetProceduralFaceSvgProps) {
  const brows = browPaths(recipe.brow, recipe.browTilt)
  const strokeHi = 'rgba(250,204,21,0.92)'
  const swBrow = Math.max(1.65, 1.28 * recipe.intensity)
  const sweat = recipe.accents.includes('sweat')
  const spark = recipe.accents.includes('spark')

  return (
    <g className={`transition-all duration-300 ease-out ${className}`} key={animationKey} transform="translate(0, 4.5)">
      <path
        d={brows.left}
        fill="none"
        stroke="#020617"
        strokeWidth={swBrow + 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.78}
      />
      <path d={brows.left} fill="none" stroke="#f8fafc" strokeWidth={swBrow} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={brows.right}
        fill="none"
        stroke="#020617"
        strokeWidth={swBrow + 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.78}
      />
      <path d={brows.right} fill="none" stroke="#f8fafc" strokeWidth={swBrow} strokeLinecap="round" strokeLinejoin="round" />
      <MouthPath kind={recipe.mouth} intensity={recipe.intensity} mouthOpen={recipe.mouthOpen} />
      {sweat ? (
        <path
          d="M 74 22 Q 79 31 76 42"
          fill="none"
          stroke="#38bdf8"
          strokeWidth={Math.max(1.5, 1.15 * recipe.intensity)}
          strokeLinecap="round"
          opacity={0.95}
        />
      ) : null}
      {spark ? (
        <g transform="translate(78, 26)" fill={strokeHi} opacity={0.88}>
          <path d="M 0 -4.5 L 1.1 -1.4 L 4.2 -1.1 L 1.8 0.9 L 2.6 4 L 0 2.2 L -2.6 4 L -1.8 0.9 L -4.2 -1.1 L -1.1 -1.4 Z" />
        </g>
      ) : null}
    </g>
  )
}
