import { useEffect, useRef } from 'react'
import { animate } from '@/lib/animeUi'
import type { JSAnimation } from 'animejs'
import { GuardDhPet } from '@/components/pet/GuardDhPet'
import { GuidePetMoodEyesOverlay } from '@/components/pet/GuidePetMoodEyesOverlay'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import type { PetAiMindState } from '@/components/pet/GuardDhPetAtlas'
import type { GuidePetMood } from '@/lib/pet/guidePetBridge'

interface PetOrbProps {
  mood: string
  externalEventSource?: string | null | undefined
  externalEventToastType?: string | null | undefined
  guideLlmThinking: boolean
  petMood: GuidePetMood | null
  petVisible: boolean
  petEmotion: any
  petAiMindState: PetAiMindState | 'off' | 'thinking'
  toastGlanceKey: number
  toastGlanceDirection?: 'above' | 'below'
  size?: number
  isSidebar?: boolean
}

export function PetOrb({
  mood,
  externalEventSource,
  externalEventToastType,
  guideLlmThinking,
  petMood,
  petVisible,
  petEmotion,
  petAiMindState,
  toastGlanceKey,
  toastGlanceDirection = 'below',
  size = 62,
  isSidebar = false,
}: PetOrbProps) {
  const glowRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLDivElement>(null)
  const petSize = isSidebar ? 56 : size <= 50 ? Math.max(34, Math.round(size * 0.78)) : 52

  // Animaciones de glow y orb
  useEffect(() => {
    const animations: JSAnimation[] = []

    if (glowRef.current) {
      animations.push(
        animate(glowRef.current, {
          opacity: [0.35, 0.62, 0.35],
          scale: [0.97, 1.03, 0.97],
          duration: 3600,
          ease: 'inOutSine',
          loop: true,
        })
      )
    }

    const toastFlavor = externalEventSource === 'toast' ? externalEventToastType : undefined

    if (orbRef.current) {
      const triumphBob = mood === 'triumph' || toastFlavor === 'success'
      animations.push(
        animate(orbRef.current, {
          y: triumphBob ? [0, -2, 0] : [0, -0.35, 0],
          duration: triumphBob ? 920 : 2800,
          ease: 'inOutSine',
          loop: true,
        })
      )
      if (mood === 'loading') {
        animations.push(
          animate(orbRef.current, {
            rotate: ['0deg', '4deg', '-4deg', '0deg'],
            duration: 900,
            ease: 'inOutSine',
            loop: true,
          })
        )
      } else if (mood === 'warning' || toastFlavor === 'warning') {
        animations.push(
          animate(orbRef.current, {
            x: [0, -1.5, 1.5, 0],
            duration: 520,
            ease: 'inOutSine',
            loop: true,
          })
        )
      } else if (mood === 'error' || toastFlavor === 'error') {
        animations.push(
          animate(orbRef.current, {
            x: [0, -2.2, 2.2, 0],
            rotate: ['0deg', '-2.5deg', '2.5deg', '0deg'],
            duration: 380,
            ease: 'inOutSine',
            loop: true,
          })
        )
      } else if (mood === 'focus' || toastFlavor === 'info') {
        animations.push(
          animate(orbRef.current, {
            scale: [1, 1.035, 1],
            duration: 1200,
            ease: 'inOutSine',
            loop: true,
          })
        )
      }
    }

    if (iconRef.current && petVisible) {
      animations.push(
        animate(iconRef.current, {
          opacity: [0, 1],
          scale: [0.76, 1],
          y: [4, 0],
          duration: 240,
          ease: 'outCubic',
        })
      )
    }

    return () => {
      animations.forEach((a) => a.revert())
    }
  }, [mood, externalEventSource, externalEventToastType, petVisible])

  // Animación de glance para toasts
  useEffect(() => {
    if (!toastGlanceKey || !orbRef.current) return
    void animate(orbRef.current, {
      scale: [1, 1.07, 1],
      duration: 420,
      ease: 'outQuad',
    })
  }, [toastGlanceKey])

  // Determinar colores basados en el tipo de toast o mood
  const glowColors = (() => {
    if (externalEventSource === 'toast' && externalEventToastType) {
      switch (externalEventToastType) {
        case 'success':
          return 'from-emerald-400/55 via-teal-400/35 to-cyan-400/35'
        case 'error':
          return 'from-rose-500/50 via-red-500/35 to-fuchsia-500/28'
        case 'warning':
          return 'from-amber-500/50 via-yellow-400/35 to-orange-400/28'
        default:
          return 'from-sky-500/45 via-cyan-500/28 to-indigo-500/28'
      }
    }
    // Default colors based on mood
    if (mood === 'triumph') return 'from-amber-400/45 via-orange-400/25 to-yellow-300/30'
    if (mood === 'loading') return 'from-sky-400/45 via-cyan-400/25 to-teal-400/35'
    if (mood === 'warning') return 'from-amber-500/45 via-yellow-400/30 to-orange-400/30'
    if (mood === 'error') return 'from-rose-500/45 via-red-500/30 to-fuchsia-500/25'
    if (mood === 'focus') return 'from-teal-400/45 via-cyan-400/25 to-sky-400/30'
    return 'from-cyan-400/35 via-indigo-500/20 to-teal-400/30'
  })()

  const borderColor = (() => {
    if (externalEventSource === 'toast' && externalEventToastType) {
      switch (externalEventToastType) {
        case 'success': return 'border-emerald-400/70'
        case 'error': return 'border-rose-400/60'
        case 'warning': return 'border-amber-400/65'
        default: return 'border-sky-400/65'
      }
    }
    // Default based on mood
    if (mood === 'triumph') return 'border-amber-300/60'
    if (mood === 'loading') return 'border-cyan-300/50'
    if (mood === 'warning') return 'border-amber-300/60'
    if (mood === 'error') return 'border-rose-300/60'
    if (mood === 'focus') return 'border-teal-300/60'
    return 'border-cyan-200/45'
  })()

  return (
    <div className="relative shrink-0">
      <div
        ref={glowRef}
        className={`absolute -inset-2 rounded-full bg-gradient-to-br ${glowColors} blur-lg`}
      />
      <div
        ref={orbRef}
        className={`relative overflow-visible rounded-full border ${borderColor} bg-[#101722]/93 shadow-[0_10px_28px_rgba(0,0,0,0.42)] flex items-center justify-center`}
        style={{ width: size, height: size }}
      >
        <div
          ref={iconRef}
          key={`${mood}-${externalEventSource === 'toast' ? externalEventToastType ?? 't' : 'nav'}`}
          className="relative flex items-center justify-center overflow-visible"
        >
          {petVisible && (
            <GuardDhPet
              emotion={petEmotion}
              size={petSize}
              toastGlanceSignal={toastGlanceKey}
              toastGlanceDirection={toastGlanceDirection || 'below'}
              aiMindState={petAiMindState}
            />
          )}
           {petVisible && externalEventSource !== 'toast' && guideLlmThinking && (
             <GuidePetMoodEyesOverlay mood={(petMood ?? 'neutral') as GuidePetMood} isThinking size={petSize} />
           )}
          {petVisible && mood === 'loading' && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 rounded-full">
              <BrandSpinner size={isSidebar ? 24 : size <= 50 ? 18 : 22} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}