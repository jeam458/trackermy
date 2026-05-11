/**
 * Biblioteca interna GuardDH: conocimiento de coaching en árbol (multi-nivel).
 * Los textos son síntesis / cues prácticos; `citation_label_es` describe el tipo de evidencia sin copiar papers.
 */
export type CoachEvidenceStrength =
  | 'literature_synthesis'
  | 'practice_consensus'
  | 'program_design_meta'

export type CoachKnowledgeEvidence = {
  strength: CoachEvidenceStrength
  /** Cómo presentar la fuente (p. ej. revisión, consenso técnico); no es cuerpo del paper. */
  citation_label_es: string
  source_url?: string | null
}

export type CoachKnowledgeNode = {
  id: string
  parent_id: string | null
  level: number
  title_es: string
  summary_es: string
  practice_cues_es: string[]
  /** Cruce con `coaching_lens`, pantalla o modo (p. ej. replay_coach, attempt_stats). */
  tags: string[]
  evidence: CoachKnowledgeEvidence
}

export type CoachKnowledgeTreeFile = {
  version: number
  nodes: CoachKnowledgeNode[]
}

/** Nodo compacto para el prompt del LLM (menos tokens). */
export type CoachKnowledgePromptNode = {
  id: string
  parent_id: string | null
  level: number
  title_es: string
  summary_es: string
  practice_cues_es: string[]
  evidence_strength: CoachEvidenceStrength
  citation_label_es: string
  source_url?: string | null
}

export type CoachKnowledgeEvidencePacket = {
  knowledge_library_version: number
  /** Origen del árbol inyectado en el turno (BD curada vs seed embebido). */
  knowledge_source?: 'database' | 'seed'
  /** Uso: máximo enlazar UNA idea de estos nodos al dato del rider en el turno. */
  usage_hint_es: string
  nodes: CoachKnowledgePromptNode[]
}
