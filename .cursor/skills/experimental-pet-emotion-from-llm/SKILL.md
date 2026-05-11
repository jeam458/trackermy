---
name: experimental-pet-emotion-from-llm
description: >-
  Flujo experimental trackermy: WebLLM (guía local) puede sugerir nuevas emociones del pet
  vía JSON `pet_emotion_proposal`; el cliente valida y envía `POST /api/dashboard/pet-emotions`
  a `pet_emotion_proposals`. Usar cuando se depura el flag NEXT_PUBLIC_GUIDE_PET_EMOTION_PROPOSALS,
  el prompt en `guidePromptBuild.ts`, `experimentalPetEmotionFromLlm.ts`, o el merge SQL a
  `pet_emotion_definitions`.
disable-model-invocation: true
---

# experimental-pet-emotion-from-llm (trackermy)

## Parámetros de producto (activación)

| Parámetro | Valor | Efecto |
|-----------|--------|--------|
| `NEXT_PUBLIC_GUIDE_PET_EMOTION_PROPOSALS` | `1` | Activa el bloque de prompt experimental y el envío automático tras cada respuesta JSON del WebLLM en `generateGuideReactionWithLightLlm`. Cualquier otro valor o ausencia: desactivado. |

Definir en `.env.local` (o variables del host de build) y reiniciar `next dev`.

## Contrato JSON (modelo → app)

El modelo añade **opcionalmente** en el **mismo** objeto de reacción:

```json
"pet_emotion_proposal": {
  "slug": "mirada_amarga",
  "label_es": "Mirada amarga",
  "ambient_animations": {
    "tracks": [
      { "target": "wrap", "tween": { "prop": "y", "keyframes": [0, -4, 0], "duration": 2000, "ease": "inOutSine", "loop": true } }
    ],
    "wrapStyle": { "filter": "grayscale(0.3)" }
  },
  "enter_animation": { "tracks": [...] },
  "focus_x": 50,
  "focus_y": 44,
  "zoom": 1.32,
  "atlas_slot": null
}
```

- **slug**: `^[a-z][a-z0-9_]{1,62}$` (minúsculas).
- **ambient_animations**: debe pasar `parseAmbientRecipe` (`tracks` 1–8, props y easings en lista blanca en `petEmotionAnimationRecipe.ts`).
- **enter_animation**: opcional; `parseEnterRecipe`.
- La app **no** muestra el slug nuevo en el atlas hasta que exista merge a `pet_emotion_definitions` y el flujo UI acepte ese slug (hoy el tipo `PetEmotion` sigue siendo union cerrada para el rostro).

## Pipeline runtime

1. `buildGuideNarrationFullPrompt` inyecta la regla experimental si el flag está en `1`.
2. WebLLM devuelve JSON; `lightweightGuideLlm` parsea y llama `maybeSubmitPetEmotionProposalFromLlm` (fire-and-forget, no bloquea la guía).
3. `POST /api/dashboard/pet-emotions` valida y escribe en `pet_emotion_proposals` (`status: pending`).

## Depuración gradual

- Revisar Supabase: filas en `pet_emotion_proposals`, errores 400 en red (slug / receta inválida).
- Reducir ruido: afinar el texto del prompt para “solo si matiz nuevo, no cada turno”.
- Merge manual (o futuro admin): copiar fila aprobada a `pet_emotion_definitions` con `approved = true`.

## Límites de seguridad

- No ejecutar código desde la BD: solo recetas declarativas ya validadas.
- No promover a `definitions` sin revisión humana o rol de servicio controlado.
