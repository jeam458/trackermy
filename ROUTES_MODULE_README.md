# Módulo de Creación de Rutas - Downhill Bike Tracking

## Descripción

Este módulo permite a los usuarios crear rutas de downhill de dos formas:
1. **Dibujo en mapa**: Crear manualmente una ruta haciendo click en el mapa
2. **Grabación en tiempo real**: Grabar la ruta mientras se recorre con GPS

El sistema incluye algoritmos avanzados de mitigación de ruido GPS para garantizar precisión en el tracking.

## Características Principales

### 🎯 Precisión GPS
- **Filtro de Kalman**: Suaviza las coordenadas para reducir el ruido
- **Algoritmo Douglas-Peucker**: Simplifica el track manteniendo la forma original
- **Detección de outliers**: Elimina puntos con velocidad imposible o baja precisión
- **Validación de distancia mínima**: Evita puntos redundantes

### 📴 Modo Offline (¡NUEVO!)
- **Tracking sin internet**: Grabación GPS completa sin conexión
- **Almacenamiento local**: IndexedDB para persistencia
- **Sincronización automática**: Detecta conexión y sincroniza
- **Indicadores visuales**: Estado online/offline en tiempo real
- **Reintentos inteligentes**: Cada 30 segundos automáticamente
- **Cero pérdida de datos**: Todo se guarda localmente primero

### 🗺️ Creación de Rutas
- **Punto de partida y llegada**: Define los extremos de la ruta
- **Puntos intermedios**: Traza el camino exacto a seguir
- **Edición en tiempo real**: Agrega, elimina o deshace puntos
- **Vista previa**: Visualiza la ruta completa antes de guardar

### 📊 Información de la Ruta
- **Distancia**: Calculada automáticamente usando fórmula Haversine
- **Elevación**: Ganancia y pérdida de altitud
- **Dificultad**: Principiante, Intermedio, Experto
- **Visibilidad**: Pública o privada
- **Calidad del track**: Evaluación automática de la precisión GPS

### 📱 Grabación en Tiempo Real
- **Tracking GPS**: Graba puntos mientras recorres la ruta
- **Estadísticas en vivo**: Tiempo, distancia, velocidad actual y promedio
- **Pausar/Reanudar**: Control total sobre la grabación
- **Filtrado automático**: Descarta puntos con baja precisión automáticamente

### 📴 Modo Offline (¡NUEVO!)
- **Funciona SIN internet**: GPS tracking completo sin conexión
- **Almacenamiento IndexedDB**: Datos persistentes localmente
- **Sincronización automática**: Al detectar conexión
- **Indicadores de estado**: Online/Offline/Pendiente en UI
- **Cero pérdida de datos**: Todo se guarda localmente primero
- **Reintentos automáticos**: Cada 30 segundos

**¿Cómo funciona?**
```
Sin Internet:
  GPS → Coordenadas → IndexedDB (local) → ✅ Guardado

Con Internet:
  IndexedDB → Sincronización → Supabase → ✅ Ruta creada
```

**Ver documentación completo**: [OFFLINE_MODE.md](./OFFLINE_MODE.md)

## Estructura de Archivos

```
src/
├── core/
│   ├── domain/
│   │   ├── Route.ts              # Entidades de dominio de Rutas
│   │   └── GPSTrack.ts           # Entidades y configuración de GPS
│   ├── application/
│   │   ├── CreateRouteUseCase.ts # Caso de uso con algoritmos GPS
│   │   └── CreateRouteUseCase.test.ts # Tests unitarios
│   └── infrastructure/
│       ├── repositories/
│       │   └── SupabaseRouteRepository.ts # Repositorio Supabase
│       └── supabase/
│           ├── client.ts         # Cliente de Supabase (browser)
│           └── server.ts         # Cliente de Supabase (server)
├── components/
│   ├── routes/
│   │   ├── RouteMapEditor.tsx    # Componente de mapa interactivo
│   │   └── MapWrapper.tsx        # Wrapper para carga dinámica
│   └── mobile/
│       └── MobileGPSTracker.tsx  # Componente de tracking móvil (nuevo)
├── hooks/
│   ├── useRouteCreator.ts        # Hook para creación de rutas
│   ├── useGPSRecorder.ts         # Hook para grabación GPS
│   └── useMobileGPSTracker.ts    # Hook para tracking móvil (nuevo)
├── services/
│   ├── GPSTrackingService.ts     # Servicio GPS avanzado (nuevo)
│   ├── IndexedDBService.ts       # Servicio offline (nuevo)
│   └── SyncManager.ts            # Gestor de sincronización (nuevo)
└── app/
    └── dashboard/
        └── routes/
            ├── page.tsx          # Lista de rutas del usuario
            ├── create/
            │   ├── page.tsx      # Página de creación (dibujo web)
            │   └── mobile/
            │       └── page.tsx  # Página de creación móvil (nuevo)
            └── record/
                └── page.tsx      # Página de grabación (GPS)
```

## Base de Datos

### Tablas

#### `routes`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | Identificador único |
| name | TEXT | Nombre de la ruta |
| description | TEXT | Descripción opcional |
| difficulty | TEXT | Dificultad (Beginner/Intermediate/Expert) |
| distance_km | DECIMAL | Distancia total en km |
| elevation_gain_m | DECIMAL | Elevación acumulada positiva |
| elevation_loss_m | DECIMAL | Elevación acumulada negativa |
| start_lat, start_lng | DECIMAL | Coordenadas de inicio |
| end_lat, end_lng | DECIMAL | Coordenadas de fin |
| created_by | UUID | Usuario creador |
| is_public | BOOLEAN | Visibilidad pública |
| status | TEXT | Estado (draft/active/archived) |
| track_quality | TEXT | Calidad del track (excellent/good/fair/poor) |
| created_at | TIMESTAMPTZ | Fecha de creación |
| updated_at | TIMESTAMPTZ | Fecha de actualización |

#### `route_track_points`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | Identificador único |
| route_id | UUID | Referencia a la ruta |
| latitude | DECIMAL | Latitud del punto |
| longitude | DECIMAL | Longitud del punto |
| altitude | DECIMAL | Altitud (opcional) |
| accuracy | DECIMAL | Precisión en metros |
| timestamp | TIMESTAMPTZ | Marca de tiempo |
| order_index | INTEGER | Orden del punto en el track |

### Instalación del Esquema

1. Abre Supabase Dashboard → SQL Editor
2. Copia el contenido de `supabase/schema-routes.sql`
3. Ejecuta la consulta
4. Verifica que se crearon tablas, funciones y triggers

## Algoritmos de Procesamiento GPS

### 1. Filtro por Precisión
Descarta puntos con precisión mayor a 15 metros (configurable).

### 2. Filtro por Velocidad Imposible
Elimina puntos que implicarían velocidades superiores a 80 km/h (ajustable para downhill).

### 3. Filtro de Kalman (Simplificado)
Suaviza las coordenadas usando un filtro de Kalman con parámetros:
- `kalmanQ`: 0.001 (process noise)
- `kalmanR`: 0.01 (measurement noise)

### 4. Filtro de Distancia Mínima
Elimina puntos muy cercanos (< 3 metros) para evitar redundancia.

### 5. Detección de Outliers Geométricos
Remueve puntos que se desvían más de 20 metros de la línea base.

### 6. Simplificación Douglas-Peucker
Reduce la cantidad de puntos manteniendo la forma del track (tolerancia: 5 metros).

## Uso

### Detectar Dispositivo Automáticamente
El sistema detecta si estás en un dispositivo móvil y sugiere el método de grabación GPS:
- **Móvil**: GPS Tracker en tiempo real (paso a paso)
- **Web**: Editor manual en el mapa

Puedes acceder directamente:
- Móvil: `/dashboard/routes/create/mobile`
- Web: `/dashboard/routes/create`

### Crear Ruta desde el Perfil
1. Ve a tu perfil en `/dashboard/profile`
2. Click en el botón verde `+` (Crear nueva ruta)
3. Selecciona "Dibujar en mapa" o "Grabar en tiempo real"

### 📱 GPS Tracker Móvil (Recomendado para Celulares)
**Flujo paso a paso:**

1. **Paso 1: Punto de Partida**
   - Click en "Usar Mi Ubicación Actual"
   - El sistema obtiene tus coordenadas GPS

2. **Paso 2: Punto de Llegada**
   - Click en "Usar Mi Ubicación Actual"
   - Se establece el punto final de la ruta

3. **Paso 3: Grabación Automática**
   - El tracking inicia automáticamente
   - Camina/pedalea tu ruta
   - **Pausa automática**: Si te detienes (>5 segundos), el tracking se pausa solo
   - **Control de velocidad**: Muestra velocidad actual, promedio y máxima
   - **Métricas en vivo**: Distancia, tiempo, puntos GPS

4. **Finalizar y Guardar**
   - Click en "Finalizar" para detener la grabación
   - Completa nombre, descripción y dificultad
   - Click en "Guardar Ruta"

**Características del Tracking Móvil:**
- ✅ Detección automática de paradas por velocidad
- ✅ Filtrado de precisión GPS (máx 30 metros)
- ✅ Distancia mínima entre puntos (5 metros)
- ✅ Suavizado con filtro de Kalman
- ✅ Métricas en tiempo real
- ✅ Indicador de calidad de señal GPS

### 🖥️ Dibujar en Mapa (Web)
1. Click en "Comenzar a Dibujar"
2. Click para marcar el punto de partida
3. Click para marcar el punto de llegada
4. Agrega puntos intermedios haciendo click en el mapa
5. Click en puntos azules para eliminarlos
6. "Procesar Ruta" para aplicar filtros GPS
7. Completa la información (nombre, dificultad, etc.)
8. "Guardar Ruta"

## APIs y Funciones

### Hook `useRouteCreator`
```typescript
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

### Hook `useGPSRecorder`
```typescript
const {
  isRecording, isPaused, points,
  elapsedTime, currentAccuracy, currentSpeed,
  startRecording, stopRecording,
  pauseRecording, resumeRecording,
  exportPoints,
} = useGPSRecorder({
  recordingInterval: 1000,
  minAccuracy: 15,
  minDistance: 3,
})
```

### Hook `useMobileGPSTracker` (Nuevo)
Hook optimizado para dispositivos móviles con flujo paso a paso:

```typescript
const { state, actions } = useMobileGPSTracker({
  minMovementSpeed: 0.5, // m/s (~1.8 km/h)
  minStopDuration: 5000, // ms (5 segundos)
  samplingInterval: 2000, // ms (2 segundos)
  maxAccuracyThreshold: 30, // metros
  minDistanceBetweenPoints: 5, // metros
  speedAveragingWindow: 10000, // ms (10 segundos)
})

// Estado incluye:
state.step // 'set-start' | 'set-end' | 'tracking' | 'paused' | 'completed'
state.startPoint, state.endPoint, state.trackPoints
state.isTracking, state.isPaused, state.isStopped
state.currentSpeed, state.averageSpeed, state.maxSpeed
state.distanceTraveled, state.elapsedTime
state.accuracy, state.gpsSignalLost

// Acciones:
actions.setStartPoint() // Obtener ubicación actual como inicio
actions.setEndPoint() // Obtener ubicación actual como fin
actions.pauseTracking() // Pausar manualmente
actions.resumeTracking() // Reanudar tracking
actions.completeTracking() // Finalizar y completar
actions.cancelTracking() // Cancelar y reiniciar todo
```

### Componente `MobileGPSTracker`
Componente UI completo para tracking móvil:

```typescript
<MobileGPSTracker
  onComplete={(points, start, end) => {
    // Manejar puntos grabados
    console.log(`Track: ${points.length} puntos`)
  }}
  onCancel={() => {
    // Manejar cancelación
  }}
/>
```

**Características:**
- Flujo paso a paso visual con barra de progreso
- Detección automática de paradas por velocidad
- Métricas en tiempo real (distancia, tiempo, velocidad)
- Indicador de precisión GPS
- Controles de pausa/reanudación
- Consejos de uso integrados

### Servicio `GPSTrackingService`
Servicio avanzado para tracking GPS con filtro de Kalman:

```typescript
const gpsService = new GPSTrackingService()

// Iniciar sesión de tracking
await gpsService.startSession(
  (reading) => {
    console.log('Nueva lectura:', reading)
  },
  (error) => {
    console.error('Error:', error)
  },
  true, // enableHighAccuracy
  0, // maximumAge
  15000 // timeout
)

// Obtener puntos procesados
const points = gpsService.getTrackPoints({
  minAccuracy: 30, // metros
  minDistance: 5 // metros
})

// Obtener estadísticas
const stats = gpsService.getSessionStats()
// {
//   totalPoints: number,
//   totalDistance: number,
//   averageSpeed: number,
//   maxSpeed: number,
//   averageAccuracy: number,
//   duration: number
// }

// Detener sesión
gpsService.stopSession()
```

**Características del Servicio:**
- Filtro de Kalman para suavizar coordenadas
- Evaluación automática de calidad de señal
- Calibración manual de altitud
- Filtrado por precisión y distancia mínima
- Estadísticas completas de la sesión
- Gestión automática de permisos

### Servicio `GPSTrackProcessingService`
```typescript
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
const validation = service.validateRoute(startCoord, endCoord, processedPoints)
// validation: { valid: boolean, errors: string[] }
```

## Tests

Ejecutar tests:
```bash
npm test -- CreateRouteUseCase.test.ts
```

Los tests cubren:
- Cálculo de distancias (Haversine)
- Filtrado por precisión GPS
- Filtrado por velocidad imposible
- Filtrado de puntos cercanos
- Validación de rutas
- Cálculo de calidad del track
- Cálculo de elevación
- Simplificación Douglas-Peucker

## Dependencias

- `leaflet`: Mapas interactivos
- `react-leaflet`: Integración de Leaflet con React
- `@supabase/ssr`: Cliente de Supabase
- `lucide-react`: Íconos

## Configuración de Variables de Entorno

Asegúrate de tener en `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key_anonima
```

## Próximas Mejoras

- [ ] Edición de rutas existentes
- [ ] Importar/exportar rutas en formato GPX
- [ ] Comparación de múltiples tracks en la misma ruta
- [ ] Segmentos intermedios para timing parcial
- [ ] Mapa de calor de rutas populares
- [ ] Sugerencias de rutas basadas en ubicación

## Soporte

Para reportar bugs o sugerencias, crea un issue en el repositorio del proyecto.
