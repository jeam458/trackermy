import { Capacitor } from '@capacitor/core'

/** Debe coincidir con AndroidManifest: scheme + host del intent-filter OAuth. */
export const NATIVE_OAUTH_REDIRECT = 'com.dhtracker.app://login-callback'

/** URL de retorno para Supabase OAuth (añádela en Supabase → Auth → URL configuration → Redirect URLs). */
export function getOAuthRedirectUrl(): string {
  if (typeof window === 'undefined') return ''
  if (Capacitor.isNativePlatform()) return NATIVE_OAUTH_REDIRECT
  return `${window.location.origin}/auth/callback`
}
