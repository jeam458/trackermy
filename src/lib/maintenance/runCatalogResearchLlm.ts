import {
  MAINTENANCE_CATALOG_RESEARCH_SKILL_MARKDOWN,
  buildCatalogResearchUserPrompt,
  normalizeProposedPayload,
  type MaintenanceCatalogProposedPayload,
} from '@/lib/maintenance/catalogResearchSkill'

export type CatalogResearchLlmOk = { payload: MaintenanceCatalogProposedPayload; model: string }
export type CatalogResearchLlmErr = { error: string; detail?: string }

/**
 * Una pasada de OpenAI para llenar `proposed_payload` (servidor / worker).
 */
export async function runCatalogResearchLlm(row: {
  raw_brand: string
  raw_model: string | null
  raw_variant: string | null
  category_slug: string | null
  user_notes: string | null
}): Promise<CatalogResearchLlmOk | CatalogResearchLlmErr> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) {
    return { error: 'OPENAI_API_KEY no definida en el servidor.' }
  }

  const model = (
    process.env.MAINTENANCE_CATALOG_OPENAI_MODEL ||
    process.env.GUIDE_SERVER_OPENAI_MODEL ||
    'gpt-4o-mini'
  ).trim()

  const system = [
    MAINTENANCE_CATALOG_RESEARCH_SKILL_MARKDOWN,
    '',
    'Salida: un único objeto JSON válido (sin markdown).',
  ].join('\n')

  const user = buildCatalogResearchUserPrompt(row)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.22,
        max_tokens: 1400,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { error: `OpenAI HTTP ${res.status}`, detail: errText.slice(0, 400) }
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = String(data?.choices?.[0]?.message?.content || '').trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(content) as unknown
    } catch {
      return { error: 'JSON inválido en respuesta del modelo.', detail: content.slice(0, 200) }
    }

    const payload = normalizeProposedPayload(parsed)
    if (!payload) {
      return { error: 'Payload no pasó validación (schema_version / campos).', detail: content.slice(0, 300) }
    }

    return { payload, model }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error OpenAI' }
  }
}
