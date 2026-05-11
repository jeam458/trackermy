#!/usr/bin/env node
/**
 * Upsert de un nodo en coach_knowledge_nodes usando service_role (sin redeploy).
 *
 * Uso:
 *   GUIDE_COACH_ADMIN_SECRET=… NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     node scripts/coach-knowledge-upsert.mjs ./mi-nodo.json
 *
 * O contra la API (misma secret en header):
 *   curl -sS -X POST "$NEXT_PUBLIC_SITE_URL/api/admin/coach-knowledge-nodes" \
 *     -H "x-coach-admin-secret: $GUIDE_COACH_ADMIN_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d @mi-nodo.json
 *
 * Cuerpo JSON: ver tipo UpsertBody en `src/app/api/admin/coach-knowledge-nodes/route.ts`.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const file = process.argv[2]

if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
if (!file) {
  console.error('Uso: node scripts/coach-knowledge-upsert.mjs <archivo.json>')
  process.exit(1)
}

const raw = readFileSync(resolve(file), 'utf8')
const body = JSON.parse(raw)
const sb = createClient(url, key)

const row = {
  id: String(body.id || '').trim(),
  parent_id: body.parent_id ?? null,
  level: Number.isFinite(body.level) ? Math.min(8, Math.max(1, Math.floor(body.level))) : 1,
  title_es: String(body.title_es || '').trim(),
  summary_es: String(body.summary_es || '').trim(),
  practice_cues: Array.isArray(body.practice_cues) ? body.practice_cues : [],
  tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
  evidence_strength: String(body.evidence_strength || 'practice_consensus'),
  citation_label_es: String(body.citation_label_es || 'Síntesis interna GuardDH.').trim(),
  source_url: body.source_url ?? null,
  sort_order: Number.isFinite(body.sort_order) ? Math.floor(body.sort_order) : 0,
  is_active: body.is_active !== false,
  updated_at: new Date().toISOString(),
}

if (!row.id || !row.title_es || !row.summary_es) {
  console.error('JSON inválido: id, title_es y summary_es son obligatorios.')
  process.exit(1)
}

const { error } = await sb.from('coach_knowledge_nodes').upsert(row, { onConflict: 'id' })
if (error) {
  console.error(error.message)
  process.exit(1)
}
console.log('OK', row.id)
