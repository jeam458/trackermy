import type { PetAmbientRecipe, PetEnterRecipe } from '@/lib/pet/petEmotionAnimationRecipe'
import type { PetProceduralFacePartial } from '@/lib/pet/petProceduralFaceRecipe'

/** Fila `pet_emotion_definitions` ya validada en API/cliente. */
export type PetEmotionRegistryEntry = {
  slug: string
  labelEs: string
  ambient: PetAmbientRecipe | null
  enter: PetEnterRecipe | null
  rostro: { focusX: number; focusY: number; zoom: number } | null
  atlasSlot: number | null
  /** Parcial desde `procedural_face` JSONB; se fusiona con catálogo embebido por `slug`. */
  proceduralFace: PetProceduralFacePartial | null
}
