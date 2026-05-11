import { z } from 'zod'
import seed from '@/lib/guide-ai/coachKnowledgeTree.seed.json'
import type {
  CoachKnowledgeEvidencePacket,
  CoachKnowledgeNode,
  CoachKnowledgePromptNode,
} from '@/lib/guide-ai/coachKnowledgeTree.types'

const EvidenceSchema = z.object({
  strength: z.enum(['literature_synthesis', 'practice_consensus', 'program_design_meta']),
  citation_label_es: z.string().min(1),
  source_url: z.string().nullable().optional(),
})

const NodeSchema = z.object({
  id: z.string().min(1),
  parent_id: z.string().nullable(),
  level: z.number().int().min(1).max(8),
  title_es: z.string().min(1),
  summary_es: z.string().min(1),
  practice_cues_es: z.array(z.string()),
  tags: z.array(z.string()),
  evidence: EvidenceSchema,
})

const TreeSchema = z.object({
  version: z.number().int().nonnegative(),
  nodes: z.array(NodeSchema),
})

function validateParentLinks(nodes: CoachKnowledgeNode[]): void {
  const ids = new Set(nodes.map((n) => n.id))
  for (const n of nodes) {
    if (n.parent_id != null && !ids.has(n.parent_id)) {
      throw new Error(`coachKnowledgeTree: parent_id missing for ${n.id} → ${n.parent_id}`)
    }
  }
}

const parsed = TreeSchema.parse(seed)
validateParentLinks(parsed.nodes)

export const COACH_KNOWLEDGE_LIBRARY_VERSION = parsed.version
export const COACH_KNOWLEDGE_NODES: readonly CoachKnowledgeNode[] = parsed.nodes

function toPromptNode(n: CoachKnowledgeNode): CoachKnowledgePromptNode {
  const maxSummary = 280
  const summary =
    n.summary_es.length > maxSummary ? `${n.summary_es.slice(0, maxSummary - 1)}…` : n.summary_es
  return {
    id: n.id,
    parent_id: n.parent_id,
    level: n.level,
    title_es: n.title_es,
    summary_es: summary,
    practice_cues_es: n.practice_cues_es.slice(0, 3),
    evidence_strength: n.evidence.strength,
    citation_label_es: n.evidence.citation_label_es,
    source_url: n.evidence.source_url ?? null,
  }
}

function addAncestors(parentId: string | null, all: CoachKnowledgeNode[], out: Set<string>) {
  let pid = parentId
  while (pid) {
    out.add(pid)
    const par = all.find((n) => n.id === pid)
    pid = par?.parent_id ?? null
  }
}

/** Pantallas / modos donde conviene inyectar la biblioteca (evita inflar todos los prompts). */
function screenTagsForPathname(pathname: string): string[] {
  const p = pathname.toLowerCase()
  const tags: string[] = []
  if (p.includes('attempt-replay')) tags.push('replay_coach')
  if (p.includes('attempt-stats')) tags.push('attempt_stats')
  if (p.includes('/dashboard/activity')) tags.push('activity_coach')
  if (p.includes('/dashboard/routes/record')) tags.push('record_coach')
  return tags
}

export function shouldAttachCoachKnowledgeLibrary(input: {
  pathname: string
  eventType: string
  eventLabel?: string | null
}): boolean {
  const tags = screenTagsForPathname(input.pathname)
  if (!tags.length) return false
  if (tags.includes('activity_coach') && input.eventType !== 'data-refresh') return false
  return true
}

/**
 * Selecciona un subárbol compacto: cruza tags de pantalla con `coaching_lens` (si viene)
 * y prioriza nodos hoja más específicos.
 */
export function buildCoachKnowledgeEvidenceFromNodes(
  sourceNodes: readonly CoachKnowledgeNode[],
  input: {
    pathname: string
    eventType: string
    eventLabel?: string | null
    coachingLens?: string | null
    maxNodes?: number
  },
  knowledgeSource: 'database' | 'seed'
): CoachKnowledgeEvidencePacket | null {
  if (!shouldAttachCoachKnowledgeLibrary(input)) return null

  const screenTags = screenTagsForPathname(input.pathname)
  const lens = (input.coachingLens || '').trim()
  const required = new Set<string>([...screenTags])
  if (lens) required.add(lens)

  const all = [...sourceNodes]
  const scored = all
    .map((n) => ({
      n,
      hits: n.tags.filter((t) => required.has(t)).length,
    }))
    .filter((x) => x.hits > 0)

  scored.sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits
    return b.n.level - a.n.level
  })

  const maxNodes = Math.min(8, Math.max(3, input.maxNodes ?? 5))
  const picked = new Set<string>()
  for (const { n } of scored.slice(0, maxNodes)) {
    picked.add(n.id)
    addAncestors(n.parent_id, all, picked)
  }

  const ordered = all.filter((n) => picked.has(n.id)).sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))

  return {
    knowledge_library_version: COACH_KNOWLEDGE_LIBRARY_VERSION,
    knowledge_source: knowledgeSource,
    usage_hint_es:
      'Enlazá como máximo UNA idea de estos nodos al dato del rider; citá la evidencia con humildad (strength). No afirmes resultados garantizados ni datos que no estén en el resumen.',
    nodes: ordered.map(toPromptNode),
  }
}

/** Variante con seed embebido (p. ej. tests o cuando el contexto no trae nodos de BD). */
export function buildCoachKnowledgeEvidenceForPrompt(input: {
  pathname: string
  eventType: string
  eventLabel?: string | null
  coachingLens?: string | null
  maxNodes?: number
}): CoachKnowledgeEvidencePacket | null {
  return buildCoachKnowledgeEvidenceFromNodes(COACH_KNOWLEDGE_NODES, input, 'seed')
}
