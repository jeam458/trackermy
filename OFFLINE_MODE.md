# Modo Offline - GPS Tracker Móvil

## ✅ Implementación Completa

El módulo de tracking GPS ahora funciona **completamente sin conexión a internet**, guardando todos los datos localmente y sincronizando automáticamente cuando se restaura la conexión.

---

## 📊 ¿Cómo Funciona?

### Flujo Offline

```
┌─────────────────────────────────────────────────────────┐
│  1. Usuario inicia tracking (sin internet)              │
│     ↓                                                    │
│  2. GPS obtiene coordenadas (funciona sin internet)     │
│     ↓                                                    │
│  3. Puntos se guardan en IndexedDB (local)              │
│     ↓                                                    │
│  4. Usuario completa ruta                               │
│     ↓                                                    │
│  5. Ruta completa se almacena localmente                │
│     ↓                                                    │
│  6. Cuando vuelve internet → Sincronización automática  │
└─────────────────────────────────────────────────────────┘
```

---

## 🗂️ Archivos Creados/Modificados

### 1. IndexedDB Service
**Archivo:** `src/services/IndexedDBService.ts`

Servicio de almacenamiento local con:
- **Base de datos IndexedDB**: `BikeTrackerOfflineDB`
- **2 Object Stores**:
  - `sessions`: Sesiones de tracking completas
  - `trackPoints`: Puntos GPS individuales
- **Índices optimizados**: Búsqueda por estado, sesión, sincronización

**Funcionalidades:**
```typescript
// Guardar sesión
await indexedDBService.saveSession(session)

// Guardar puntos en batch
await indexedDBService.savePointsBatch(points)

// Obtener sesiones pendientes
await indexedDBService.getPendingSessions()

// Obtener puntos de sesión
await indexedDBService.getSessionPoints(sessionId)

// Marcar como sincronizado
await indexedDBService.markSessionPointsAsSynced(sessionId)

// Estadísticas de almacenamiento
await indexedDBService.getStats()
```

### 2. Sync Manager
**Archivo:** `src/services/SyncManager.ts`

Gestor de sincronización automática:
- **Detección de conexión**: Escucha eventos `online`/`offline`
- **Sincronización automática**: Intenta al detectar conexión
- **Reintentos automáticos**: Cada 30 segundos
- **Sincronización manual**: Botón forzar sync
- **Gestión de errores**: Reintentos con tracking de fallos

**Estados de sincronización:**
```typescript
type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'waiting'

interface SyncState {
  isOnline: boolean
  syncStatus: SyncStatus
  lastSyncTime: Date | null
  pendingSessions: number
  pendingPoints: number
  error: string | null
}
```

### 3. Hook Actualizado
**Archivo:** `src/hooks/useMobileGPSTracker.ts`

Nuevas propiedades de estado:
```typescript
interface TrackingState {
  // ... existente ...
  
  // Nuevo: Estado de conexión
  isOnline: boolean           // ¿Hay conexión a internet?
  isOfflineMode: boolean      // ¿Está en modo offline?
  syncStatus: SyncStatus      // Estado de sincronización
  pendingSync: boolean        // ¿Hay datos pendientes?
}
```

**Guardado automático al completar:**
```typescript
const completeTracking = async () => {
  const isOnline = navigator.onLine
  
  if (!isOnline) {
    // Guardar en IndexedDB
    await indexedDBService.saveSession({...})
    await indexedDBService.savePointsBatch(points)
    console.log('✅ Ruta guardada localmente (modo offline)')
  }
  
  // Actualizar estado
  setState({ isOnline, isOfflineMode: !isOnline, pendingSync: !isOnline })
}
```

### 4. UI Actualizada
**Archivo:** `src/components/mobile/MobileGPSTracker.tsx`

Nuevos componentes visuales:

#### Indicador de Conexión (Header)
```typescript
<ConnectionStatusIndicator
  isOnline={state.isOnline}
  syncStatus={state.syncStatus}
  pendingSync={state.pendingSync}
  onSync={handleManualSync}
/>
```

**Muestra:**
- 🟢 **Online** - Conexión activa
- 🔴 **Offline** - Sin conexión, datos guardados localmente
- 🟡 **Pendiente** - Hay rutas por sincronizar (con botón de sync)
- 🔵 **Sincronizando** - En proceso de sync
- ✅ **Sincronizado** - Sync completado

#### Notificación de Modo Offline
```typescript
{!state.isOnline && (
  <div className="bg-amber-500/10 border-2 border-amber-500/30">
    <WifiOff />
    <h4>Modo Offline</h4>
    <p>Tu ruta se guardará localmente y se sincronizará automáticamente...</p>
  </div>
)}
```

#### Consejos Dinámicos
```typescript
{!state.isOnline && (
  <li className="text-amber-400">
    • 📴 Modo offline: tus datos se guardan localmente
  </li>
)}
{state.pendingSync && (
  <li className="text-blue-400">
    • 🔄 Hay rutas pendientes de sincronización
  </li>
)}
```

---

## 🎯 Características Implementadas

### ✅ Almacenamiento Local (IndexedDB)
- **Persistencia**: Datos sobreviven cierre de navegador
- **Capacidad**: ~50-250MB dependiendo del navegador
- **Automático**: No requiere intervención del usuario
- **Eficiente**: Batch inserts para mejor rendimiento

### ✅ Detección de Conexión
- **Eventos nativos**: `window.addEventListener('online'/'offline')`
- **Estado en tiempo real**: Actualización instantánea
- **Verificación proactiva**: `navigator.onLine`

### ✅ Sincronización Automática
- **Al detectar conexión**: Intenta inmediatamente
- **Reintentos periódicos**: Cada 30 segundos
- **Manual**: Botón para forzar sincronización
- **Procesamiento incluido**: Aplica filtros GPS al sincronizar

### ✅ Indicadores Visuales
- **Header**: Estado de conexión siempre visible
- **Notificación**: Banner explicativo cuando está offline
- **Progreso**: Muestra avance de sincronización
- **Errores**: Mensajes claros si falla sync

### ✅ Gestión de Errores
- **Reintentos automáticos**: Hasta que funcione
- **Tracking de fallos**: Contador de intentos
- **Estados claros**: idle → syncing → success/error
- **Logs detallados**: Console para debugging

---

## 📱 Experiencia de Usuario

### Escenario 1: Sin Internet desde el Inicio

1. **Usuario abre app** → Detecta offline
2. **Muestra banner** → "Modo Offline - Datos guardados localmente"
3. **Inicia tracking** → GPS funciona normal (sin internet)
4. **Puntos se guardan** → IndexedDB automáticamente
5. **Completa ruta** → Almacena sesión + puntos localmente
6. **Indicador muestra** → "Pendiente de sincronización"
7. **Cuando hay internet** → Sincroniza automáticamente ✅

### Escenario 2: Pierde Internet durante Tracking

1. **Tracking activo** → Con internet
2. **Pierde conexión** → Detecta automáticamente
3. **Cambia a offline** → Sigue grabando GPS localmente
4. **Usuario sigue** → Sin interrupciones
5. **Completa ruta** → Guarda local si sigue offline
6. **O sincroniza** → Si ya volvió conexión

### Escenario 3: Sincronización Manual

1. **Hay datos pendientes** → Indicador amarillo
2. **Usuario ve botón** → Icono de refresh
3. **Click en sincronizar** → Fuerza sync
4. **Muestra progreso** → "Sincronizando..."
5. **Completa** → "✅ Sincronizado"

---

## 🔧 Configuración Técnica

### IndexedDB Estructura

```javascript
Database: BikeTrackerOfflineDB
Version: 1

ObjectStore: sessions
  Key: id (string)
  Indexes:
    - status (string)
    - userId (string)
    - createdAt (string)
    - syncAttempts (number)

ObjectStore: trackPoints
  Key: id (autoIncrement)
  Indexes:
    - sessionId (string)
    - synced (boolean)
    - orderIndex (number)
    - timestamp (string)
```

### Datos Guardados por Sesión

```typescript
interface OfflineSession {
  id: string                    // UUID único
  userId: string | null         // Se llena al sincronizar
  name: string | null           // Se puede editar después
  description: string | null
  difficulty: string | null
  isPublic: boolean
  startPoint: string            // JSON {latitude, longitude}
  endPoint: string | null       // JSON {latitude, longitude}
  status: 'in-progress' | 'completed' | 'synced' | 'failed'
  syncAttempts: number          // Contador de intentos
  lastSyncAttempt: string | null
  createdAt: string
  updatedAt: string
  metadata: string | null
}

interface OfflineTrackPoint {
  id?: number                   // Auto-incremental
  sessionId: string             // FK a sesión
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number | null
  speed: number
  heading: number | null
  timestamp: string             // ISO string
  orderIndex: number            // Orden correcto
  synced: boolean               // ¿Ya se sincronizó?
  createdAt: string
}
```

### Proceso de Sincronización

```typescript
async syncSingleSession(session, userId) {
  // 1. Obtener puntos locales
  const offlinePoints = await indexedDBService.getSessionPoints(session.id)
  
  // 2. Convertir a formato de procesamiento
  const gpsPoints = offlinePoints.map(p => ({...}))
  
  // 3. Procesar con filtros GPS
  const processedTrack = processingService.processTrack(gpsPoints)
  
  // 4. Preparar request
  const routeData: RouteCreationRequest = {
    name: session.name || `Ruta offline ${fecha}`,
    description: session.description || 'Grabada sin conexión',
    ...
  }
  
  // 5. Guardar en Supabase
  const route = await routeRepository.createRoute(routeData, userId)
  
  // 6. Marcar como sincronizado
  await indexedDBService.updateSessionStatus(session.id, 'synced')
  await indexedDBService.markSessionPointsAsSynced(session.id)
}
```

---

## 📊 Métricas de Almacenamiento

### Estadísticas Disponibles

```typescript
const stats = await indexedDBService.getStats()
// {
//   totalSessions: 5,
//   pendingSync: 2,
//   syncedSessions: 3,
//   failedSync: 0,
//   totalPoints: 1250,
//   storageUsed: 524288 // bytes (~512KB)
// }
```

### Limpieza Automática

```typescript
// Limpiar sesiones sincronizadas mayores a 7 días
await indexedDBService.cleanupOldSessions(7)

// O limpiar todo
await indexedDBService.clearAll()
```

---

## 🎨 UI/UX

### Estados Visuales

#### Online (Normal)
```
┌────────────────────────────────────┐
│ 🟢 Online                          │
└────────────────────────────────────┘
```

#### Offline (Sin conexión)
```
┌────────────────────────────────────┐
│ 🔴 Offline • Datos guardados       │
│   localmente                       │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ ⚠️ Modo Offline                    │
│ Sin conexión a internet. Tu ruta   │
│ se guardará localmente y se        │
│ sincronizará automáticamente...    │
└────────────────────────────────────┘
```

#### Pendiente de Sincronización
```
┌────────────────────────────────────┐
│ 🟡 Online • 🔄 Pendiente de sync  │
│    [↻]                             │
└────────────────────────────────────┘
```

#### Sincronizando
```
┌────────────────────────────────────┐
│ 🔵 Online • ⏳ Sincronizando...    │
└────────────────────────────────────┘
```

#### Sincronizado
```
┌────────────────────────────────────┐
│ 🟢 Online • ✅ Sincronizado        │
└────────────────────────────────────┘
```

---

## 🧪 Pruebas Recomendadas

### Prueba 1: Modo Offline Completo

1. **Activar modo avión** en dispositivo
2. **Abrir app** → Debe mostrar banner offline
3. **Iniciar tracking** → GPS funciona normal
4. **Completar ruta** → Guarda en IndexedDB
5. **Desactivar modo avión** → Detecta conexión
6. **Esperar 30s** → Sincroniza automáticamente
7. **Verificar en perfil** → Ruta aparece en Supabase

### Prueba 2: Pérdida de Conexión

1. **Iniciar tracking** con internet
2. **Activar modo avión** durante tracking
3. **Continuar grabando** → Sin interrupciones
4. **Completar ruta** → Guarda local
5. **Desactivar modo avión** → Sincroniza

### Prueba 3: Sincronización Manual

1. **Tener datos pendientes** (offline)
2. **Volver a tener internet**
3. **Ver indicador amarillo** en header
4. **Click en botón sync** [↻]
5. **Ver progreso** → "Sincronizando..."
6. **Ver confirmación** → "✅ Sincronizado"

### Prueba 4: Múltiples Sesiones Offline

1. **Grabar 3 rutas** sin internet
2. **Todas se guardan** localmente
3. **Conectar a internet**
4. **Ver sincronización** una por una
5. **Todas aparecen** en Supabase

---

## 🚀 Rendimiento

### Optimizaciones Implementadas

- **Batch inserts**: Múltiples puntos en una transacción
- **Índices optimizados**: Búsquedas rápidas
- **Lazy loading**: IndexedDB se inicializa bajo demanda
- **Debounced sync**: No satura con reintentos
- **Procesamiento local**: Filtros GPS antes de enviar

### Capacidad Estimada

```
1 hora de tracking ≈ 1800 puntos (cada 2s)
Tamaño promedio ≈ 500 bytes/punto
Total ≈ 900KB por hora

IndexedDB capacity ≈ 50-250MB
Rutas almacenables ≈ 55-277 horas de tracking
```

---

## 📝 Notas Importantes

### ✅ Lo que FUNCIONA sin internet:
- Obtener coordenadas GPS
- Tracking en tiempo real
- Cálculo de métricas (velocidad, distancia, tiempo)
- Detección de paradas
- Almacenamiento de puntos
- Completar sesiones

### ❌ Lo que NO funciona sin internet:
- Ver mapas (tiles requieren internet)
- Sincronizar con Supabase
- Autenticación de usuario
- Visualización de rutas de otros usuarios

### ⚠️ Consideraciones:
1. **GPS ≠ Internet**: El GPS funciona sin datos móviles
2. **IndexedDB es local**: Se borra si usuario limpia datos del navegador
3. **Sincronización requiere auth**: Usuario debe estar logado al sincronizar
4. **Reintentos infinitos**: Hasta que funcione (con intervalo de 30s)

---

## 🔄 Migración de Datos

### Si el usuario limpia datos del navegador:
- ❌ Se pierden sesiones no sincronizadas
- ✅ Sesiones en Supabase permanecen
- 💡 **Recomendación**: Sincronizar lo antes posible

### Futuras mejoras:
- [ ] Exportar rutas a archivo GPX local
- [ ] Importar rutas desde archivo
- [ ] Backup automático a cloud
- [ ] Service Worker para background sync

---

## 📚 APIs Utilizadas

### Navigator.onLine
```typescript
// Verificar estado
const isOnline = navigator.onLine

// Escuchar cambios
window.addEventListener('online', handler)
window.addEventListener('offline', handler)
```

### IndexedDB
```typescript
// Abrir base de datos
const request = indexedDB.open('BikeTrackerOfflineDB', 1)

// Crear object stores
db.createObjectStore('sessions', { keyPath: 'id' })
db.createObjectStore('trackPoints', { keyPath: 'id', autoIncrement: true })

// Transacciones
const transaction = db.transaction(['sessions'], 'readwrite')
const store = transaction.objectStore('sessions')
store.put(session)
```

---

## 🎓 Recursos Relacionados

- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Online/Offline Events](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/Online_and_offline_events)
- [Service Worker Background Sync](https://web.dev/background-sync/)

---

**Fecha de implementación**: 5 de abril de 2026
**Versión**: 2.0.0 (con soporte offline)
**Estado**: ✅ Completado y compilado exitosamente
