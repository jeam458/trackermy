import { timingSafeEqual } from 'node:crypto'

/**
 * Secreto para `/api/admin/coach-knowledge-nodes` y scripts CLI.
 * Definí `GUIDE_COACH_ADMIN_SECRET` en el servidor (nunca `NEXT_PUBLIC_`).
 */
export function getCoachAdminSecret(): string | null {
  const s = process.env.GUIDE_COACH_ADMIN_SECRET?.trim()
  return s && s.length >= 16 ? s : null
}

export function readCoachAdminSecretFromRequest(req: Request): string | null {
  const h = req.headers.get('x-coach-admin-secret')?.trim()
  if (h) return h
  const auth = req.headers.get('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim() || null
  }
  return null
}

export function assertCoachAdminRequest(req: Request): void {
  const expected = getCoachAdminSecret()
  if (!expected) {
    throw new Error('DISABLED')
  }
  const got = readCoachAdminSecretFromRequest(req)
  if (!got) {
    throw new Error('FORBIDDEN')
  }
  const a = Buffer.from(got, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('FORBIDDEN')
  }
}
