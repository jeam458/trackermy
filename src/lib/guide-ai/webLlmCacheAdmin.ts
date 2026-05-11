'use client'

/**
 * Limpieza de pesos WebLLM (IndexedDB / Cache según @mlc-ai/web-llm) + reinicio del bootstrap de app.
 * Usar tras cambiar `NEXT_PUBLIC_GUIDE_LLM_MODEL` o para limpiar pesos viejos del catálogo MLC.
 */

import { deleteModelAllInfoInCache } from '@mlc-ai/web-llm'
import {
  defaultGuideModelChain,
  MLC_DEEPSEEK_DISTILL_7B,
  MLC_GEMMA_2_2B,
  MLC_LLAMA_MINI,
  MLC_PHI_4_MINI,
  MLC_QWEN_MINI,
  MLC_SMOLLM2_360M,
} from '@/lib/guide-ai/guideModelDefaults'

function allCandidateModelIds(): string[] {
  return [
    ...new Set([
      ...defaultGuideModelChain(),
      MLC_QWEN_MINI,
      MLC_LLAMA_MINI,
      MLC_DEEPSEEK_DISTILL_7B,
      MLC_PHI_4_MINI,
      MLC_SMOLLM2_360M,
      MLC_GEMMA_2_2B,
    ]),
  ]
}

export type PurgeWebLlmModelsResult = {
  ok: boolean
  removedIds: string[]
  failed: Array<{ id: string; message: string }>
}

/** Borra tensores + wasm + config en caché para cada id conocido de la cadena guía. */
export async function purgeGuideModelCachesWebLlm(): Promise<PurgeWebLlmModelsResult> {
  const ids = allCandidateModelIds()
  const removedIds: string[] = []
  const failed: Array<{ id: string; message: string }> = []
  for (const id of ids) {
    try {
      await deleteModelAllInfoInCache(id)
      removedIds.push(id)
    } catch (e) {
      failed.push({ id, message: e instanceof Error ? e.message : String(e) })
    }
  }
  return { ok: failed.length === 0, removedIds, failed }
}

/** Purga WebLLM, libera motor en memoria y borra flag de bootstrap para que al recargar se descargue de nuevo. */
export async function resetGuideModelsAndBootstrap(): Promise<PurgeWebLlmModelsResult> {
  const { clearBootstrapDoneFlag } = await import('@/lib/runtimeBootstrap')
  const { resetGuideLlmEngineCache } = await import('@/lib/guide-ai/lightweightGuideLlm')
  const result = await purgeGuideModelCachesWebLlm()
  resetGuideLlmEngineCache()
  await clearBootstrapDoneFlag()
  return result
}
