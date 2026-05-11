import { createBrowserClient } from '@supabase/ssr'

/** Sin Navigator LockManager: evita AbortError por “steal” con Strict Mode / sesión concurrente. */
async function authLockNoOp<R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  return fn()
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: authLockNoOp,
      },
    }
  )
}
