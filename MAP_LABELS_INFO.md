# Capas de Etiquetas del Mapa Satelital

## 🏷️ Sistema de Etiquetas Implementado

El mapa satelital ahora incluye **3 capas de etiquetas superpuestas** para mostrar claramente todos los nombres de lugares y no perderse:

### Capa 1: Imagen Satelital (Base)
```
Proveedor: Esri World Imagery
Opacidad: 100%
Propósito: Imagen satelital de alta resolución
```

### Capa 2: Límites y Lugares (Labels)
```
Proveedor: Esri World Boundaries and Places
Opacidad: 80%
Propósito: Nombres de ciudades, pueblos, lugares
```

**Muestra:**
- Nombres de ciudades (Cusco, Pisac, Ollantaytambo)
- Pueblos y comunidades
- Lugares históricos (Sacsayhuamán, Q'enqo)
- Límites administrativos
- Parques y áreas protegidas

### Capa 3: Atribución Vial (Roads)
```
Proveedor: Esri World Road Attribution
Opacidad: 70%
Propósito: Nombres de calles y carreteras
```

**Muestra:**
- Nombres de calles en ciudad
- Carreteras principales
- Avenidas importantes
- Vías secundarias
- Caminos vecinales

## 🎯 Qué Verás en el Mapa

### Zonas Urbanas (Cusco Ciudad)
- ✅ Nombres de calles
- ✅ Avenidas principales
- ✅ Barrios y distritos
- ✅ Puntos de referencia
- ✅ Plazas y parques

### Zonas Rurales (Valle Sagrado)
- ✅ Nombres de pueblos
- ✅ Comunidades locales
- ✅ Carreteras principales
- ✅ Ríos y quebradas
- ✅ Sitios arqueológicos

### Zonas de Montaña
- ✅ Nombres de cerros y montañas
- ✅ Apus importantes
- ✅ Quebradas y valles
- ✅ Senderos principales
- ✅ Miradores

## 📊 Niveles de Zoom y Etiquetas

### Zoom 10-12 (Regional)
**Se muestra:**
- Nombres de ciudades principales
- Capitales de provincia
- Carreteras panamericanas
- Montañas principales (>5000m)

**Ejemplo:**
```
CUSCO
PISAC
OLLANTAYTAMBO
URUBAMBA
```

### Zoom 13-15 (Local)
**Se muestra:**
- Pueblos y comunidades
- Carreteras secundarias
- Calles principales
- Barrios
- Ríos

**Ejemplo:**
```
Sacsayhuamán
Q'enqo
Puca Pucara
Tambomachay
Av. de la Cultura
Calle Plateros
```

### Zoom 16-18 (Detalle)
**Se muestra:**
- Todas las calles
- Nombres de vías pequeñas
- Senderos
- Edificios públicos
- Parques pequeños

**Ejemplo:**
```
Calle Maruri
Calle Santa Clara
Sendero a Sacsayhuamán
Plaza de Armas
```

## 🗺️ Comparación: Antes vs Ahora

### Antes (Solo Stamen Labels)
```
- Opacidad: 40%
- Solo etiquetas básicas
- Pocos nombres de lugares
- Difícil de leer
- Sin nombres de calles
```

### Ahora (3 Capas Esri)
```
- Opacidad: 70-80%
- Etiquetas completas
- Todos los nombres de lugares
- Fácil de leer
- Nombres de calles incluidos
- Límites y referencias
```

## 🎨 Configuración de Opacidad

### Por qué diferentes opacidades?

| Capa | Opacidad | Razón |
|------|----------|-------|
| Satelital | 100% | Base del mapa |
| Lugares | 80% | Legible sin tapar imagen |
| Calles | 70% | Visible pero discreto |

### Beneficios
- **Legibilidad**: Texto claro y visible
- **Contexto**: No tapa la imagen satelital
- **Profundidad**: Jerarquía visual de información
- **Estética**: Balance entre imagen y texto

## 📍 Ejemplos de Lugares que Verás

### Cusco Centro
```
- Cusco (ciudad)
- San Blas (barrio)
- Santiago (distrito)
- Wanchaq (distrito)
- Magisterio (barrio)
- Plaza de Armas
- Aeropuerto Velasco Astete
```

### Alrededores de Cusco
```
- Sacsayhuamán
- Q'enqo
- Puca Pucara
- Tambomachay
- Pisac
- Calca
- Urubamba
- Ollantaytambo
- Chinchero
```

### Sitios Arqueológicos
```
- Sacsayhuamán
- Q'enqo
- Puca Pucara
- Tambomachay
- Pisac
- Ollantaytambo
- Moray
- Salineras de Maras
```

### Vías Principales
```
- Av. de la Cultura
- Av. El Sol
- Av. Pardo
- Calle Plateros
- Calle Maruri
- Carretera a Pisac
- Carretera a Ollantaytambo
```

## 🔧 Configuración Técnica

### URLs de las Capas

```typescript
// Capa 1: Imagen Satelital
url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

// Capa 2: Lugares y Límites
url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"

// Capa 3: Calles
url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Road_Attribution/MapServer/tile/{z}/{y}/{x}"
```

### Opacidades

```typescript
const OPACITIES = {
  satellite: 1.0,    // 100%
  places: 0.8,       // 80%
  roads: 0.7,        // 70%
}
```

### Orden de Capas

```
1. Satelital (abajo)
2. Lugares (medio)
3. Calles (arriba)
```

## 💡 Tips de Uso

### Para Ver Todos los Nombres
1. **Zoom 14-16**: Nivel óptimo para ver calles y lugares
2. **Zoom 17-18**: Máximo detalle de calles
3. **Día soleado**: Mejor contraste para leer etiquetas

### Para Ubicarte Rápido
1. Busca **nombres grandes** (ciudades principales)
2. Sigue las **carreteras principales**
3. Identifica **puntos de referencia** (plazas, ríos)

### Para Mapear Rutas
1. Usa **zoom 15-17** para ver senderos
2. Identifica **nombres de lugares cercanos**
3. Marca puntos de referencia visibles

## ✅ Beneficios para Downhill

### Navegación
- ✅ Fácil encontrar inicio de ruta
- ✅ Identificar puntos de referencia
- ✅ No perderse en zonas desconocidas

### Seguridad
- ✅ Ver nombres de comunidades
- ✅ Identificar vías de escape
- ✅ Ubicar zonas pobladas

### Planificación
- ✅ Calcular distancias reales
- ✅ Identificar accesos
- ✅ Planificar logística

## 🌐 Atribuciones

- **Esri World Imagery**: Tiles courtesy of Esri
- **Esri World Boundaries and Places**: Source: Esri
- **Esri World Road Attribution**: Source: Esri
- **OpenStreetMap**: © OpenStreetMap contributors

---

**Actualización completada** ✅
**Etiquetas completas visibles** ✅
**Build verificado** ✅
