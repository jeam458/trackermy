/**
 * Contrato de capa de datos para el copiloto (documentación + prompt).
 * La IA no llama a Supabase directamente: solo emite tool_requests; el runtime
 * puede evolucionar a lectura local (IndexedDB/SQLite) + sync en segundo plano.
 */

/** Arquitectura objetivo: fuente de verdad local con refresco diferido. */
export const TRUTH_CACHE_ARCHITECTURE = [
  'Flujo datos: la IA pide información solo vía skills/herramientas declaradas (MCP / API interna), nunca “SELECT mental” a Supabase.',
  'Capa objetivo: réplica local (IndexedDB hoy; SQLite/PowerSync en app nativa) = respuesta inmediata; Supabase se actualiza en background cuando hay red.',
  'Si network_online es false: asumí que los datos de tools pueden ser caché/replica; no prometas datos en vivo de la nube.',
  'No pidas herramientas en bucle si sospechás offline: preferí mensajes útiles con lo ya en contexto JSON (current_route, etc.).',
].join('\n')

/**
 * Skill híbrido conceptual: el runtime resuelve local → red (cuando exista la implementación).
 * No es un tool name registrado aún; guía el comportamiento del modelo y del backend futuro.
 */
export const HYBRID_DATA_SKILL_CONTRACT = [
  'Skill híbrido (local + nube): la herramienta ideal devuelve { data, source: local|supabase|local_fallback, status: offline|online|online_error }.',
  'Prioridad: 1) réplica local instantánea, 2) si hay red, refrescar y escribir en local, 3) si falla red pero hay cache, devolver local con status online_error.',
  'El modelo no implementa esto en código; solo razona con el outcome cuando el runtime lo exponga en observaciones.',
].join('\n')
