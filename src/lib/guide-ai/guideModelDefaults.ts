/**
 * IDs del catálogo MLC (`node_modules/@mlc-ai/web-llm`, `prebuiltAppConfig`).
 *
 * Por defecto la app usa **Qwen 0.5B** si no definís `NEXT_PUBLIC_GUIDE_LLM_MODEL` (liviano, menos de ~1 GB).
 * Podés fijar otro `model_id` del mismo `prebuiltAppConfig` (p. ej. `MLC_PHI_4_MINI`, `MLC_LLAMA_MINI`).
 *
 * ### Modelos ligeros (misma app, menos VRAM / descarga)
 * Orden aproximado “más liviano → más capaz” para la guía (JSON corto + español):
 * - `MLC_SMOLLM2_360M` — extremadamente chico; pruebas o dispositivos muy justos.
 * - `MLC_QWEN_MINI` — 0.5B; equilibrio peso / instruct (default).
 * - `MLC_LLAMA_MINI` — 1.1B; instruct estable.
 * - `MLC_PHI_4_MINI` — ~3.8B instruct Microsoft.
 * - `MLC_GEMMA_2_2B` — 2B Google.
 * - `Hermes-3-Llama-3.2-3B-q4f16_1-MLC` — 3B en catálogo SDK.
 *
 * Opcional catálogo (más pesado): `MLC_DEEPSEEK_DISTILL_7B`, etc.
 */
export const MLC_DEEPSEEK_DISTILL_1_5B = 'DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC' as const
/** DeepSeek R1 Distill presente en el catálogo prebuilt del SDK actual (más pesado que 1.5B). */
export const MLC_DEEPSEEK_DISTILL_7B = 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC' as const
export const MLC_QWEN_MINI = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' as const
export const MLC_LLAMA_MINI = 'Llama-3.2-1B-Instruct-q4f16_1-MLC' as const
/** Microsoft Phi-4 mini instruct (~3.8B), q4f16; buen candidato “ligero pero serio” vs 7B. */
export const MLC_PHI_4_MINI = 'Phi-4-mini-instruct-q4f16_1-MLC' as const
/** Hugging Face SmolLM2 360M; el más chico útil del catálogo para smoke tests. */
export const MLC_SMOLLM2_360M = 'SmolLM2-360M-Instruct-q4f16_1-MLC' as const
/** Gemma 2 2B instruct; intermedio entre 1B y Phi mini. */
export const MLC_GEMMA_2_2B = 'gemma-2-2b-it-q4f16_1-MLC' as const

/**
 * Copiloto / pet: sin env, default **Qwen 0.5B** (`MLC_QWEN_MINI`).
 * Cadena: primario → fallback env → Qwen mini → Llama mini (deduplicada).
 */
export function defaultGuideModelChain(): string[] {
  const primary = (process.env.NEXT_PUBLIC_GUIDE_LLM_MODEL || MLC_QWEN_MINI).trim()
  const fallbackEnv = (process.env.NEXT_PUBLIC_GUIDE_LLM_FALLBACK_MODEL || '').trim()
  const secondary = fallbackEnv || primary
  return [...new Set([primary, secondary, MLC_QWEN_MINI, MLC_LLAMA_MINI].filter(Boolean))]
}

/** Coach de estadísticas: alinea con guía (`NEXT_PUBLIC_GUIDE_LLM_MODEL` o default Qwen). */
export function defaultCoachModelChain(): string[] {
  const primary = (
    process.env.NEXT_PUBLIC_LOCAL_COACH_MODEL ||
    process.env.NEXT_PUBLIC_GUIDE_LLM_MODEL ||
    MLC_QWEN_MINI
  ).trim()
  const coachFb = (process.env.NEXT_PUBLIC_LOCAL_COACH_FALLBACK_MODEL || '').trim()
  const guideFb = (process.env.NEXT_PUBLIC_GUIDE_LLM_FALLBACK_MODEL || '').trim()
  const secondary = coachFb || guideFb || primary
  return [...new Set([primary, secondary, MLC_QWEN_MINI, MLC_LLAMA_MINI].filter(Boolean))]
}

/** Bootstrap runtime: alinea descarga con el copiloto. */
export function defaultBootstrapModelChain(): string[] {
  return defaultGuideModelChain()
}
