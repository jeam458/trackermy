/**
 * Fire-and-forget: registra pulgar arriba/abajo sobre un turno del coach.
 * Si la tabla no existe aún, el servidor responde 503 y se ignora en cliente.
 */
export function submitGuideCoachFeedback(opts: { screenKind: string; sentiment: -1 | 1 }): void {
  void fetch('/api/dashboard/guide-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ screen_kind: opts.screenKind, sentiment: opts.sentiment }),
  }).catch(() => {
    /* noop */
  })
}
