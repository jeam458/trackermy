/**
 * ## Configuración única del pet PATT (runtime)
 *
 * **Prioridad de renderer** (la primera activa gana; el resto queda en código muerto hasta el próximo flag):
 * 1. **`USE_PET_BRAND_SVG`** — `public/brand/pet.svg` inline + micro-anime por `data-gdh-part` (heurística bbox).
 * 2. **`USE_GUARD_DH_VECTOR_PET`** — cuerpo SVG placeholder + cara procedural (experimental; ver `guardDhPetVectorMode.ts`).
 * 3. **PNG** — `ROSTRO_ATLAS_URL` (`guardDhPetRostroFrames`) + overlay procedural + sprite opcional.
 *
 * ---
 *
 * ### Checklist manual QA (por modo)
 *
 * **A. Brand SVG** (`USE_PET_BRAND_SVG = true`, vector y sprite en false)
 * - [ ] Dashboard: el pet carga sin flash roto; DevTools → `#gdh-brand-pet-svg` existe.
 * - [ ] Cambiar emoción (globo / navegación): wrap/face anime sin error consola.
 * - [ ] Una emoción con receta BD (`pet_emotions` + `PetEmotionRecipeProvider`): ambient/enter si aplica.
 * - [ ] Inspeccionar `path[data-gdh-part]` — boca/ojos razonables; si el arte cambia, retocar `petSvgPathParts`.
 *
 * **B. PNG retrato** (`USE_PET_BRAND_SVG = false`, `USE_GUARD_DH_VECTOR_PET = false`)
 * - [ ] Rostro PNG visible; foco `applyRostroFrame` coherente al cambiar slug.
 * - [ ] Overlay procedural (`PetProceduralExpressionOverlay`) si la receta lo pide.
 * - [ ] Toast glance en pupilas al disparar señal (si aplica en esa pantalla).
 *
 * **C. Vector placeholder** (`USE_GUARD_DH_VECTOR_PET = true`, brand SVG false)
 * - [ ] `GuardDhPetVectorAvatar` + `GuardDhPetBodySvg`; procedural desde BD.
 * - [ ] Comparar fidelidad con marca antes de activar en producción.
 *
 * **D. Sprite 7×3** (`USE_PET_ESTADOS_SPRITE_SHEET = true`) — hoy desaconsejado en comentarios de código.
 * - [ ] Celdas alineadas; si no, volver a `false` y retrato único.
 *
 * ---
 *
 * **Frontera producto** (no mezclar en el atlas):
 * - **Coach / espectro / biblioteca** → `guide-ai`, `guideCoachAttachments`, Supabase (`rider_coach_spectrum`, `coach_knowledge_nodes`).
 * - **Pet** → solo **refleja** `PetEmotion` + animaciones; la “inteligencia” de tono vive en el resolver y en la guía.
 */

/** SVG de marca servido desde `public/`. */
export const PET_BRAND_SVG_URL = '/brand/pet.svg'

/** Marca oficial vector en DOM (prioridad 1). Apagado: nuevo pet es raster en `PET_ROSTRO_SINGLE_URL`. */
export const USE_PET_BRAND_SVG = false

/**
 * Avatar vector “placeholder” (prioridad 2 si brand SVG está apagado).
 * @see `components/pet/petVector/guardDhPetVectorMode.ts` (deprecación / issue).
 */
export const USE_GUARD_DH_VECTOR_PET = false

/**
 * Lámina 7×3 de estados (prioridad 3 respecto al retrato único cuando brand/vector están apagados).
 * Frágil si el asset no coincide con `ALL_PET_EMOTIONS`; preferir retrato único hasta reexport limpio.
 */
export const USE_PET_ESTADOS_SPRITE_SHEET = false
