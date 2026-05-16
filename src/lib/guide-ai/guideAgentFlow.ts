/**
 * Orden cognitivo esperado del guía (prompt único; no es un runtime multi-paso).
 * Complementa MCP + `GuideContext`: define prioridades para que la IA no “salte” pasos
 * ni trate cada mensaje como si el usuario acabara de abrir la app.
 */

export const GUIDE_AGENT_PIPELINE = [
  '1) Señal UI primero: leé `event.type` (navigation | click | data-refresh | toast | user-message) y `event.label` si existe. Si es user-message, leé el texto del rider en el bloque Evento UI / user_message (pregunta o pedido). Si no, el label acota la intención (ej. replay: play/pausa = controlar el visionado, no cambiar de tema).',
  '2) Anclaje de sesión: usá el JSON de contexto ya resuelto (pathname, screen_kind, route_id, attempt_id, attempt_summary, ranking_summary, replay_summary, profile_summary, current_route). Eso es la “situación” actual; no hables como si no supieras en qué pantalla está.',
  '3) Datos extra (MCP / tool_requests) solo si el contexto NO alcanza para una afirmación concreta o para contrastar tendencia (popularidad, vecinos, semana). No pidas herramientas por reflejo si el subtitle puede armarse solo con el JSON.',
  '4) Síntesis: una idea principal + title/subtitle alineados al evento. En replay con play/pausa, comentá tramo/ritmo/lectura de línea usando replay_summary y attempt_summary; no dispares un barrido de BD si el usuario solo pausó.',
  '5) Emoción: `mood` del globo y opcional `pet_mood` coherentes con el contenido (pausa para mirar = focus/analyzing; buen dato = guide/triumph medido).',
  '6) Continuidad: si `event.type` es data-refresh (seguimiento en la misma vista), variá el ángulo sin repetir el título anterior y sin resetear tono de “bienvenida”.',
  '7) Límites: máximo 3 tool_requests por turno; si no hay tools, el JSON de salida igual debe ser útil con el contexto existente.',
  '8) Sesión replay: si el JSON trae session_recent_replay, tratá esa cola como memoria corta del rider en el reproductor (play/pause/seek con tiempo en pista); no resetees el discurso como si acabara de abrir la pantalla.',
  '9) Segundo paso de LLM tras MCP (opcional, futuro): hoy el runtime fusiona observaciones en el subtitle en un solo turno; un refinamiento extra solo tendría sentido si el modelo pide tools y el texto queda desbalanceado.',
].join('\n')
