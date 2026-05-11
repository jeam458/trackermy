/**
 * Pistas en español para el LLM (`domain.action` → texto).
 * Solo datos; no importar desde lógica que mute estado.
 */
export const GUIDE_DYNAMIC_TRIGGER_HINTS_ES: Readonly<Record<string, string>> = {
  'map.canvas_click': 'Click en el lienzo del mapa (exploración / intención en cartografía).',
  'map.zoom_in': 'Acercó el mapa (control zoom).',
  'map.zoom_out': 'Alejó el mapa (control zoom).',
  'map.expand_toggle': 'Cambió tamaño o modo expandido del mapa.',
  'ui.pointer_click': 'Interacción táctil/mouse en control UI.',
  'ui.scroll_main': 'Desplazó el contenido principal (scroll).',
  'ui.card_click': 'Click en tarjeta / bloque destacado.',
  'ui.tab_select': 'Cambió de pestaña.',
  'geo.approx_fix': 'Se obtuvo posición aproximada del rider (GPS).',
  'metrics.surface_visible': 'Superficie de métricas o lectura de datos en pantalla.',
  'replay_data.hud_metrics': 'Interacción con la franja de métricas del replay (tiempo / v / z).',
}
