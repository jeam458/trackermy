#!/usr/bin/env node
/**
 * Procesa cola `maintenance_catalog_research_requests` (pending → IA → proposed_payload).
 *
 * Requiere en el entorno del servidor / local:
 *   GUIDE_COACH_ADMIN_SECRET  (≥16 chars, mismo que coach-knowledge)
 *   NEXT_PUBLIC_SITE_URL      (ej. https://tu-app.vercel.app o http://localhost:3000)
 *   OPENAI_API_KEY            (servidor; el worker llama a OpenAI)
 *
 * Uso:
 *   GUIDE_COACH_ADMIN_SECRET=… NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
 *     node scripts/maintenance-catalog-research-run.mjs
 *
 * Opcional: ?limit=10 en la URL editando abajo.
 */
const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, '')
const secret = process.env.GUIDE_COACH_ADMIN_SECRET?.trim()

if (!site || !secret) {
  console.error('Faltan NEXT_PUBLIC_SITE_URL o GUIDE_COACH_ADMIN_SECRET.')
  process.exit(1)
}

const url = `${site}/api/admin/maintenance-catalog-research-run?limit=8`
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'x-coach-admin-secret': secret,
    'Content-Type': 'application/json',
  },
})
const body = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error(res.status, body)
  process.exit(1)
}
console.log(JSON.stringify(body, null, 2))
