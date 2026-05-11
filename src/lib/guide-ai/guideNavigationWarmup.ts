import type { GuideContext } from '@/lib/guide-ai/types'
import { coachVosFirstName } from '@/lib/guide-ai/riderCoachDisplayName'
import type { RiderGuideMood, RiderGuideToastType } from '@/lib/riderGuide'

export type NavigationWarmup = {
  mood: RiderGuideMood
  title: string
  subtitle: string
  toastType: RiderGuideToastType
}

function oneLineDescription(raw: string | null | undefined, max = 86): string {
  const t = (raw || '').trim().replace(/\s+/g, ' ')
  if (!t) return ''
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

/**
 * Saludo de carga antes del LLM: siempre de tú a tú; usa nombre si existe en contexto.
 */
function formatAttemptClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function buildNavigationWarmup(
  pathname: string,
  ctx: Pick<GuideContext, 'riderDisplayName' | 'currentRoute' | 'routeTrackPointCount' | 'attemptSummary'>
): NavigationWarmup {
  const p = pathname.toLowerCase()
  const nick = coachVosFirstName(ctx.riderDisplayName)
  const routeLabel = ctx.currentRoute?.name?.trim() || null
  const km =
    ctx.currentRoute?.distanceKm != null && Number.isFinite(Number(ctx.currentRoute.distanceKm))
      ? Number(ctx.currentRoute.distanceKm)
      : null
  const diff = ctx.currentRoute?.difficulty?.trim() || null

  if (p.includes('/dashboard/routes/view')) {
    const routeBit = routeLabel ? `“${routeLabel}”` : 'esta ruta'
    const el =
      ctx.currentRoute?.elevationGainM != null && Number.isFinite(Number(ctx.currentRoute.elevationGainM))
        ? Math.round(Number(ctx.currentRoute.elevationGainM))
        : null
    const pts =
      ctx.routeTrackPointCount != null && ctx.routeTrackPointCount > 0 ? ctx.routeTrackPointCount : null
    const desc = oneLineDescription(ctx.currentRoute?.description ?? null, 72)
    const metricParts: string[] = []
    if (km != null) metricParts.push(`${km.toFixed(1)} km`)
    if (el != null && el > 0) metricParts.push(`+${el} m desnivel`)
    if (diff) metricParts.push(diff)
    if (pts != null) metricParts.push(`${pts} pts trazado`)
    const metricLine = metricParts.length ? metricParts.join(' · ') : ''
    const detail = [metricLine, desc].filter(Boolean).join(' — ')
    return {
      mood: 'focus',
      title: nick ? `${nick}, ${routeLabel || 'detalle de ruta'}` : routeLabel || 'Detalle de ruta',
      subtitle: detail
        ? nick
          ? `Ficha: ${detail}. Cuando quieras, Iniciar recorrido.`
          : `${detail}. Revisá el mapa y arrancá cuando estés listo.`
        : nick
          ? `Abrimos ${routeBit}; en un momento sintetizo la ficha.`
          : `Abrimos ${routeBit}; sintetizo la ficha.`,
      toastType: 'info',
    }
  }
  if (p.includes('/dashboard/routes/attempt-stats')) {
    const a = ctx.attemptSummary
    if (a) {
      const name = a.routeName || 'tu bajada'
      const bits: string[] = []
      if (a.maxSpeedKmh != null) bits.push(`máx ${a.maxSpeedKmh} km/h`)
      if (a.avgSpeedKmh != null) bits.push(`media ${a.avgSpeedKmh} km/h`)
      if (a.distanceKm != null) bits.push(`${a.distanceKm} km`)
      bits.push(`tiempo ${formatAttemptClock(a.totalTimeSec)}`)
      return {
        mood: 'focus',
        title: nick ? `${nick}, ${name}` : name,
        subtitle: `${bits.join(' · ')}. Mirá el gráfico por tramo o usá «Analizar con IA» para micro-consejos.`,
        toastType: 'info',
      }
    }
    return {
      mood: 'guide',
      title: nick ? `${nick}, estadísticas` : 'Estadísticas',
      subtitle: 'Abrí un intento desde la ruta para ver tiempos y velocidades acá.',
      toastType: 'info',
    }
  }
  if (p.includes('/dashboard/routes/record')) {
    return {
      mood: 'focus',
      title: nick ? `${nick}, modo ruta ON` : 'Modo ruta activo',
      subtitle: nick
        ? 'Voy con vos: línea, frenos y ritmo; avisame si querés micro-consejos.'
        : 'Te acompaño en tiempo real con foco en control y seguridad.',
      toastType: 'info',
    }
  }
  if (p.includes('/dashboard/activity')) {
    return {
      mood: 'guide',
      title: nick ? `${nick}, miramos tu actividad` : 'Revisando tu actividad',
      subtitle: nick
        ? 'Saco señales de progreso y te marco un solo foco para esta semana.'
        : 'Analizo progreso y te marco el siguiente foco.',
      toastType: 'info',
    }
  }
  return {
    mood: 'guide',
    title: nick ? `${nick}, leyendo tu contexto` : 'Estoy leyendo tu contexto',
    subtitle: nick
      ? 'Según lo que abras te hablo con nombre y datos, no con frases vacías.'
      : 'Navega y te doy recomendaciones según lo que abras.',
    toastType: 'info',
  }
}
