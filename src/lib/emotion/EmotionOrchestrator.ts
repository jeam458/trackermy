import type { RiderGuideMood } from '@/lib/riderGuide'

export type EmotionContextSnapshot = {
  pathname: string
  loading: boolean
  recentTriumph: boolean
  fatigue: boolean
  topRouteName?: string | null
  topRouteKm?: number | null
  weeklyKm?: number | null
}

export type EmotionDecision = {
  mood: RiderGuideMood
  title: string
  subtitle: string
  colorHint: 'teal' | 'cyan' | 'amber' | 'violet' | 'rose'
}

/**
 * Motor simple de emociones para el rider-guide.
 * Combina navegación + señales deportivas + contexto de datos.
 */
export function decideRiderEmotion(ctx: EmotionContextSnapshot): EmotionDecision {
  if (ctx.loading) {
    return {
      mood: 'loading',
      title: 'Sincronizando contexto',
      subtitle: 'Preparando lectura de actividad y rutas.',
      colorHint: 'cyan',
    }
  }

  if (ctx.recentTriumph) {
    return {
      mood: 'triumph',
      title: 'Nuevo impulso de campeon',
      subtitle: 'Acabas de cerrar fuerte, mantengamos ese ritmo.',
      colorHint: 'amber',
    }
  }

  if (ctx.fatigue) {
    return {
      mood: 'fatigue',
      title: 'Carga alta detectada',
      subtitle: 'Recupera respiracion y tecnica antes de otro push.',
      colorHint: 'violet',
    }
  }

  if (ctx.pathname.includes('/dashboard/routes/record')) {
    return {
      mood: 'focus',
      title: 'Modo precision activo',
      subtitle: 'Linea limpia, control de frenada y mirada al frente.',
      colorHint: 'teal',
    }
  }

  if (ctx.pathname.includes('/dashboard/routes/view')) {
    return {
      mood: 'focus',
      title: 'Detalle de ruta en lectura',
      subtitle: 'Te guio por distancia, ranking y puntos de interes.',
      colorHint: 'cyan',
    }
  }

  if (ctx.pathname === '/dashboard') {
    const route = ctx.topRouteName?.trim() ? ctx.topRouteName.trim() : null
    const km = Number(ctx.topRouteKm ?? 0)
    return {
      mood: 'guide',
      title: route ? `Popular ahora: ${route}` : 'Panel principal listo',
      subtitle:
        route && km > 0
          ? `${km.toFixed(2)} km · revisa mapa y compara con tus tiempos.`
          : 'Revisa rutas populares, mapa y actividad reciente.',
      colorHint: 'teal',
    }
  }

  return {
    mood: 'guide',
    title: 'Estoy contigo rider',
    subtitle: 'Ajustando recomendaciones segun navegacion y rendimiento.',
    colorHint: 'cyan',
  }
}
