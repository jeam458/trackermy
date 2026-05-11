/**
 * Recetas embebidas por `PetEmotion` (mismo comportamiento que antes en `guardDhPetAnime`).
 * Nuevas emociones o variantes: preferí cargarlas desde BD (`pet_emotion_definitions`) sin tocar este archivo.
 */
import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import type { PetAmbientRecipe, PetEnterRecipe } from '@/lib/pet/petEmotionAnimationRecipe'

function glowKeyframes(rgb: string): string[] {
  return [
    `0 0 0 0 rgba(${rgb},0)`,
    `0 0 18px 4px rgba(${rgb},0.45)`,
    `0 0 0 0 rgba(${rgb},0)`,
  ]
}

const breathe: PetAmbientRecipe['tracks'] = [
  {
    target: 'wrap',
    tween: {
      prop: 'scale',
      keyframes: [1, 1.035, 1],
      duration: 2100,
      ease: 'inOutSine',
      loop: true,
    },
  },
]

const AMBIENT: Record<PetEmotion, PetAmbientRecipe> = {
  principal: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -6.5, 0], duration: 2000, ease: 'inOutSine', loop: true },
      },
      {
        target: 'wrap',
        tween: { prop: 'scale', keyframes: [1, 1.05, 1], duration: 1980, ease: 'inOutSine', loop: true },
      },
    ],
  },
  fin_ruta: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -5.5, 0], duration: 2000, ease: 'inOutSine', loop: true },
      },
      ...breathe,
    ],
  },
  datos_guardados: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -5.5, 0], duration: 2000, ease: 'inOutSine', loop: true },
      },
      ...breathe,
    ],
  },
  saludo: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -5, 0], duration: 1850, ease: 'inOutSine', loop: true },
      },
      {
        target: 'face',
        tween: {
          prop: 'rotate',
          keyframes: ['0deg', '4.5deg', '-3.5deg', '0deg'],
          duration: 2200,
          ease: 'inOutSine',
          loop: true,
        },
      },
    ],
  },
  inicio_ruta: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -7, 0], duration: 1500, ease: 'inOutSine', loop: true },
      },
      {
        target: 'face',
        tween: {
          prop: 'rotate',
          keyframes: ['0deg', '6deg', '-5deg', '0deg'],
          duration: 2400,
          ease: 'inOutSine',
          loop: true,
        },
      },
    ],
  },
  espera_sincronizacion: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -3, 0], duration: 2800, ease: 'inOutSine', loop: true },
      },
      {
        target: 'wrap',
        tween: {
          prop: 'rotate',
          keyframes: ['-2deg', '2deg', '-2deg'],
          duration: 3200,
          ease: 'inOutSine',
          loop: true,
        },
      },
    ],
  },
  ayuda_exitosa_fiesta: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -8, 0], duration: 1150, ease: 'inOutSine', loop: true },
      },
      {
        target: 'wrap',
        tween: {
          prop: 'scale',
          keyframes: [1, 1.07, 1],
          duration: 900,
          ease: 'outQuad',
          loop: true,
        },
      },
      {
        target: 'wrap',
        tween: {
          prop: 'rotate',
          keyframes: ['0deg', '-5deg', '5deg', '0deg'],
          duration: 900,
          ease: 'outQuad',
          loop: true,
        },
      },
    ],
  },
  conexion_perdida: {
    tracks: [
      {
        target: 'face',
        tween: { prop: 'opacity', keyframes: [1, 0.55, 1], duration: 260, ease: 'linear', loop: true },
      },
      {
        target: 'face',
        tween: { prop: 'x', keyframes: [-2, 2, -2], duration: 90, ease: 'linear', loop: true },
      },
    ],
  },
  recuperando: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -2.5, 0], duration: 3200, ease: 'inOutSine', loop: true },
      },
      {
        target: 'wrap',
        tween: {
          prop: 'boxShadow',
          keyframes: glowKeyframes('45,212,191'),
          duration: 2200,
          ease: 'inOutSine',
          loop: true,
        },
      },
    ],
  },
  cansado: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -1.5, 0], duration: 4200, ease: 'inOutQuad', loop: true },
      },
      {
        target: 'face',
        tween: {
          prop: 'rotate',
          keyframes: ['-1.5deg', '1.5deg', '-1.5deg'],
          duration: 3800,
          ease: 'inOutSine',
          loop: true,
        },
      },
    ],
  },
  cansado_flor: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -1.5, 0], duration: 4200, ease: 'inOutQuad', loop: true },
      },
      {
        target: 'face',
        tween: {
          prop: 'rotate',
          keyframes: ['-1.5deg', '1.5deg', '-1.5deg'],
          duration: 3800,
          ease: 'inOutSine',
          loop: true,
        },
      },
    ],
  },
  exhausto: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -1.5, 0], duration: 4200, ease: 'inOutQuad', loop: true },
      },
      {
        target: 'face',
        tween: {
          prop: 'rotate',
          keyframes: ['-1.5deg', '1.5deg', '-1.5deg'],
          duration: 3800,
          ease: 'inOutSine',
          loop: true,
        },
      },
    ],
  },
  exhausto_total: {
    wrapStyle: { filter: 'grayscale(0.85) brightness(0.92)' },
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'opacity', keyframes: [0.88, 1, 0.88], duration: 3600, ease: 'inOutSine', loop: true },
      },
    ],
  },
  confusion_error: {
    tracks: [
      {
        target: 'wrap',
        tween: {
          prop: 'rotate',
          keyframes: ['-4deg', '4deg', '-4deg'],
          duration: 1900,
          ease: 'inOutSine',
          loop: true,
        },
      },
      {
        target: 'face',
        tween: { prop: 'x', keyframes: [0, -1, 1, 0], duration: 400, ease: 'inOutQuad', loop: true },
      },
    ],
  },
  pensando_mapa: {
    tracks: [
      {
        target: 'wrap',
        tween: {
          prop: 'rotate',
          keyframes: ['-3.8deg', '3.8deg', '-3.8deg'],
          duration: 4400,
          ease: 'inOutSine',
          loop: true,
        },
      },
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -3.8, 0], duration: 2500, ease: 'inOutSine', loop: true },
      },
    ],
  },
  pensando_minimal: {
    tracks: [
      {
        target: 'wrap',
        tween: {
          prop: 'rotate',
          keyframes: ['-3.8deg', '3.8deg', '-3.8deg'],
          duration: 4400,
          ease: 'inOutSine',
          loop: true,
        },
      },
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -3.8, 0], duration: 2500, ease: 'inOutSine', loop: true },
      },
    ],
  },
  bateria_baja: {
    tracks: [
      {
        target: 'wrap',
        tween: {
          prop: 'boxShadow',
          keyframes: glowKeyframes('248,113,113'),
          duration: 2600,
          ease: 'inOutSine',
          loop: true,
        },
      },
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -2, 0], duration: 3400, ease: 'inOutSine', loop: true },
      },
    ],
  },
  velocidad_critica: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'x', keyframes: [0, -1.5, 1.5, 0], duration: 160, ease: 'linear', loop: true },
      },
      {
        target: 'face',
        tween: { prop: 'scale', keyframes: [1, 1.03, 1], duration: 280, ease: 'outQuad', loop: true },
      },
    ],
  },
  vinculo_tiempo: {
    tracks: [
      {
        target: 'wrap',
        tween: {
          prop: 'rotate',
          keyframes: ['-3deg', '3deg', '-3deg'],
          duration: 2400,
          ease: 'inOutSine',
          loop: true,
        },
      },
      {
        target: 'wrap',
        tween: { prop: 'y', keyframes: [0, -3, 0], duration: 3000, ease: 'inOutSine', loop: true },
      },
    ],
  },
  molesto: {
    tracks: [
      {
        target: 'wrap',
        tween: {
          prop: 'boxShadow',
          keyframes: glowKeyframes('249,115,22'),
          duration: 1400,
          ease: 'inOutSine',
          loop: true,
        },
      },
      {
        target: 'wrap',
        tween: { prop: 'x', keyframes: [0, -2.5, 2.5, 0], duration: 220, ease: 'inOutQuad', loop: true },
      },
    ],
  },
  obstaculo_detectado: {
    tracks: [
      {
        target: 'wrap',
        tween: { prop: 'scale', keyframes: [1, 1.06, 1], duration: 450, ease: 'outQuad', loop: true },
      },
    ],
  },
}

const DEFAULT_AMBIENT: PetAmbientRecipe = {
  tracks: [
    {
      target: 'wrap',
      tween: { prop: 'y', keyframes: [0, -3, 0], duration: 2600, ease: 'inOutSine', loop: true },
    },
  ],
}

export function getBuiltinAmbientRecipe(emotion: PetEmotion): PetAmbientRecipe {
  return AMBIENT[emotion] ?? DEFAULT_AMBIENT
}

const ENTER_DEFAULT: PetEnterRecipe = {
  tracks: [
    {
      target: 'face',
      tween: {
        prop: 'scale',
        keyframes: [1, 1.1, 1],
        duration: 400,
        ease: 'outCubic',
      },
    },
    {
      target: 'face',
      tween: {
        prop: 'rotate',
        keyframes: ['0deg', '5deg', '0deg'],
        duration: 400,
        ease: 'outCubic',
      },
    },
  ],
}

const ENTER_SPECIAL: Partial<Record<PetEmotion, PetEnterRecipe>> = {
  ayuda_exitosa_fiesta: {
    tracks: [
      {
        target: 'face',
        tween: {
          prop: 'scale',
          keyframes: [1, 1.18, 1],
          duration: 520,
          ease: 'outCubic',
        },
      },
      {
        target: 'face',
        tween: {
          prop: 'rotate',
          keyframes: ['0deg', '10deg', '0deg'],
          duration: 520,
          ease: 'outCubic',
        },
      },
    ],
  },
  conexion_perdida: {
    tracks: [
      {
        target: 'face',
        tween: {
          prop: 'scale',
          keyframes: [1, 0.94, 1.02, 1],
          duration: 380,
          ease: 'inOutQuad',
        },
      },
    ],
  },
  molesto: {
    tracks: [
      {
        target: 'face',
        tween: {
          prop: 'rotate',
          keyframes: ['0deg', '-5deg', '5deg', '-3deg', '0deg'],
          duration: 360,
          ease: 'outQuad',
        },
      },
    ],
  },
  principal: {
    tracks: [
      {
        target: 'face',
        tween: { prop: 'scale', keyframes: [1, 1.06, 1], duration: 480, ease: 'outCubic' },
      },
    ],
  },
}

export function getBuiltinEnterRecipe(emotion: PetEmotion): PetEnterRecipe {
  return ENTER_SPECIAL[emotion] ?? ENTER_DEFAULT
}
