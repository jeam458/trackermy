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
│   └── routes/
│       ├── RouteMapEditor.tsx    # Componente de mapa interactivo
│       └── MapWrapper.tsx        # Wrapper para carga dinámica
├── hooks/
│   ├── useRouteCreator.ts        # Hook para creación de rutas
│   └── useGPSRecorder.ts         # Hook para grabación GPS
└── app/
    └── dashboard/
        └── routes/
            ├── page.tsx          # Lista de rutas del usuario
            ├── create/
            │   └── page.tsx      # Página de creación (dibujo)
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

### Crear Ruta desde el Perfil
1. Ve a tu perfil en `/dashboard/profile`
2. Click en el botón verde `+` (Crear nueva ruta)
3. Selecciona "Dibujar en mapa" o "Grabar en tiempo real"

### Dibujar en Mapa
1. Click en "Comenzar a Dibujar"
2. Click para marcar el punto de partida
3. Click para marcar el punto de llegada
4. Agrega puntos intermedios haciendo click en el mapa
5. Click en puntos azules para eliminarlos
6. "Procesar Ruta" para aplicar filtros GPS
7. Completa la información (nombre, dificultad, etc.)
8. "Guardar Ruta"

### Grabar en Tiempo Real
1. Click en "Grabar Ruta"
2. Click en "Iniciar Grabación" (permite acceso al GPS)
3. Recorre la ruta en bicicleta
4. Pausa si necesitas detenerte
5. Click en "Detener" al finalizar
6. Ingresa el nombre y guarda la ruta

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
