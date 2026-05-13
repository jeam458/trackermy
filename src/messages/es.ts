/**
 * Copy en español (Perú) — una sola fuente de verdad para textos de UI.
 * Convención: claves en camelCase por pantalla (`activity.*`, `activityCalendar.*`).
 * Para textos con datos dinámicos usar plantillas `{nombreVariable}` + `interpolate()`.
 */
import { profileMessages } from './profileMessages.es'
import { voiceMessages } from './voiceMessages.es'

export const es = {
  common: {
    routeFallback: 'Ruta',
    defaultRiderName: 'Rider',
    speedUnit: 'km/h',
    distanceUnitKm: 'km',
    kmSuffix: ' km',
  },

  activityCalendar: {
    sectionEyebrow: 'Registro',
    ariaPrevMonth: 'Mes anterior',
    ariaNextMonth: 'Mes siguiente',
    /** Iniciales Lunes–Domingo (es-PE) */
    weekdayInitials: ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const,
    emptyDay: 'Sin bajadas registradas ese día.',
    hint: 'Toca un día con punto para ver fecha, hora y enlace al replay. Sin punto: sin bajadas ese día.',
  },

  activity: {
    loadingLabel: 'Cargando actividad…',
    pageTitle: 'Actividad',
    pageSubtitle: 'Progreso, calendario y récords en un solo lugar.',
    calendarHeroEyebrow: 'Calendario',
    weekStripThisWeek: 'Esta semana',
    weekKmSummary: '{km} km en la semana seleccionada',
    gallerySectionTitle: 'Galería y comunidad',
    autoAnalysisTitle: 'Análisis automático',
    autoAnalysisEmpty: 'Aún no hay suficiente historial para análisis automático.',
    trendSectionTitle: 'Tendencia reciente',
    trendChartEmpty: 'Sin datos suficientes para el gráfico.',
    chartLegendDistance: 'Distancia (km)',
    chartLegendAvgSpeed: 'Velocidad media (km/h)',
    chartSessionPrefix: 'S',
    statMaxSpeedLabel: 'Velocidad máxima',
    statAvgSpeedLabel: 'Velocidad media',
    statPerformanceLabel: 'Puntuación de rendimiento',
    linkRoutesTitle: 'Rutas',
    linkRoutesSubtitle: 'Ver tus rutas y detalles',
    linkRankingTitle: 'Ranking',
    linkRankingSubtitle: 'Compararte con otros riders',
    /** Bloque de mejores tiempos (evita repetir el título de la página) */
    highlightsSectionTitle: 'Mejores tiempos',
    personalRecordTitle: 'Nuevo récord personal',
    personalRecordRouteLine: 'en {routeName}!',
    personalRecordTimeLine: '{routeName} · {time}',
    highlightsEmpty:
      'Cuando registres bajadas verás aquí tu mejor tiempo por ruta (récords personales).',
    rankingsSectionTitle: 'Tus rankings por ruta',
    rankingsLoading: 'Actualizando rankings…',
    bestTimeLabel: 'Mejor tiempo: {time}',
    rankingsEmpty: 'Cuando tengas intentos en rutas públicas aparecerán aquí tus posiciones.',
    communitySectionTitle: 'Feed de la comunidad',
    communityLoading: 'Cargando actividad de la comunidad…',
    communityCommentMeta: 'Comentó tu bajada en {routeName} · {time}',
    communityViewReplay: 'Ver replay',
    communityEmpty: 'Aún no hay comentarios de la comunidad en tus bajadas públicas.',
    weeklyRankingCta: 'Ver ranking semanal',

    insights: {
      recentKmMore:
        'Recorriste {km} km más en tu última bajada que en la anterior (distancia por sesión).',
      recentKmLess: 'Recorriste {km} km menos en tu última bajada que en la anterior.',
      recentSpeedUp: 'Tu velocidad media en la última bajada subió {delta} km/h respecto a la anterior.',
      recentSpeedDown: 'Tu velocidad media en la última bajada bajó {delta} km/h respecto a la anterior.',
      weeklyVolumeLow:
        'Volumen semanal bajo: intenta sumar 2–3 bajadas más para ganar consistencia.',
      weeklyVolumeMid: 'Volumen semanal adecuado: mantén la frecuencia y trabaja tramos clave.',
      weeklyVolumeHigh: 'Buen volumen semanal: prioriza técnica y control de riesgo.',
      bestRankLine: 'Tu mejor posición actual es #{rank} en {routeName} ({time}).',
      globalPaceLine:
        'Resumen global: {avg} km/h de media, pico {max} km/h, rendimiento {perf}/10.',
    },
  },

  nav: {
    discover: 'Descubrir',
    activity: 'Actividad',
    routes: 'Rutas',
    ranking: 'Ranking',
    profile: 'Perfil',
    recordFab: 'Grabar',
    recordFabAria: 'Grabar bajada: ruta libre, nueva ruta o ruta existente',
  },

  voice: voiceMessages,

  profile: profileMessages,
} as const

export type EsMessages = typeof es
