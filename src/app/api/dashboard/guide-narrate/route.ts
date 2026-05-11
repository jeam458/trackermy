import { NextResponse } from 'next/server'
import { buildGuideNarrationFullPrompt } from '@/lib/guide-ai/guidePromptBuild'
import type { GuideContext, GuideReaction, GuideSessionReplaySignal, GuideUiEvent } from '@/lib/guide-ai/types'
import type { RiderGuideMood } from '@/lib/riderGuide'

const MOODS: RiderGuideMood[] = ['guide', 'focus', 'triumph', 'fatigue', 'warning', 'error']

/**
 * Narración guía en **servidor** (dispositivos sin WebGPU / fallback de calidad).
 *
 * - `OPENAI_API_KEY` en el entorno del servidor (nunca `NEXT_PUBLIC_`).
 * - `GUIDE_SERVER_OPENAI_MODEL` opcional (default `gpt-4o-mini`).
 * - Mismo prompt que WebLLM (`buildGuideNarrationFullPrompt`); **sin** ejecución MCP en servidor
 *   (el prompt pide `tool_requests` vacío para evitar fetch relativo sin sesión).
 */
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        code: 'NO_SERVER_LLM',
        message:
          'Narración servidor desactivada: definí OPENAI_API_KEY en el entorno del servidor (Vercel / .env local sin NEXT_PUBLIC).',
      },
      { status: 503 }
    )
  }

  let body: {
    context?: GuideContext
    event?: GuideUiEvent
    executeMcpTools?: boolean
    sessionReplaySignals?: GuideSessionReplaySignal[] | null
    affectiveAugment?: Record<string, unknown> | null
  }
  try {
    body = (await req.json()) as {
      context?: GuideContext
      event?: GuideUiEvent
      executeMcpTools?: boolean
      sessionReplaySignals?: GuideSessionReplaySignal[] | null
      affectiveAugment?: Record<string, unknown> | null
    }
  } catch {
    return NextResponse.json({ ok: false, code: 'BAD_JSON', message: 'Cuerpo JSON inválido.' }, { status: 400 })
  }
  if (!body.context?.pathname) {
    return NextResponse.json({ ok: false, code: 'MISSING_CONTEXT', message: 'Falta context.pathname.' }, { status: 400 })
  }

  const context = body.context
  const event: GuideUiEvent = body.event ?? {
    type: 'navigation',
    pathname: context.pathname,
    timestamp: Date.now(),
  }
  const executeMcpTools = false

  const model = (process.env.GUIDE_SERVER_OPENAI_MODEL || 'gpt-4o-mini').trim()
  const fullPrompt = buildGuideNarrationFullPrompt({
    context,
    event,
    executeMcpTools,
    sessionReplaySignals: body.sessionReplaySignals ?? null,
    affectiveAugment: body.affectiveAugment ?? null,
  })

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: fullPrompt }],
        temperature: 0.42,
        max_tokens: 360,
        presence_penalty: 0.55,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return NextResponse.json(
        {
          ok: false,
          code: 'OPENAI_HTTP',
          message: `OpenAI HTTP ${res.status}`,
          detail: errText.slice(0, 500),
        },
        { status: 502 }
      )
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = String(data?.choices?.[0]?.message?.content || '').trim()
    const m = content.match(/\{[\s\S]*\}/)
    if (!m) {
      return NextResponse.json(
        { ok: false, code: 'NO_JSON', message: 'La respuesta del modelo no contenía JSON de reacción.' },
        { status: 422 }
      )
    }
    const parsed = JSON.parse(m[0]) as Partial<GuideReaction>
    const mood: RiderGuideMood =
      parsed.mood && (MOODS as string[]).includes(parsed.mood) ? parsed.mood : 'guide'
    const title = String(parsed.title || 'Trail Buddy').slice(0, 48)
    const subtitle = String(parsed.subtitle || '').slice(0, 90)
    const duration =
      Number(parsed.duration) > 0 ? Math.min(9000, Math.max(2500, Math.floor(Number(parsed.duration)))) : 5200

    const reaction: GuideReaction = {
      mood,
      title,
      subtitle: subtitle || 'Seguimos cuando quieras.',
      duration,
    }
    return NextResponse.json({ ok: true, reaction, model })
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        code: 'OPENAI_ERROR',
        message: e instanceof Error ? e.message : 'Error al llamar a OpenAI.',
      },
      { status: 502 }
    )
  }
}
