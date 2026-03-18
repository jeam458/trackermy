# Actualización: Mapa Satelital con Cusco como Referencia

## Cambios Realizados

### 🗺️ Ubicación de Referencia
Se cambió la ubicación por defecto del mapa de **Lima** a **Cusco**:

**Antes:**
```typescript
center = [-12.0464, -77.0428] // Lima, Peru
```

**Ahora:**
```typescript
center = [-13.5319, -71.9675] // Cusco, Peru
```

### 🛰️ Capas de Mapa

#### Vista Satelital (Por defecto)
- **Proveedor**: Esri World Imagery
- **URL**: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
- **Características**:
  - Imágenes satelitales de alta resolución
  - Ideal para identificar senderos y trails de downhill
  - Precisión en zonas montañosas de Cusco

#### Vista de Calles (Opcional)
- **Proveedor**: OpenStreetMap
- **URL**: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Características**:
  - Nombres de calles y referencias urbanas
  - Útil para ubicación en ciudad

#### Capa de Etiquetas (Superpuesta)
- **Proveedor**: Stamen Toner Labels
- **URL**: `https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png`
- **Opacidad**: 40%
- **Propósito**: Mostrar nombres de calles sin obstruir la vista satelital

### 🎛️ Control de Tipo de Mapa

Se agregó un botón para alternar entre vista satelital y de calles:

**Ubicación**: Esquina superior derecha del mapa
**Ícono**: Layers (⬜)
**Función**: Toggle entre 'satellite' y 'street'

```typescript
const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite')
```

### 📁 Archivos Modificados

1. **`src/components/routes/RouteMapEditor.tsx`**
   - Cambiado centro por defecto a Cusco
   - Agregado estado `mapType`
   - Agregadas capas condicionales de mapa
   - Agregado botón de toggle de capas
   - Importado ícono `Layers` de lucide-react

2. **`src/components/routes/RouteMapEditor.tsx` - RouteMapViewer**
   - Cambiado centro por defecto a Cusco
   - Actualizadas capas para usar vista satelital

3. **`src/app/dashboard/routes/create/page.tsx`**
   - Actualizado centro del mapa a Cusco: `[-13.5319, -71.9675]`

4. **`src/app/dashboard/routes/record/page.tsx`**
   - Actualizado centro del mapa a Cusco: `[-13.5319, -71.9675]`

### 📍 Lugares de Downhill en Cusco

El mapa ahora está centrado en Cusco, facilitando el mapeo de rutas en:

- **Sacsayhuamán**: Ruinas incas con caminos de tierra
- **Q'enqo**: Sitio arqueológico con senderos
- **Puca Pucara**: Fortaleza roja con trails
- **Tambomachay**: Baños incas, camino técnico
- **Valle Sagrado**: Terrazas y caminos andinos
- **Ollantaytambo**: Ciudad inca con rutas técnicas
- **Moray**: Andenes circulares
- **Salineras de Maras**: Minas de sal

### ✅ Build Status

```
✓ Compiled successfully
✓ Generating static pages
✓ Build completed successfully
```

### 🎯 Beneficios

1. **Mayor Precisión**: Vista satelital permite identificar senderos reales
2. **Referencia Local**: Cusco como centro facilita el mapeo de rutas locales
3. **Flexibilidad**: Toggle entre vista satelital y mapa estándar
4. **Mejor UX**: Usuarios de Cusco ven su ubicación inmediatamente

### 📖 Uso

#### Al Abrir el Mapa
- El mapa se centra automáticamente en Cusco
- Zoom inicial: 12 (vista regional)
- Vista satelital activada por defecto

#### Cambiar a Vista de Calles
1. Click en el ícono de capas (⬜) esquina superior derecha
2. El mapa cambia a OpenStreetMap
3. Click nuevamente para volver a satelital

#### Mapear Ruta
1. Usar zoom 15-17 para ver detalles del sendero
2. Los caminos de tierra se ven de color marrón
3. Los senderos peatonales son más angostos
4. Identificar puntos de referencia (ruinas, cerros)

### 🔧 Configuración Técnica

#### Coordenadas Cusco
```typescript
const CUSCO_CENTER: [number, number] = [-13.5319, -71.9675]
```

#### Zoom Recomendado
- **Regional**: 10-12
- **Local**: 13-15
- **Detalle**: 16-18

#### Capas Disponibles
```typescript
type MapType = 'satellite' | 'street'

// Satellite: Esri World Imagery + Stamen Labels
// Street: OpenStreetMap
```

### 📝 Notas

- La vista satelital requiere conexión a internet para cargar las imágenes
- El toggle de capas persiste mientras se está en la página
- Por defecto siempre inicia en vista satelital
- Las coordenadas de Cusco son aproximadas al centro de la ciudad

### 🌐 Atribuciones

- **Esri World Imagery**: Tiles courtesy of Esri
- **OpenStreetMap**: © OpenStreetMap contributors
- **Stamen Labels**: © Stamen Design

---

**Actualización completada exitosamente** ✅
**Build verificado** ✅
**Listo para producción** ✅
