/**
 * ============================================
 * INSTRUCCIONES PARA APLICAR EL ESQUEMA SQL
 * ============================================
 * 
 * Para implementar el sistema de rutas en tu base de datos Supabase,
 * sigue estos pasos:
 * 
 * 1. Abre tu proyecto en Supabase (https://supabase.com/dashboard)
 * 
 * 2. Ve a la sección "SQL Editor" en el menú lateral
 * 
 * 3. Crea una nueva consulta ("New Query")
 * 
 * 4. Copia y pega TODO el contenido del archivo:
 *    supabase/schema-routes.sql
 * 
 * 5. Ejecuta la consulta (botón "Run" o Ctrl+Enter / Cmd+Enter)
 * 
 * 6. Verifica que se hayan creado:
 *    - Tabla: routes
 *    - Tabla: route_track_points
 *    - Función: get_route_with_points
 *    - Función: calculate_distance_meters
 *    - Función: update_route_stats
 *    - Trigger: update_routes_updated_at
 *    - Trigger: update_route_stats_after_point_change
 *    - Políticas RLS para ambas tablas
 * 
 * ============================================
 * VERIFICACIÓN
 * ============================================
 * 
 * Puedes verificar que todo se creó correctamente ejecutando:
 * 
 * ```sql
 * -- Verificar tablas
 * SELECT table_name FROM information_schema.tables 
 * WHERE table_schema = 'public' 
 * AND table_name IN ('routes', 'route_track_points');
 * 
 * -- Verificar funciones
 * SELECT routine_name FROM information_schema.routines 
 * WHERE routine_schema = 'public'
 * AND routine_name IN ('get_route_with_points', 'calculate_distance_meters', 'update_route_stats');
 * 
 * -- Verificar triggers
 * SELECT trigger_name FROM information_schema.triggers 
 * WHERE trigger_schema = 'public';
 * ```
 * 
 * ============================================
 * NOTAS IMPORTANTES
 * ============================================
 * 
 * 1. RLS (Row Level Security):
 *    - Las rutas públicas son visibles para todos
 *    - Los usuarios solo pueden crear/editar/eliminar SUS propias rutas
 *    - Los puntos de track siguen la misma lógica
 * 
 * 2. Triggers automáticos:
 *    - updated_at se actualiza automáticamente al modificar una ruta
 *    - distance_km, elevation_gain_m, elevation_loss_m se calculan automáticamente
 *      al insertar/actualizar/eliminar puntos de track
 * 
 * 3. Índices:
 *    - Se crearon índices para optimizar búsquedas por usuario, estado, dificultad
 *    - Los puntos de track están indexados por route_id y order_index
 * 
 * 4. Integridad:
 *    - Las rutas se eliminan en cascada si se elimina el usuario
 *    - Los puntos de track se eliminan si se elimina la ruta
 * 
 * ============================================
 * SOLUCIÓN DE PROBLEMAS
 * ============================================
 * 
 * Error: "permission denied for schema public"
 * Solución: Asegúrate de estar ejecutando como usuario con privilegios
 * 
 * Error: "relation already exists"
 * Solución: Las tablas ya existen, puedes DROPearlas primero o ignorar el error
 * 
 * Error: "function already exists"
 * Solución: Las funciones ya existen, usa "CREATE OR REPLACE"
 * 
 */

// Este archivo es solo documentación, no contiene código ejecutable
export const SCHEMA_DOCUMENTATION = true
