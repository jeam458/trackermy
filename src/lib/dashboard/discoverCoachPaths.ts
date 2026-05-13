/** Home del dashboard = pantalla “Descubrir rutas”. */
export function isDashboardDiscoverHome(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname.replace(/\/$/, '') === '/dashboard'
}

/**
 * Pantallas donde el coach vive en el slot de cabecera (`#gdh-dashboard-coach-header-slot`).
 * Excluye grabación (dock propio). Replay u otras sin slot siguen con dock flotante si aplica.
 */
export function isDashboardCoachHeaderSlotRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const p = pathname.replace(/\/$/, '')
  if (!p.startsWith('/dashboard')) return false
  if (p.startsWith('/dashboard/routes/record')) return false
  return true
}
