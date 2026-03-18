# Guía de Inicio Rápido - Módulo de Rutas

## Comandos Principales

### Desarrollo
```bash
# Iniciar servidor de desarrollo
npm run dev

# Abrir en navegador
# http://localhost:3000
```

### Build
```bash
# Compilar para producción
npm run build

# Iniciar en producción
npm run start
```

### Tests
```bash
# Ejecutar todos los tests
npm test

# Tests en modo watch
npm run test:watch

# Tests con cobertura
npm run test:coverage

# Tests específicos del módulo de rutas
npm test -- CreateRouteUseCase
```

### Linting
```bash
# Ejecutar linter
npm run lint
```

## Estructura de Rutas

| Ruta | Descripción |
|------|-------------|
| `/dashboard/profile` | Perfil de usuario con botón de crear ruta |
| `/dashboard/routes` | Lista de rutas del usuario |
| `/dashboard/routes/create` | Crear ruta dibujando en mapa |
| `/dashboard/routes/record` | Grabar ruta en tiempo real con GPS |

## Flujo de Creación de Ruta

### Opción 1: Dibujar en Mapa
```
Perfil → Crear Ruta → Dibujar → 
  1. Click punto de partida
  2. Click punto de llegada
  3. Agregar puntos intermedios
  4. Procesar (aplica filtros GPS)
  5. Completar información
  6. Guardar
```

### Opción 2: Grabar en Tiempo Real
```
Perfil → Grabar Ruta → 
  1. Iniciar grabación (GPS)
  2. Recorrer ruta
  3. Detener grabación
  4. Nombrar ruta
  5. Guardar
```

## Configuración de Base de Datos

### Paso 1: Abrir Supabase
```
https://supabase.com/dashboard → Tu Proyecto → SQL Editor
```

### Paso 2: Ejecutar Esquema
```sql
-- Copiar contenido de: supabase/schema-routes.sql
-- Pegar en SQL Editor
-- Click en "Run" o Ctrl+Enter
```

### Paso 3: Verificar
```sql
-- Verificar tablas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verificar funciones
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public';
```

## Variables de Entorno

Crear `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

## Algoritmos GPS Configurados

| Algoritmo | Configuración | Propósito |
|-----------|---------------|-----------|
| Precisión | max: 15m | Elimina puntos imprecisos |
| Velocidad | max: 80 km/h | Elimina outliers de movimiento |
| Kalman | Q: 0.001, R: 0.01 | Suaviza coordenadas |
| Distancia | min: 3m | Elimina redundantes |
| Outliers | radio: 20m | Limpia desviaciones |
| Douglas-Peucker | tolerancia: 5m | Simplifica track |

## Calidad de Track

| Calidad | Filtrado | Confianza |
|---------|----------|-----------|
| Excellent | < 10% | > 90% |
| Good | < 30% | > 80% |
| Fair | < 50% | > 60% |
| Poor | > 50% | < 60% |

## Solución de Problemas

### Error: "window is not defined"
✅ Solucionado: Los componentes de mapa usan carga dinámica con `ssr: false`

### Error: "btoa is not defined"
✅ Solucionado: Se usa codificación SVG directa

### GPS no funciona en desarrollo
- Usar HTTPS o localhost
- Permitir acceso a ubicación en el navegador
- Verificar que el dispositivo tenga GPS

### Puntos se filtran demasiado
- Ajustar `DEFAULT_GPS_FILTER_CONFIG` en `GPSTrack.ts`
- Reducir `douglasPeuckerTolerance` para más detalle

### Build falla
```bash
# Limpiar caché
rm -rf .next
npm run build
```

## Hooks Disponibles

### useRouteCreator
```typescript
import { useRouteCreator } from '@/hooks/useRouteCreator'

const {
  startPoint, endPoint, trackPoints,
  isDrawing, isProcessing, isSaving,
  name, description, difficulty, isPublic,
  processedTrack, quality, errors,
  startDrawing, stopDrawing, cancelDrawing,
  setStartPoint, setEndPoint, addTrackPoint, removeTrackPoint,
  setName, setDescription, setDifficulty, setIsPublic,
  processTrack, saveRoute,
  canSave, canProcess, getEstimatedDistance,
} = useRouteCreator(user)
```

### useGPSRecorder
```typescript
import { useGPSRecorder } from '@/hooks/useGPSRecorder'

const {
  isRecording, isPaused, points,
  elapsedTime, currentAccuracy, currentSpeed, error,
  startRecording, stopRecording,
  pauseRecording, resumeRecording,
  clearRecording, exportPoints,
} = useGPSRecorder({
  recordingInterval: 1000,
  minAccuracy: 15,
  minDistance: 3,
})
```

## Componentes Disponibles

### RouteMapEditorDynamic
```typescript
import { RouteMapEditorDynamic } from '@/components/routes/MapWrapper'

<RouteMapEditorDynamic
  startPoint={startPoint}
  endPoint={endPoint}
  trackPoints={trackPoints}
  onPointAdd={addTrackPoint}
  onPointRemove={removeTrackPoint}
  onStartPointSet={setStartPoint}
  onEndPointSet={setEndPoint}
  isDrawing={isDrawing}
  center={[-12.0464, -77.0428]}
  zoom={12}
/>
```

## Repositorio

```typescript
import { SupabaseRouteRepository } from '@/core/infrastructure/repositories/SupabaseRouteRepository'

const repo = new SupabaseRouteRepository()

// Crear ruta
await repo.createRoute(routeData, userId)

// Obtener rutas
const routes = await repo.getUserRoutes(userId)

// Actualizar
await repo.updateRoute(routeId, updates)

// Eliminar
await repo.deleteRoute(routeId)
```

## Servicio de Procesamiento GPS

```typescript
import { GPSTrackProcessingService } from '@/core/application/CreateRouteUseCase'

const service = new GPSTrackProcessingService()

// Procesar track
const result = service.processTrack(gpsPoints)
// result: {
//   points: ProcessedTrackPoint[],
//   originalCount: number,
//   filteredCount: number,
//   distanceKm: number,
//   elevationGainM: number,
//   elevationLossM: number,
//   quality: TrackQuality
// }

// Validar ruta
const validation = service.validateRoute(start, end, points)
// validation: { valid: boolean, errors: string[] }
```

## Enlaces Útiles

- **Documentación completa**: `ROUTES_MODULE_README.md`
- **Resumen de implementación**: `IMPLEMENTATION_SUMMARY.md`
- **Esquema SQL**: `supabase/schema-routes.sql`
- **Tests**: `src/core/application/CreateRouteUseCase.test.ts`

---

**Implementación completada ✅**
