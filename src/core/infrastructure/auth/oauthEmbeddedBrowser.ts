/**
 * Google OAuth devuelve 403 disallowed_useragent en WebViews y “navegadores in-app”
 * (Instagram, Facebook, TikTok, etc.). No es un bug de Supabase: es política de Google.
 */

export function isGoogleOAuthRestrictedUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''

  // Apps con WebView embebido
  if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|TikTok|Snapchat/i.test(ua)) {
    return true
  }
  // WebView genérico Android (Chrome Custom Tabs no llevan "; wv)")
  if (/; wv\)/i.test(ua)) {
    return true
  }
  return false
}
