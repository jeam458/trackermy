import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import { mapGuideMoodToPetEmotion } from '@/components/pet/mapGuideToPetEmotion'
import { resolveDashboardPetEmotion } from '@/components/pet/navigationPetEmotion'
import { mapGuidePetMoodToPetEmotion, type GuidePetMood } from '@/lib/pet/guidePetBridge'
import type { RiderGuideMood } from '@/lib/riderGuide'

/**
 * ## Cómo se decide la emoción del atlas en el dashboard (y qué hace la BD / la IA)
 *
 * **Capa 0 — Estado afectivo unificado (`GuideWorldStateController` + catálogo `GUIDE_APP_TRIGGER_META`)**  
 * Cada disparador relevante (nav, replay, click, sistema, turnos coach) se registra con
 * `ingestTrigger` / `ingestAppTrigger` y viaja en `affective_world.last_app_trigger` / `recent_app_triggers`. El prompt
 * incluye `situation_tags`, `emotion_candidate_slugs` y `last_trigger_meta` para alinear tono y
 * `pet_mood` con la causa real.
 *
 * **Capa 1 — IA local (WebLLM)**  
 * Cuando corre `generateGuideReactionWithLightLlm`, el modelo puede devolver `pet_mood`
 * (`neutral` | `happy` | `analyzing` | `warning` | `stoked`). Eso pasa por
 * `finalizeGuideReaction` → `publishGuidePetMood` + merge con MCP/ruta (`lightweightGuideLlm.ts`).
 * El skill (`humanInteractionSkill.ts` → `PET_VISUAL_BRIDGE`) y el protocolo (`guideProtocol.ts`)
 * instruyen **qué** debe expresar el pet en esos turnos.
 *
 * **Capa 2 — Heurísticas y turnos “sistema”**  
 * Replay y algunos anti-spam siguen sin modelo. **GPS y red (con sesión)** disparan turnos WebLLM
 * (`data-refresh` + `system:gps_*` / `system:network_*`) para `mood` + `pet_mood`; si no hay motor o
 * falla la inferencia, el dashboard usa fallback fijo. El humor del globo (`RiderGuideMood`) y el
 * `petMood` del store se mezclan según la precedencia de abajo.
 *
 * **Capa 3 — Base de datos (`pet_emotion_definitions`)**  
 * No elige *qué slug* mostrar en cada click: define **cómo** se ve y anima cada slug cargado
 * (recetas `ambient`/`enter`, `focus_*`/`zoom`, `procedural_face`). El cliente fusiona BD + catálogo
 * embebido (`PetEmotionRecipeContext`, `resolveProceduralFaceRecipe`).
 *
 * **Experimental**  
 * Propuestas de nuevas emociones / recetas → `pet_emotion_proposals` (`experimentalPetEmotionFromLlm.ts`).
 *
 * Si en el futuro el modelo devuelve un `pet_emotion_slug` acotado a filas aprobadas en BD,
 * se puede extender esta resolución sin otro “parche” disperso en la UI.
 */

export type DashboardPetAtlasInput = {
  pathname: string
  riderMood: RiderGuideMood
  /** `externalEvent.source` del globo (p. ej. `toast`, `navigation`, `manual`). */
  guideBubbleSource: string | null | undefined
  /** Snapshot del store del puente pet (viene del último LLM / replay / publicación manual). */
  guidePetMood: GuidePetMood | null
}

/**
 * Resuelve el **slug de atlas** (`PetEmotion`) para el orbe del rider.
 * Mantener toda la precedencia aquí; no duplicar reglas en componentes.
 */
export function resolveDashboardPetAtlasEmotion(input: DashboardPetAtlasInput): PetEmotion {
  const { pathname, riderMood, guideBubbleSource, guidePetMood } = input

  if (riderMood === 'loading') return 'pensando_minimal'

  if (guideBubbleSource === 'toast') {
    return mapGuideMoodToPetEmotion(riderMood)
  }

  if (riderMood !== 'guide') {
    return mapGuideMoodToPetEmotion(riderMood)
  }

  const navEmotion = resolveDashboardPetEmotion(pathname, riderMood)
  if (!guidePetMood) return navEmotion

  if (guidePetMood === 'warning' || guidePetMood === 'stoked') {
    return mapGuidePetMoodToPetEmotion(guidePetMood)
  }

  return navEmotion
}
