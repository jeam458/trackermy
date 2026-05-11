/**
 * Coach IA local (on-device) usando WebLLM.
 * Ejecuta inferencia en cliente cuando el dispositivo lo soporta.
 */

import type { RideMentorReport } from '@/lib/rideMentorAnalysis'
import {
  COACH_OUTPUT_FORMAT,
  COACH_SKILL_RULES,
  COACH_SKILL_TECHNIQUE_BASE,
} from '@/lib/coach/coachSkillProtocol'
import {
  normalizeRouteIconKey,
  routeThemedIconKeysForPrompt,
  type RouteThemedIconKey,
} from '@/lib/routeThemedIcons'
import { defaultCoachModelChain } from '@/lib/guide-ai/guideModelDefaults'

export type LocalCoachContext = {
  routeName: string
  riderName: string
  totalTimeSec: number
  avgSpeedMps: number | null
  maxSpeedMps: number | null
  distanceM: number
  mentor: RideMentorReport
  percentile?: number | null
  bestTimeDiffSec?: number | null
}

let enginePromise: Promise<any> | null = null
let engineModelId: string | null = null

const ENGINE_INIT_TIMEOUT_MS = 45_000
const GENERATION_TIMEOUT_MS = 25_000
const ICON_PICK_TIMEOUT_MS = 18_000

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(message)), ms)
    p.then(
      (v) => {
        clearTimeout(id)
        resolve(v)
      },
      (e) => {
        clearTimeout(id)
        reject(e)
      }
    )
  })
}

function canRunLocalLlmInBrowser(): boolean {
  if (typeof window === 'undefined') return false
  // WebLLM depende principalmente de WebGPU; en muchos WebView móviles no está activo.
  const nav = navigator as Navigator & { gpu?: unknown }
  return !!nav.gpu
}

function coachModelChain(): string[] {
  return defaultCoachModelChain()
}

async function createEngine() {
  if (!canRunLocalLlmInBrowser()) {
    throw new Error('WebGPU no disponible en este dispositivo/WebView.')
  }
  const webllm = await import('@mlc-ai/web-llm')
  let lastErr: unknown = null
  for (const modelId of coachModelChain()) {
    try {
      const engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: () => {
          // Aquí podríamos exponer progreso a UI en una siguiente iteración.
        },
      })
      engineModelId = modelId
      return engine
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('No se pudo inicializar ningún modelo local')
}

async function getEngine() {
  if (!enginePromise) {
    enginePromise = withTimeout(
      createEngine(),
      ENGINE_INIT_TIMEOUT_MS,
      'Timeout inicializando modelo local.'
    )
  }
  return enginePromise
}

function formatTime(totalSec: number) {
  const mins = Math.floor(totalSec / 60)
  const secs = Math.floor(totalSec % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function getLocalCoachRuntimeInfo(): { webgpu: boolean; modelId: string | null } {
  return {
    webgpu: canRunLocalLlmInBrowser(),
    modelId: engineModelId,
  }
}

export async function generateLocalCoachAdvice(ctx: LocalCoachContext): Promise<string> {
  const engine = await getEngine()
  const avgKmh =
    ctx.avgSpeedMps != null && Number.isFinite(ctx.avgSpeedMps)
      ? (ctx.avgSpeedMps * 3.6).toFixed(1)
      : 'N/D'
  const maxKmh =
    ctx.maxSpeedMps != null && Number.isFinite(ctx.maxSpeedMps)
      ? (ctx.maxSpeedMps * 3.6).toFixed(1)
      : 'N/D'

  const prompt = [
    '[SKILL_RULES]',
    COACH_SKILL_RULES,
    '',
    '[BASE_TECNICA]',
    COACH_SKILL_TECHNIQUE_BASE,
    '',
    '[FORMATO_SALIDA]',
    COACH_OUTPUT_FORMAT,
    '',
    '[CONTEXTO]',
    `Rider: ${ctx.riderName}`,
    `Ruta: ${ctx.routeName}`,
    `Tiempo total: ${formatTime(ctx.totalTimeSec)}`,
    `Distancia: ${(ctx.distanceM / 1000).toFixed(2)} km`,
    `Velocidad media: ${avgKmh} km/h`,
    `Velocidad máxima: ${maxKmh} km/h`,
    `Consistencia: ${ctx.mentor.consistencyScore}/100`,
    `Paradas: ${ctx.mentor.stopEvents}`,
    `Velocidad media en bajada: ${ctx.mentor.avgDownhillSpeedKmh.toFixed(1)} km/h`,
    `Resumen técnico: ${ctx.mentor.summary}`,
    `Insights técnicos detectados: ${ctx.mentor.insights.map((x) => x.message).join(' | ') || 'sin alertas críticas'}`,
    `Percentil vs otros riders (si existe): ${ctx.percentile != null ? `${ctx.percentile.toFixed(0)}%` : 'N/D'}`,
    `Diferencia con mejor tiempo personal (seg): ${ctx.bestTimeDiffSec != null ? ctx.bestTimeDiffSec.toFixed(1) : 'N/D'}`,
  ].join('\n')

  const res = (await withTimeout(
    engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.45,
      max_tokens: 420,
    }),
    GENERATION_TIMEOUT_MS,
    'Timeout generando recomendaciones del coach local.'
  )) as any
  return String(res.choices?.[0]?.message?.content || '').trim()
}

/**
 * Elige una clave del catálogo de íconos temáticos (no genera SVG: solo clasifica la ruta).
 * Requiere WebGPU / WebLLM; en móviles muchas veces devolverá null.
 */
export async function pickRouteThemedIconKeyWithLocalLlm(input: {
  name: string
  description?: string
  difficulty: string
}): Promise<RouteThemedIconKey | null> {
  if (!canRunLocalLlmInBrowser()) return null
  try {
    const engine = await getEngine()
    const keys = routeThemedIconKeysForPrompt()
    const prompt = [
      'Eres experto en cultura andina, simbolismo prehispánico (sin inventar nombres fuera de la lista) y fauna de montaña.',
      `Elige exactamente UNA clave de esta lista (copia literal, con guiones bajos si los tiene): ${keys}.`,
      'Responde solo una línea JSON válida: {"key":"<clave>"} sin markdown ni texto adicional.',
      `Nombre de la ruta: ${input.name}`,
      `Descripción: ${input.description?.trim() || '—'}`,
      `Dificultad MTB: ${input.difficulty}`,
    ].join('\n')
    const res = (await withTimeout(
      engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 80,
      }),
      ICON_PICK_TIMEOUT_MS,
      'Timeout eligiendo ícono temático.'
    )) as any
    const text = String(res.choices?.[0]?.message?.content || '').trim()
    const m1 = text.match(/\{\s*"key"\s*:\s*"([^"]+)"\s*\}/)
    if (m1?.[1]) return normalizeRouteIconKey(m1[1])
    const m2 = text.match(/"key"\s*:\s*"([^"]+)"/)
    if (m2?.[1]) return normalizeRouteIconKey(m2[1])
    const m3 = text.match(/"([a-z][a-z0-9_]*)"/i)
    if (m3?.[1]) return normalizeRouteIconKey(m3[1])
  } catch {
    /* noop */
  }
  return null
}

