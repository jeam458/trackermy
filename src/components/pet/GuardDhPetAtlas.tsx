'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Sparkles } from 'lucide-react'
import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import { applyRostroFrame } from '@/components/pet/guardDhPetRostroFrames'
import {
  playPetEmotionEnter,
  playRostroExpressionCrossfade,
  runPetAmbientAnimations,
} from '@/components/pet/guardDhPetAnime'
import { usePetEmotionRecipeFor, usePetEmotionRecipes } from '@/components/pet/PetEmotionRecipeContext'
import { runToastGlanceOnPupils, type ToastGlanceDirection } from '@/components/pet/guardDhPetToastGlance'
import { PetProceduralExpressionOverlay } from '@/components/pet/PetProceduralExpressionOverlay'
import { PetBrandSvgInline } from '@/components/pet/PetBrandSvgInline'
import { USE_GUARD_DH_VECTOR_PET, USE_PET_BRAND_SVG } from '@/lib/pet/petRuntimeConfig'
import { playPetBrandSvgPartEnter } from '@/lib/pet/guardDhPetBrandSvgPartsAnime'
import { GuardDhPetVectorAvatar } from '@/components/pet/petVector/GuardDhPetVectorAvatar'
import { cn } from '@/lib/utils'

/** Solo se muestra en rider cuando `aiMindState === 'thinking'` (generando con WebLLM). */
function PetAiThinkingLamp({ size }: { size: number }) {
  const box = Math.max(20, Math.round(size * 0.36))
  const iconSz = Math.max(8, Math.round(size * 0.18))
  return (
    <div
      className="relative flex shrink-0 items-center justify-center pointer-events-none select-none"
      style={{ width: box, height: box }}
      role="img"
      aria-label="IA procesando respuesta"
    >
      <div
        className="absolute inset-0 animate-pulse rounded-full blur-[4px]"
        style={{
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--gdh-brand-highlight) 55%, transparent) 0%, color-mix(in srgb, var(--gdh-brand) 18%, transparent) 50%, transparent 72%)',
        }}
      />
      <div className="relative z-[1] flex items-center justify-center">
        <Sparkles
          className="scale-110 animate-pulse text-gdh-brand-highlight drop-shadow-[0_0_8px_rgba(227,120,69,0.85)]"
          style={{ width: iconSz, height: iconSz }}
          strokeWidth={2.25}
          aria-hidden
        />
      </div>
      <span className="pointer-events-none absolute inset-[-3px] z-[0] animate-ping rounded-full border-2 border-gdh-brand-highlight/45" />
    </div>
  )
}

export type PetAiMindState = 'off' | 'ready' | 'thinking' | 'heuristic'

export type GuardDhPetAtlasProps = {
  emotion: PetEmotion
  size?: number
  className?: string
  showcase?: boolean
  toastGlanceSignal?: number
  toastGlanceDirection?: ToastGlanceDirection
  /** En rider solo se usa `thinking` | `off`; otros valores se tratan como `off`. */
  aiMindState?: PetAiMindState
}

/**
 * **Render del orbe** (SVG marca / vector / PNG) + animejs + recetas BD. No contiene lógica de coach:
 * espectro del rider, biblioteca `coach_knowledge_*` y prompts viven en `guide-ai` + Supabase; aquí solo
 * se refleja `emotion` y animaciones. Ver `resolveDashboardPetAtlasEmotion` para el slug.
 *
 * Prioridad de renderer: ver `petRuntimeConfig` (marca SVG → vector → PNG).
 */
export function GuardDhPetAtlas({
  emotion,
  size = 64,
  className = '',
  showcase = false,
  toastGlanceSignal = 0,
  toastGlanceDirection = 'below',
  aiMindState = 'off',
}: GuardDhPetAtlasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const face0Ref = useRef<HTMLDivElement>(null)
  const face1Ref = useRef<HTMLDivElement>(null)
  const pupilsRowRef = useRef<HTMLDivElement>(null)
  const activeLayerRef = useRef(0)
  const prevEmotionRef = useRef<PetEmotion | undefined>(undefined)

  const [layerEmotions, setLayerEmotions] = useState<[PetEmotion, PetEmotion]>(() => [emotion, emotion])
  const [brandSvgEl, setBrandSvgEl] = useState<SVGSVGElement | null>(null)

  const dbRecipe = usePetEmotionRecipeFor(emotion)
  const rostroOverride = dbRecipe.rostro
  const { bySlug } = usePetEmotionRecipes()

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const f0 = face0Ref.current
    const f1 = face1Ref.current
    if (!wrap || !f0 || !f1) return

    if (USE_PET_BRAND_SVG || USE_GUARD_DH_VECTOR_PET) {
      f0.style.backgroundImage = 'none'
      f1.style.backgroundImage = 'none'
      f0.style.backgroundSize = ''
      f1.style.backgroundSize = ''
      f0.style.backgroundPosition = ''
      f1.style.backgroundPosition = ''
    }

    const prev = prevEmotionRef.current

    if (prev === undefined) {
      if (USE_PET_BRAND_SVG) {
        /* Img en JSX; fondo pintado desde capa anterior. */
      } else if (USE_GUARD_DH_VECTOR_PET) {
        flushSync(() => setLayerEmotions([emotion, emotion]))
      } else {
        applyRostroFrame(f0, emotion, rostroOverride)
        applyRostroFrame(f1, emotion, rostroOverride)
      }
      f0.style.opacity = '1'
      f1.style.opacity = '0'
      f0.style.transform = 'scale(1)'
      f1.style.transform = 'scale(1)'
      activeLayerRef.current = 0
      prevEmotionRef.current = emotion
      return
    }

    if (prev === emotion) return

    if (USE_PET_BRAND_SVG) {
      prevEmotionRef.current = emotion
      return
    }

    const a = activeLayerRef.current
    const outEl = a === 0 ? f0 : f1
    const inEl = a === 0 ? f1 : f0
    const inIdx = a === 0 ? 1 : 0

    if (USE_GUARD_DH_VECTOR_PET) {
      flushSync(() => {
        setLayerEmotions((cur) => {
          const next: [PetEmotion, PetEmotion] = [...cur]
          next[inIdx] = emotion
          return next
        })
      })
    } else {
      applyRostroFrame(inEl, emotion, rostroOverride)
    }

    const stop = playRostroExpressionCrossfade(outEl, inEl, prev, emotion)
    activeLayerRef.current = inIdx
    prevEmotionRef.current = emotion

    return stop
  }, [emotion, rostroOverride])

  useEffect(() => {
    const wrap = wrapRef.current
    const f0 = face0Ref.current
    const f1 = face1Ref.current
    if (!wrap || !f0 || !f1) return
    const face = activeLayerRef.current === 0 ? f0 : f1

    let stopAmbient: (() => void) | undefined
    let stopEnter: (() => void) | undefined
    const raf = requestAnimationFrame(() => {
      stopAmbient = runPetAmbientAnimations(wrap, face, emotion, showcase, dbRecipe.ambient)
      stopEnter = playPetEmotionEnter(wrap, face, emotion, dbRecipe.enter)
    })

    return () => {
      cancelAnimationFrame(raf)
      stopAmbient?.()
      stopEnter?.()
    }
  }, [emotion, showcase, dbRecipe.ambient, dbRecipe.enter])

  useEffect(() => {
    if (!USE_PET_BRAND_SVG || !brandSvgEl) return
    return playPetBrandSvgPartEnter(brandSvgEl, emotion)
  }, [emotion, brandSvgEl])

  useEffect(() => {
    if (USE_PET_BRAND_SVG || USE_GUARD_DH_VECTOR_PET || !toastGlanceSignal) return
    return runToastGlanceOnPupils(pupilsRowRef.current, size, toastGlanceDirection)
  }, [toastGlanceSignal, size, toastGlanceDirection])

  const pupil = Math.max(2, Math.round(size * 0.085))
  const gap = Math.max(2, Math.round(size * 0.05))
  const padTop = Math.round(size * 0.27)

  const lampTop = -Math.max(6, Math.round(size * 0.14))

  const vectorPartial = (e: PetEmotion) => bySlug.get(e)?.proceduralFace ?? null

  /** PNG `patt-pet` puede traer blanco o “tablero” grabado sin alpha real; multiply + base oscura lo integra al UI. */
  const usePngRostro = !USE_PET_BRAND_SVG && !USE_GUARD_DH_VECTOR_PET

  return (
    <div
      className={`relative shrink-0 overflow-visible ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
      data-pet-emotion={emotion}
      data-pet-renderer={USE_PET_BRAND_SVG ? 'brand-svg-inline' : USE_GUARD_DH_VECTOR_PET ? 'vector' : 'atlas'}
    >
      {aiMindState === 'thinking' ? (
        <div
          className="absolute left-1/2 z-[12] flex -translate-x-1/2 justify-center pointer-events-none"
          style={{ top: lampTop }}
        >
          <PetAiThinkingLamp size={size} />
        </div>
      ) : null}

      <div
        ref={wrapRef}
        className="absolute inset-0 overflow-hidden rounded-full border border-white/20 bg-transparent shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
      >
        {usePngRostro ? (
          <div className="pointer-events-none absolute inset-0 z-0 bg-gdh-canvas-2" aria-hidden />
        ) : null}
        <div
          ref={face0Ref}
          className={cn(
            'absolute inset-0 will-change-transform pointer-events-none overflow-hidden',
            usePngRostro && 'z-[1] mix-blend-multiply'
          )}
          style={{ transformOrigin: '50% 50%' }}
        >
          {USE_PET_BRAND_SVG ? (
            <PetBrandSvgInline onSvgReady={setBrandSvgEl} />
          ) : USE_GUARD_DH_VECTOR_PET ? (
            <GuardDhPetVectorAvatar emotion={layerEmotions[0]} proceduralFaceFromDb={vectorPartial(layerEmotions[0])} />
          ) : null}
        </div>
        <div
          ref={face1Ref}
          className={cn(
            'absolute inset-0 will-change-transform pointer-events-none overflow-hidden',
            usePngRostro && 'z-[1] mix-blend-multiply'
          )}
          style={{ transformOrigin: '50% 50%' }}
        >
          {!USE_PET_BRAND_SVG && USE_GUARD_DH_VECTOR_PET ? (
            <GuardDhPetVectorAvatar emotion={layerEmotions[1]} proceduralFaceFromDb={vectorPartial(layerEmotions[1])} />
          ) : null}
        </div>
        {!USE_PET_BRAND_SVG && !USE_GUARD_DH_VECTOR_PET ? (
          <>
            <div
              className="absolute inset-0 z-[6] flex justify-center pointer-events-none"
              style={{ paddingTop: padTop }}
            >
              <div
                ref={pupilsRowRef}
                className="flex will-change-transform"
                style={{ gap, transformOrigin: '50% 50%' }}
              >
                <span
                  className="rounded-full bg-slate-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
                  style={{ width: pupil, height: Math.round(pupil * 1.05) }}
                />
                <span
                  className="rounded-full bg-slate-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
                  style={{ width: pupil, height: Math.round(pupil * 1.05) }}
                />
              </div>
            </div>
            <PetProceduralExpressionOverlay
              emotion={emotion}
              proceduralFaceFromDb={dbRecipe.proceduralFace}
              size={size}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}
