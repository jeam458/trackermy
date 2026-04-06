# Módulo de Tracking GPS para Dispositivos Móviles

## Resumen

Se ha implementado un módulo completo para la creación de rutas mediante **tracking GPS en tiempo real** optimizado para dispositivos móviles, con flujo paso a paso y detección automática de paradas.

## Archivos Creados

### 1. Hook de Tracking Móvil
**Archivo:** `src/hooks/useMobileGPSTracker.ts`

Hook principal que gestiona todo el flujo de tracking GPS con:
- **Flujo paso a paso**: set-start → set-end → tracking → completed
- **Detección automática de paradas**: Pausa el tracking cuando la velocidad es < 1.8 km/h por más de 5 segundos
- **Control de precisión**: Filtra puntos con precisión > 30 metros
- **Distancia mínima**: Solo registra puntos separados por al menos 5 metros
- **Métricas en tiempo real**:
  - Velocidad actual, promedio y máxima
  - Distancia recorrida
  - Tiempo transcurrido
  - Cantidad de puntos GPS
  - Precisión actual de la señal

**Configuración:**
```typescript
{
  minMovementSpeed: 0.5,        // m/s (~1.8 km/h)
  minStopDuration: 5000,        // ms (5 segundos)
  samplingInterval: 2000,       // ms (2 segundos)
  maxAccuracyThreshold: 30,     // metros
  minDistanceBetweenPoints: 5,  // metros
  speedAveragingWindow: 10000,  // ms (10 segundos)
}
```

### 2. Componente UI para Móviles
**Archivo:** `src/components/mobile/MobileGPSTracker.tsx`

Interfaz completa con:
- **Barra de progreso visual**: Muestra el paso actual (33% → 66% → 90% → 100%)
- **Paso 1 - Punto de Partida**: Botón para obtener ubicación actual
- **Paso 2 - Punto de Llegada**: Botón para obtener ubicación final
- **Paso 3 - Tracking en Vivo**:
  - Indicador de estado (GRABANDO/PAUSADO/DETECTADA PARADA)
  - Panel de métricas en tiempo real
  - Controles de Pausar/Reanudar/Finalizar
  - Indicador de precisión GPS con colores
- **Paso Completado**:
  - Resumen final con todas las métricas
  - Botones para Guardar o Grabar Nueva Ruta
- **Consejos de uso**: Tips para mejor señal GPS

### 3. Página de Creación Móvil
**Archivo:** `src/app/dashboard/routes/create/mobile/page.tsx`

Página completa que:
- **Detecta automáticamente** si es dispositivo móvil
- **Ofrece selector de modo**: GPS Tracker (móvil) vs Editor Manual (web)
- **Flujo integrado**:
  1. Iniciar GPS Tracker
  2. Grabar ruta con tracking automático
  3. Completar información (nombre, descripción, dificultad)
  4. Guardar en Supabase
- **Procesamiento de ruta**: Usa `GPSTrackProcessingService` para aplicar filtros
- **Validación completa**: Verifica datos antes de guardar

### 4. Servicio GPS Avanzado
**Archivo:** `src/services/GPSTrackingService.ts`

Servicio de nivel inferior con:
- **Filtro de Kalman**: Suaviza coordenadas GPS para reducir ruido
- **Evaluación de calidad de señal**: Score 0-100 basado en precisión
- **Calibración manual**: Ajuste de altitud si se conoce valor real
- **Gestión de permisos**: Verifica y solicita permisos de ubicación
- **Estadísticas completas**:
  - Total de puntos
  - Distancia total
  - Velocidad promedio y máxima
  - Precisión promedio
  - Duración de sesión
- **Filtros configurables**: Por precisión y distancia mínima

## Características Implementadas

### ✅ Detección Automática de Paradas
- Monitorea velocidad entre puntos consecutivos
- Si velocidad < 1.8 km/h por 5 segundos → **Pausa automática**
- Al volver a moverse → **Reanudación automática**
- Muestra cuenta regresiva antes de pausar

### ✅ Control de Velocidad
- **Velocidad actual**: Entre últimos dos puntos
- **Velocidad promedio**: Distancia total / tiempo total
- **Velocidad máxima**: Registrada durante todo el tracking
- **Historial de velocidad**: Últimas 10 lecturas para promedio

### ✅ Ventanas de Tiempo de Muestreo
- **Intervalo de muestreo**: Cada 2 segundos
- **Ventana de promedio**: 10 segundos para velocidad promedio
- **Timeout de GPS**: 15 segundos máximo por lectura
- **Sin caché**: MaximumAge = 0 (siempre obtiene ubicación fresca)

### ✅ Filtrado Inteligente
1. **Precisión mínima**: 30 metros máximo
2. **Distancia mínima**: 5 metros entre puntos
3. **Filtro de Kalman**: Suavizado de coordenadas
4. **Detección de outliers**: Puntos con velocidad imposible

### ✅ Flujo Paso a Paso
```
┌─────────────────────────────────────┐
│  Paso 1: Punto de Partida (33%)    │
│  [Usar Mi Ubicación Actual]        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Paso 2: Punto de Llegada (66%)    │
│  [Usar Mi Ubicación Actual]        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Paso 3: Grabando Ruta (90%)       │
│  [Métricas en vivo + Controles]    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Completado (100%)                  │
│  [Resumen + Guardar]                │
└─────────────────────────────────────┘
```

## Integración con Sistema Existente

### Compatibilidad
- ✅ Usa el mismo `GPSTrackProcessingService` que el editor web
- ✅ Guarda en las mismas tablas de Supabase
- ✅ Mismos algoritmos de validación y filtrado
- ✅ Compatible con `RouteMapViewer` para visualización

### Diferencias con Editor Web
| Característica | Web (Manual) | Móvil (GPS) |
|----------------|--------------|-------------|
| **Entrada** | Click en mapa | GPS automático |
| **Puntos** | Manuales | Automáticos cada 2s |
| **Precisión** | Depende del usuario | Filtrada automáticamente |
| **Velocidad** | No aplica | Monitoreada en vivo |
| **Paradas** | No aplica | Detección automática |
| **Tiempo** | No aplica | Cronómetro en vivo |
| **Distancia** | Estimada | Real recorrida |

## Uso

### Desde un Dispositivo Móvil

1. **Acceder a la página**:
   - Directo: `/dashboard/routes/create/mobile`
   - Desde perfil: Botón `+` → "Grabar en tiempo real"

2. **Paso 1 - Punto de Partida**:
   - Permitir acceso a ubicación
   - Click en "Usar Mi Ubicación Actual"
   - Se obtienen coordenadas GPS

3. **Paso 2 - Punto de Llegada**:
   - Moverse al punto final (opcional)
   - Click en "Usar Mi Ubicación Actual"
   - Inicia tracking automáticamente

4. **Paso 3 - Grabación**:
   - Caminar/pedalear la ruta
   - **Pausa automática** si te detienes
   - Ver métricas en tiempo real
   - Pausar/Reanudar manualmente si deseas
   - Click "Finalizar" al terminar

5. **Guardar Ruta**:
   - Completar nombre, descripción, dificultad
   - Click en "Guardar Ruta"
   - Redirige a perfil con ruta creada

### Desde la Web (Desktop)
- El sistema detecta que no es móvil
- Ofrece selector para elegir método
- Por defecto sugiere editor manual
- Puede acceder a versión móvil si desea

## Configuración de Permisos

El sistema solicita permisos de ubicación con:
- **enableHighAccuracy**: true (usa GPS real, no WiFi/celdas)
- **timeout**: 15 segundos (máximo de espera)
- **maximumAge**: 0 (no acepta caché)

### Manejo de Errores
- **Permiso denegado**: Mensaje claro para activar en navegador
- **Ubicación no disponible**: Explica el problema
- **Timeout**: Sugiere reintentar
- **Precisión insuficiente**: Filtra automáticamente

## Pruebas

### Compilación
✅ Build exitoso sin errores:
```bash
npm run build
```

Ruta compilada:
- `/dashboard/routes/create/mobile` ✓

### Pruebas Recomendadas

1. **En Dispositivo Móvil Real**:
   ```
   1. Abrir en celular
   2. Permitir permisos de ubicación
   3. Seguir flujo paso a paso
   4. Verificar pausa automática al detenerse
   5. Verificar reanudación al caminar
   ```

2. **Simulación en Navegador**:
   ```
   1. Chrome DevTools → Device Mode
   2. Simular ubicación (Sensors)
   3. Probar flujo completo
   ```

3. **Pruebas de Precisión**:
   ```
   1. Caminar ruta conocida
   2. Comparar distancia GPS vs real
   3. Verificar filtrado de puntos
   ```

## Próximas Mejoras Sugeridas

- [ ] **Background tracking**: Seguir grabando con app en segundo plano
- [ ] **Notificaciones**: Alertas de pausa/reanudación
- [ ] **Mapa en vivo**: Mostrar posición actual en mapa durante tracking
- [ ] **Importar GPX**: Cargar rutas desde archivos
- [ ] **Exportar GPX**: Descargar rutas grabadas
- [ ] **Segmentos**: Marcar puntos intermedios como "segmentos"
- [ ] **Audio feedback**: Sonidos al iniciar/pausar/detener
- [ ] **Modo offline**: Guardar local y sincronizar después

## Métricas de Calidad

### Precisión GPS
- **Excelente**: < 5m (verde)
- **Buena**: 5-10m (azul)
- **Regular**: 10-20m (amarillo)
- **Pobre**: > 20m (rojo)

### Calidad del Track
Se usa el mismo sistema que el editor web:
- **Excellent**: < 5% puntos filtrados
- **Good**: 5-15% puntos filtrados
- **Fair**: 15-30% puntos filtrados
- **Poor**: > 30% puntos filtrados

## Notas Técnicas

### Filtro de Kalman
Implementación simplificada:
```
estimate = estimate + kalmanGain * (measurement - estimate)
kalmanGain = errorEstimate / (errorEstimate + errorMeasurement)
```

### Detección de Paradas
```
if (speed < 0.5 m/s) {
  stopDuration += elapsed
  if (stopDuration >= 5000ms) {
    pauseTracking()
  }
} else {
  stopDuration = 0
  if (isPaused) resumeTracking()
}
```

### Cálculo de Velocidad
```
speed = haversineDistance(point1, point2) / timeDiff
```

## Documentación Relacionada

- `ROUTES_MODULE_README.md` - Documentación completa del módulo de rutas
- `SUPABASE_SETUP_GUIDE.md` - Configuración de base de datos
- `QUICK_START.md` - Inicio rápido del proyecto

## Soporte

Para reportar bugs o sugerencias del módulo móvil:
1. Revisar consola del navegador para errores de GPS
2. Verificar permisos de ubicación activados
3. Comprobar que GPS está habilitado en dispositivo
4. Crear issue en repositorio del proyecto

---

**Fecha de implementación**: 5 de abril de 2026
**Versión**: 1.0.0
**Estado**: ✅ Completado y compilado exitosamente
