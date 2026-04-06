# Módulo de Cronometraje y Ranking de Rutas

## ✅ Implementación Completa

Sistema completo para cronometrar recorridos de riders, analizar rendimiento, y mostrar rankings con los mejores tiempos.

---

## 🎯 Características Principales

### ⏱️ Cronómetro de Ruta
- **Tiempo en tiempo real** con precisión de centésimas
- **Velocidad actual, máxima y promedio** en vivo
- **Distancia recorrida** calculada por GPS
- **Altitud** en tiempo real
- **Pausar/Reanudar** el cronómetro
- **Funciona offline** - guarda localmente y sincroniza después

### 📊 Análisis de Rendimiento
- **Velocidades**: mínima, máxima, promedio, mediana
- **Elevación**: ganancia y pérdida total
- **Detección de saltos**: altura, distancia, severidad
- **Movimientos bruscos**: giros > 30° con dirección
- **Frenadas fuertes**: deceleración > 3 m/s²
- **Aceleraciones**: aceleración > 2 m/s²
- **Paradas**: detección automática de paradas > 3s
- **Segmentos**: división cada 100m con análisis individual

### 🏆 Sistema de Scores
- **Ritmo (0-100)**: qué tan constante fue el rider
- **Intensidad (0-100)**: velocidad + elevación
- **Agresividad (0-100)**: saltos + giros + frenadas
- **Score General (0-100)**: ponderación de todos los anteriores

### 📈 Dashboard de Ruta
- **Estadísticas completas** de la ruta
- **Mejor tiempo** destacado
- **Total de intentos** y riders únicos
- **Velocidad máxima registrada**
- **Promedios** de la comunidad

### 🥇 Ranking y Leaderboard
- **Top 3 visual** con medallas (oro, plata, bronce)
- **Tabla completa** paginada
- **Scores y métricas** por intento
- **Indicador de PB** (Personal Best)
- **Ordenado por tiempo** ascendente

### 🧭 Navegación en Ruta
- **Indicaciones de dirección** para seguir la ruta
- **Detección de desviación** si se sale del camino
- **Funciona offline** - sin necesidad de internet
- **Próximos puntos** para visualizar en mapa
- **Distancia restante** y progreso

---

## 📁 Archivos Creados

### 1. RoutePerformanceService
**Archivo:** `src/services/RoutePerformanceService.ts`

Servicio de análisis de rendimiento:

```typescript
import { RoutePerformanceService, GPSPoint } from '@/services/RoutePerformanceService'

const service = new RoutePerformanceService()
const performance = service.analyzePerformance(gpsPoints)

// Resultado:
{
  totalTime: 245.5,           // segundos
  movingTime: 230.2,          // segundos en movimiento
  stoppedTime: 15.3,          // segundos detenido
  minSpeed: 0,                // m/s
  maxSpeed: 18.5,             // m/s (~66 km/h)
  avgSpeed: 12.3,             // m/s (~44 km/h)
  medianSpeed: 11.8,          // m/s
  totalDistance: 2850,        // metros
  elevationGain: 125,         // metros
  elevationLoss: 340,         // metros
  
  // Eventos detectados
  jumps: [                    // Saltos detectados
    {
      height: 1.5,            // metros
      distance: 8.2,          // metros
      duration: 0.6,          // segundos
      severity: 'medium',
      landingSpeed: 15.2,     // m/s
    }
  ],
  sharpMovements: [           // Giros bruscos
    {
      direction: 'left',
      angle: 45,              // grados
      speed: 10.5,            // m/s
      severity: 'moderate',
    }
  ],
  hardBrakes: [               // Frenadas fuertes
    {
      deceleration: 4.5,      // m/s²
      speedBefore: 15,
      speedAfter: 8,
      severity: 'hard',
    }
  ],
  
  // Scores
  rhythmScore: 78,            // qué tan constante
  intensityScore: 85,         // qué tan intenso
  aggressionScore: 62,        // qué tan agresivo
  overallScore: 76,           // score general
}
```

**Detección de Eventos:**

#### Saltos
- Detecta patrón: subida rápida + bajada rápida
- Calcula altura, distancia y duración
- Clasifica severidad: light (< 1m), medium (1-2m), hard (> 2m)

#### Movimientos Bruscos
- Calcula bearing entre puntos consecutivos
- Detecta cambios > 30°
- Dirección: left/right
- Severidad: mild (30-60°), moderate (60-90°), sharp (> 90°)

#### Frenadas Fuertes
- Deceleración > 3 m/s²
- Severidad: moderate (3-4.5), hard (4.5-6), extreme (> 6)

#### Paradas
- Velocidad < 0.5 m/s por > 3 segundos
- Registra ubicación y duración

### 2. useRouteTimer Hook
**Archivo:** `src/hooks/useRouteTimer.ts`

Hook para cronometraje en tiempo real:

```typescript
import { useRouteTimer } from '@/hooks/useRouteTimer'

const { state, actions } = useRouteTimer(routeId, userId)

// Estado:
{
  isRunning: true,
  isPaused: false,
  isFinished: false,
  elapsedTime: 125.5,        // segundos
  currentSpeed: 12.5,        // m/s
  maxSpeed: 18.2,            // m/s
  avgSpeed: 11.8,            // m/s
  distance: 1500,            // metros
  altitude: 3250,            // metros
  gpsPoints: [...],          // puntos GPS
  isOnline: true,
}

// Acciones:
actions.startTimer()         // Iniciar cronómetro
actions.pauseTimer()         // Pausar
actions.resumeTimer()        // Reanudar
const performance = await actions.finishTimer()  // Finalizar y analizar
actions.cancelTimer()        // Cancelar todo
```

### 3. RouteTimer Component
**Archivo:** `src/components/routes/RouteTimer.tsx`

Componente UI completo del cronómetro:

**Estados:**
1. **No iniciado**: Botón "Iniciar Cronómetro"
2. **En progreso**: Métricas en vivo + controles
3. **Finalizado**: Resultados completos + guardar

**Métricas en vivo:**
- Tiempo con centésimas
- Velocidad actual, máxima, promedio
- Distancia recorrida
- Altitud actual

**Resultados finales:**
- Score general destacado
- Tiempo final detallado
- Velocidades (mín, prom, máx)
- Eventos detectados (saltos, frenadas, giros, paradas)
- Scores de rendimiento con barras de progreso

### 4. Route Dashboard
**Archivo:** `src/app/dashboard/routes/[id]/page.tsx`

Página de dashboard de ruta:

**Información mostrada:**
- Distancia, elevación, dificultad
- Total de riders únicos
- Mejor tiempo destacado
- Estadísticas completas:
  - Total de intentos
  - Tiempo promedio
  - Score promedio
  - Velocidad máxima registrada
  - Saltos y paradas promedio
- Botón "Iniciar Recorrido"
- Link a ranking completo

### 5. Route Ranking Page
**Archivo:** `src/app/dashboard/routes/[id]/ranking/page.tsx`

Página de ranking/leaderboard:

**Visualización:**
- **Top 3 destacado**: Oro, plata, bronce con medallas
- **Lista completa**: Paginada (10 por página)
- **Cada entrada muestra**:
  - Posición con medalla
  - Nombre del rider
  - Tiempo (formato MM:SS.ms)
  - Velocidad máxima
  - Score general
  - Fecha del intento
  - Indicador PB (Personal Best)

### 6. Supabase Schema
**Archivo:** `supabase/schema-route-attempts.sql`

Esquema de base de datos completo:

**Tabla `route_attempts`:**
```sql
- Tiempos (total, movimiento, detenido)
- Velocidades (máx, prom)
- Distancia y elevación
- Eventos (saltos, giros, frenadas, paradas)
- Scores (ritmo, intensidad, agresividad, general)
- GPS points (JSON)
- Metadata (público/privado, fecha)
```

**Funciones SQL:**
- `get_route_ranking()`: Obtiene ranking paginado
- `get_user_best_attempt()`: Mejor tiempo de usuario
- `get_route_statistics()`: Estadísticas agregadas

**Índices optimizados:**
- Por ruta y tiempo (ranking)
- Por usuario (mis intentos)
- Por fecha (recientes)

### 7. RouteNavigationService
**Archivo:** `src/services/RouteNavigationService.ts`

Servicio de navegación para seguir rutas:

```typescript
import { RouteNavigationService } from '@/services/RouteNavigationService'

const nav = new RouteNavigationService()
nav.setRoute(routePoints)

// En cada actualización GPS:
const state = nav.updateLocation(currentLocation)

// Estado de navegación:
{
  isNavigating: true,
  currentInstruction: {
    distance: 45,              // metros hasta el giro
    direction: 'left',         // dirección
    angle: 45,                 // grados
    instruction: 'Gira a la izquierda en 45 m',
  },
  distanceRemaining: 1250,     // metros totales
  progress: 65,                // porcentaje
  isOnRoute: true,             // ¿cerca de la ruta?
  deviation: 5,                // metros de desviación
  nextPoints: [...],           // próximos 10 puntos
}
```

**Características:**
- Detecta giros y genera instrucciones
- Verifica si está en la ruta (±20m)
- Calcula distancia restante
- Funciona completamente offline
- Genera instrucciones de voz (texto)

---

## 🎮 Flujo de Uso

### Para el Rider

1. **Ver ruta pública**:
   - Accede a `/dashboard/routes/[id]`
   - Ve estadísticas y mejor tiempo

2. **Iniciar recorrido**:
   - Click en "Iniciar Recorrido"
   - El cronómetro se activa

3. **Recorrer la ruta**:
   - Ve métricas en tiempo real
   - Puede pausar si necesita
   - GPS registra todo automáticamente

4. **Finalizar**:
   - Click en "Finalizar"
   - Ve análisis completo de rendimiento
   - Scores detallados
   - Eventos detectados

5. **Guardar**:
   - Click en "Guardar y Ver Ranking"
   - Se guarda en Supabase (o local si offline)
   - Redirige al ranking

6. **Ver ranking**:
   - Compara su tiempo con otros riders
   - Ve su posición en el leaderboard

### Para Rutas Públicas

Si la ruta es pública, otros riders pueden:
- Ver el dashboard con estadísticas
- Intentar batir el mejor tiempo
- Ver el ranking completo
- Competir por el mejor tiempo

---

## 📊 Scores Explicados

### Score de Ritmo (0-100)
Mide qué tan constante fue el rider:
- **Alto (> 80)**: Velocidad constante, pocas variaciones
- **Medio (50-80)**: Algunas variaciones pero controladas
- **Bajo (< 50)**: Muchas paradas y cambios de ritmo

**Cálculo**: Basado en coeficiente de variación de velocidad

### Score de Intensidad (0-100)
Mide qué tan intenso fue el recorrido:
- **Alto (> 80)**: Alta velocidad + mucha elevación
- **Medio (50-80)**: Velocidad moderada o elevación media
- **Bajo (< 50)**: Baja velocidad y plano

**Cálculo**: 60% velocidad promedio + 40% elevación/distancia

### Score de Agresividad (0-100)
Mide qué tan agresivo fue el estilo:
- **Alto (> 80)**: Muchos saltos, giros bruscos, frenadas
- **Medio (50-80)**: Algunos eventos moderados
- **Bajo (< 50)**: Conducción suave, pocos eventos

**Cálculo**: Puntos ponderados por severidad de eventos

### Score General (0-100)
Ponderación de todos los scores:
- 30% Ritmo
- 30% Intensidad
- 20% Agresividad
- 20% Velocidad máxima

---

## 🔧 Configuración

### RoutePerformanceService

```typescript
// Umbrales de detección (en el código):
- Salto: subida > 0.5m + bajada > 0.5m
- Giro brusco: > 30° de cambio
- Frenada fuerte: > 3 m/s² deceleración
- Aceleración: > 2 m/s²
- Parada: < 0.5 m/s por > 3s
- Segmento: cada 100 metros
```

### RouteNavigationService

```typescript
const config = {
  maxDistanceToRoute: 20,        // metros para estar "en ruta"
  instructionAnticipation: 30,   // metros para anticipar giro
  pointsAhead: 10,               // puntos a mostrar ahead
}
```

---

## 📱 Experiencia Offline

### Funciona sin internet:
- ✅ Cronometraje completo
- ✅ GPS tracking
- ✅ Análisis de rendimiento
- ✅ Detección de eventos
- ✅ Cálculo de scores
- ✅ Almacenamiento local (IndexedDB)

### Sincronización automática:
- Detecta cuando vuelve internet
- Sube intento a Supabase
- Actualiza ranking

---

## 🎨 UI/UX

### Cronómetro En Progreso
```
┌─────────────────────────────────┐
│ 🟢 EN PROGRESO                  │
├─────────────────────────────────┤
│ ⏱️ 02:35.45                     │
│ 🚀 45.2 km/h (actual)           │
│ 📈 52.8 km/h (máx)              │
│ 📊 38.5 km/h (prom)             │
│ 📍 1.25 km                      │
│ ⛰️ 3250 m                       │
├─────────────────────────────────┤
│ [⏸️ Pausar]  [⏹️ Finalizar]     │
│ [↩️ Cancelar]                   │
└─────────────────────────────────┘
```

### Resultados Finales
```
┌─────────────────────────────────┐
│ 🏆 Score General                │
│        76                       │
│     de 100 puntos               │
├─────────────────────────────────┤
│ ⏱️ Tiempo Final: 02:35.45       │
│   En movimiento: 02:20.12       │
│   Detenido: 00:15.33            │
├─────────────────────────────────┤
│ Velocidades:                    │
│ Mín: 0.0 | Prom: 38.5 | Máx: 52.8│
├─────────────────────────────────┤
│ Eventos:                        │
│ Saltos: 3 | Frenadas: 2         │
│ Giros: 5 | Paradas: 1           │
├─────────────────────────────────┤
│ Scores:                         │
│ Ritmo:      ████████░░ 78%      │
│ Intensidad: █████████░ 85%      │
│ Agresividad:██████░░░░ 62%      │
└─────────────────────────────────┘
```

### Ranking Top 3
```
        👑
       1°
    Rider A
   02:30.45
  55.2 km/h

2°         3°
Rider B    Rider C
02:35.12   02:40.88
52.8 km/h  48.5 km/h
```

---

## 🚀 Próximas Mejoras

- [ ] **Mapa en vivo** con posición del rider
- [ ] **Notificaciones de voz** para navegación
- [ ] **Segmentos intermedios** con tiempos parciales
- [ ] **Comparación en vivo** con mejor tiempo
- [ ] **Heatmap** de zonas rápidas/lentas
- [ ] **Logros** por hitos (primer salto, etc.)
- [ ] **Compartir** intento en redes
- [ ] **Video sync** con GoPro/cámara
- [ ] **Training mode** con objetivo de tiempo
- [ ] **Live tracking** para espectadores

---

## 📚 Instalación del Schema

Ejecutar en Supabase SQL Editor:

```bash
# Copiar contenido de:
supabase/schema-route-attempts.sql

# Ejecutar en SQL Editor
```

Esto creará:
- Tabla `route_attempts`
- Tabla `route_segment_records`
- Funciones de ranking y estadísticas
- Índices optimizados
- Políticas de seguridad (RLS)
- Trigger para notificaciones

---

**Fecha de implementación**: 5 de abril de 2026
**Versión**: 1.0.0
**Estado**: ✅ Completado y compilado exitosamente
