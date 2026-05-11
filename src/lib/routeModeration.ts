/**
 * Correos con permisos de moderación global de rutas (además del dueño `created_by`).
 * Debe coincidir con public.is_route_platform_admin() en la migración SQL.
 */
export const ROUTE_PLATFORM_ADMIN_EMAILS = ['jeancarlos387@gmail.com'] as const

export function isRoutePlatformAdminEmail(email: string | null | undefined): boolean {
  const e = (email ?? '').trim().toLowerCase()
  return (ROUTE_PLATFORM_ADMIN_EMAILS as readonly string[]).includes(e)
}

export function canModerateRouteAsUser(options: {
  userId: string | null | undefined
  userEmail: string | null | undefined
  routeCreatedBy: string | null | undefined
}): boolean {
  const { userId, userEmail, routeCreatedBy } = options
  if (!userId || !routeCreatedBy) return false
  if (userId === routeCreatedBy) return true
  return isRoutePlatformAdminEmail(userEmail)
}
