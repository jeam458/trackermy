import type { GuideContext } from '@/lib/guide-ai/types'
import { coachVosFirstName } from '@/lib/guide-ai/riderCoachDisplayName'
import type { RiderGuideMood, RiderGuideToastType } from '@/lib/riderGuide'

type WarmupCtx = Pick<
  GuideContext,
  | 'riderDisplayName'
  | 'currentRoute'
  | 'routeTrackPointCount'
  | 'attemptSummary'
  | 'weeklyKm'
  | 'topRouteName'
  | 'topRouteKm'
  | 'recentTriumph'
  | 'fatigue'
  | 'aggregateCoachInsights'
>

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

export function buildNavigationWarmup(pathname: string, ctx: WarmupCtx): NavigationWarmup {
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
      title: nick ? `${nick}, tu actividad` : 'Tu actividad',
      subtitle: nick
        ? 'Miramos volumen y constancia; te marco un solo foco para esta semana.'
        : 'Volumen y constancia: un foco claro para la semana.',
      toastType: 'info',
    }
  }
  /** Descubrir / home: mensaje con datos reales (km semana, ruta top), sin meta “estoy leyendo…”. */
  if (p === '/dashboard' || p === '/dashboard/') {
    const wk = ctx.weeklyKm
    const hasWk = wk != null && Number.isFinite(Number(wk)) && Number(wk) > 0.05
    const topName = ctx.topRouteName?.trim()
    const topKm = ctx.topRouteKm
    const agr = (ctx.aggregateCoachInsights ?? []).find((s) => typeof s === 'string' && s.trim().length > 10)

    const parts: string[] = []
    if (hasWk) parts.push(`~${Number(wk).toFixed(1)} km esta semana`)
    if (topName) {
      const kmBit =
        topKm != null && Number.isFinite(Number(topKm)) ? ` · ${Number(topKm).toFixed(1)} km` : ''
      parts.push(`la que más movés: ${topName}${kmBit}`)
    }
    if (ctx.recentTriumph) parts.push('muy buenos tiempos recientes')
    if (ctx.fatigue) parts.push('mucho volumen ayer/hoy: prioricemos descanso')

    let sub =
      parts.length >= 2
        ? `${parts[0]} — ${parts[1]}. Elegí una ruta del mapa o abrí ranking semanal.`
        : parts.length === 1
          ? `${parts[0]}. Tocá una ruta para ver tiempos y preparar la bajada.`
          : 'Explorá rutas públicas o favoritas; cuando bajes, el coach arma feedback con tus números.'

    if (agr) {
      const t = agr.trim()
      sub = `${sub} Idea del grupo: ${t.length > 100 ? `${t.slice(0, 99)}…` : t}`
    }

    return {
      mood: ctx.fatigue ? 'fatigue' : ctx.recentTriumph ? 'triumph' : 'guide',
      title: nick ? `${nick}, mapa listo` : 'Mapa listo',
      subtitle: sub,
      toastType: 'info',
    }
  }
  return {
    mood: 'guide',
    title: nick ? `${nick}, seguimos` : 'Acá estamos',
    subtitle: nick
      ? 'Abrí ruta, actividad o perfil: el mensaje se arma con datos de esa pantalla, no con relleno.'
      : 'Elegí sección en el menú; el coach se ajusta a lo que estés mirando.',
    toastType: 'info',
  }
}
