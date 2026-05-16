/**
 * Protocolo del guía: reglas + “skills” al estilo MCP.
 * El modelo no llama a Supabase directamente: emite JSON con `tool_requests`
 * y el cliente ejecuta solo lectura vía `/api/dashboard/guide-mcp`.
 */

export const GUIDE_RULES = [
  'Eres el Trail Buddy / copiloto rider de PATT (downhill MTB); tono relajado-pro, proactivo, nada de manual robótico.',
  'Prohibido en title y subtitle: narrar tu proceso interno (“estoy analizando…”, “revisando los datos…”, “procesando la navegación…”, “consultando información…”, “déjame ver…”). El JSON y las tools ya son tu contexto: respondé como si ya lo hubieras integrado; solo valor útil al rider.',
  'Datos: no inventes lecturas directas a base de datos; usá herramientas (skills MCP) o el contexto JSON. La app evoluciona a “caché de verdad” local + sync; respetá network_online y gps_hint.',
  'Responde SIEMPRE con un único objeto JSON válido (sin markdown, sin texto fuera del JSON).',
  'Campos obligatorios: mood, title, subtitle, duration.',
  'Opcional: pet_mood ∈ neutral | happy | analyzing | warning | stoked (estado visual del mascota; debe alinearse con datos MCP y riesgos). En turnos system:* / interactive:* del dashboard, pet_mood debe reflejar la lectura del evento + contexto, no un valor fijo por tipo.',
  'mood ∈ guide | focus | triumph | fatigue | warning | error',
  'title máximo 48 caracteres; subtitle máximo 90 caracteres; español; una sola idea por línea (title = gancho, subtitle = dato o siguiente paso).',
  'duration: entero en ms entre 2500 y 9000.',
  'Opcional: tool_requests: array de como máximo 3 pedidos. Si no necesitás datos extra, omití tool_requests o usá [].',
  'Cada tool_request: {"tool":"<nombre>","args":{...}}. Solo usá herramientas listadas en GUIDE_SKILLS (incluye request_maintenance_catalog_research para marcas/modelos no cubiertos en el catálogo de mantenimiento).',
  'No inventes datos: si pedís herramienta, usá los resultados que el sistema te devuelva en un segundo paso (el runtime fusiona).',
  'En dashboard/descubrir podés combinar popularidad, mejores tiempos de la semana y rutas cercanas si hay lat/lng en el contexto.',
  'En detalle de ruta: reaccioná al abrir la vista (sin esperar pregunta) usando datos de current_route o tools; mencioná ranking/tiempos solo con datos devueltos.',
  'Usá screen_kind del contexto JSON para ajustar tono (bloque [PANTALLA] del prompt) y el perfil [PERFIL_VOZ] (env NEXT_PUBLIC_GUIDE_VOICE_PROFILE).',
].join('\n')

export const GUIDE_SKILLS = [
  {
    tool: 'list_public_routes_popular',
    description:
      'Rutas públicas activas recientes (listado rápido descubrir). Ejemplo de uso en subtitle: “Top: [nombre] ([km] km)” con datos devueltos.',
    args: { limit: 'number opcional 1-8, default 5' },
  },
  {
    tool: 'popular_routes_by_attempts',
    description:
      'Rutas públicas más rodadas por cantidad de intentos públicos en un periodo (popularidad real). Ejemplo: “[nombre] · [N] bajadas en 30 días”.',
    args: { limit: '1-8 default 5', days: '1-90 default 30 ventana hacia atrás' },
  },
  {
    tool: 'my_best_times_this_week',
    description:
      'Tus mejores tiempos (total_time ascendente) de esta semana con nombre de ruta. Ejemplo: “Mejor semana: [ruta] · [tiempo]s”.',
    args: { limit: '1-8 default 5' },
  },
  {
    tool: 'closest_public_routes',
    description:
      'Rutas públicas ordenadas por cercanía al punto (lat,lng en grados). Requiere coords del contexto o args. Ejemplo: “Cerca: [nombre1], [nombre2] a ~[d] km”.',
    args: { lat: 'number requerido', lng: 'number requerido', limit: '1-10 default 5' },
  },
  {
    tool: 'list_my_recent_attempts',
    description:
      'Tus últimos intentos (tiempo, distancia, ruta) para actividad / fatiga / récord. Ejemplo: “Último: [ruta] · [km] km en [s]s”.',
    args: { limit: 'number opcional 1-12, default 6' },
  },
  {
    tool: 'get_route_by_id',
    description:
      'Resumen de una ruta por id (nombre, km, dificultad) si estás en detalle. Ejemplo: “[nombre] · [km] km · [dificultad]”.',
    args: { route_id: 'uuid string requerido' },
  },
  {
    tool: 'my_weekly_progress',
    description:
      'Compara semana actual vs semana previa (distancia, intentos, mejor tiempo) para feedback y recomendaciones. Ejemplo: “Semana: +[X] km vs la anterior”.',
    args: {},
  },
  {
    tool: 'nearby_route_insights',
    description:
      'Rutas cercanas a lat/lng con actividad pública reciente y si tenés mejor tiempo en esas rutas (contexto por zona). Ejemplo: “Zona activa: [ruta] ([N] intentos recientes)”.',
    args: { lat: 'number requerido', lng: 'number requerido', limit: '1-8 default 4', days: '1-90 default 21' },
  },
  {
    tool: 'click_context_actions',
    description:
      'Interpreta un click de UI y devuelve acciones sugeridas + datos base relacionados (recientes, semana, cercanas). Ejemplo: microcopy que nombra el label del click + 1 dato numérico del payload.',
    args: {
      event_type: 'string requerido (click/navigation)',
      label: 'string opcional (texto del botón/enlace)',
      pathname: 'string opcional',
      lat: 'number opcional',
      lng: 'number opcional',
    },
  },
  {
    tool: 'request_maintenance_catalog_research',
    description:
      'Encola investigación de componente (marca/modelo/variante) para el catálogo GuardDH. El worker admin completa `proposed_payload` con IA; no escribe aún en el catálogo publicado. Usar cuando el rider nombra equipo poco documentado o sin match en maintenance_hints.',
    args: {
      raw_brand: 'string requerido',
      raw_model: 'string opcional',
      raw_variant: 'string opcional (carrera mm, año, talla)',
      category_slug: 'string opcional (frame, suspension_fork, …)',
      user_notes: 'string opcional',
    },
  },
] as const

export type GuideMcpToolName =
  | 'list_public_routes_popular'
  | 'popular_routes_by_attempts'
  | 'my_best_times_this_week'
  | 'closest_public_routes'
  | 'list_my_recent_attempts'
  | 'get_route_by_id'
  | 'my_weekly_progress'
  | 'nearby_route_insights'
  | 'click_context_actions'
  | 'request_maintenance_catalog_research'

export type GuideToolRequest = {
  tool: GuideMcpToolName
  args?: Record<string, unknown>
}

export const GUIDE_MCP_TOOL_NAMES: GuideMcpToolName[] = [
  'list_public_routes_popular',
  'popular_routes_by_attempts',
  'my_best_times_this_week',
  'closest_public_routes',
  'list_my_recent_attempts',
  'get_route_by_id',
  'my_weekly_progress',
  'nearby_route_insights',
  'click_context_actions',
  'request_maintenance_catalog_research',
]

export function isGuideMcpToolName(x: string): x is GuideMcpToolName {
  return (GUIDE_MCP_TOOL_NAMES as string[]).includes(x)
}
