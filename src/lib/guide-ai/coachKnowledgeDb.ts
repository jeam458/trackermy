import type { SupabaseClient } from '@supabase/supabase-js'
import type { CoachEvidenceStrength, CoachKnowledgeNode } from '@/lib/guide-ai/coachKnowledgeTree.types'

type CoachKnowledgeDbRow = {
  id: string
  parent_id: string | null
  level: number
  title_es: string
  summary_es: string
  practice_cues: unknown
  tags: string[] | null
  evidence_strength: string
  citation_label_es: string
  source_url: string | null
}

function isEvidenceStrength(s: string): s is CoachEvidenceStrength {
  return s === 'literature_synthesis' || s === 'practice_consensus' || s === 'program_design_meta'
}

export function mapCoachKnowledgeDbRow(row: CoachKnowledgeDbRow): CoachKnowledgeNode {
  const cues = Array.isArray(row.practice_cues) ? row.practice_cues.map((x) => String(x)) : []
  const strength = isEvidenceStrength(row.evidence_strength) ? row.evidence_strength : 'practice_consensus'
  return {
    id: row.id,
    parent_id: row.parent_id,
    level: row.level,
    title_es: row.title_es,
    summary_es: row.summary_es,
    practice_cues_es: cues,
    tags: Array.isArray(row.tags) ? row.tags : [],
    evidence: {
      strength,
      citation_label_es: row.citation_label_es,
      source_url: row.source_url ?? null,
    },
  }
}

/** Nodos activos desde Supabase (vacío si la tabla no existe o no hay filas). */
export async function fetchCoachKnowledgeNodesFromDb(supabase: SupabaseClient): Promise<CoachKnowledgeNode[]> {
  const { data, error } = await supabase
    .from('coach_knowledge_nodes')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
  if (error || !data?.length) return []
  return (data as CoachKnowledgeDbRow[]).map(mapCoachKnowledgeDbRow)
}
