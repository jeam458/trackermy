/**
 * Estilo de mapa híbrido para Leaflet
 * Combina vista satelital con etiquetas completas y características de mapa normal
 */

// Capas de Esri para mapa híbrido completo
export const HYBRID_MAP_LAYERS = {
  // Capa base satelital
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    opacity: 1,
  },

  // Capa de etiquetas de lugares (ciudades, pueblos, sitios)
  labelsPlaces: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri - Lugares',
    opacity: 0.9,
  },

  // Capa de etiquetas de calles
  labelsRoads: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Road_Attribution/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri - Calles',
    opacity: 0.8,
  },

  // Capa de transporte (carreteras, vías)
  transport: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri - Transporte',
    opacity: 0.7,
  },

  // Capa de parques y áreas verdes
  parks: {
    url: 'https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Parks_and_Reserves/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri - Parques',
    opacity: 0.6,
  },

  // Capa de hidrografía (ríos, lagos, océanos)
  hydrography: {
    url: 'https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Hydrography/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri - Hidrografía',
    opacity: 0.7,
  },

  // Capa de edificios y estructuras
  buildings: {
    url: 'https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Buildings/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri - Edificios',
    opacity: 0.5,
  },

  // Capa de límites administrativos
  boundaries: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Administrative_Boundaries/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri - Límites',
    opacity: 0.6,
  },

  // Capa de relieve sombreado (terrain)
  terrain: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri - Relieve',
    opacity: 0.4,
  },
}

/**
 * Configuración recomendada para mapa híbrido completo
 * Orden de capas (de abajo hacia arriba):
 * 1. Satelital (base)
 * 2. Relieve (terrain)
 * 3. Hidrografía (ríos, lagos)
 * 4. Parques (áreas verdes)
 * 5. Edificios
 * 6. Transporte (carreteras)
 * 7. Límites
 * 8. Etiquetas de calles
 * 9. Etiquetas de lugares
 */
export const RECOMMENDED_HYBRID_CONFIG = [
  'satellite',    // Base
  'terrain',      // Relieve de montañas
  'hydrography',  // Ríos y lagos
  'parks',        // Áreas verdes
  'buildings',    // Edificios
  'transport',    // Carreteras
  'boundaries',   // Límites administrativos
  'labelsRoads',  // Nombres de calles
  'labelsPlaces', // Nombres de lugares
]

/**
 * Configuración mínima (solo esencial)
 * Para mejor rendimiento
 */
export const MINIMAL_HYBRID_CONFIG = [
  'satellite',
  'labelsRoads',
  'labelsPlaces',
]

/**
 * Configuración completa (todos los detalles)
 * Máxima información pero más pesado
 */
export const FULL_HYBRID_CONFIG = [
  'satellite',
  'terrain',
  'hydrography',
  'parks',
  'buildings',
  'transport',
  'boundaries',
  'labelsRoads',
  'labelsPlaces',
]

/**
 * Configuración para downhill (énfasis en terreno y trails)
 */
export const DOWNHILL_HYBRID_CONFIG = [
  'satellite',
  'terrain',      // Importante para ver relieve
  'hydrography',  // Ríos como referencia
  'parks',        // Áreas naturales
  'labelsPlaces', // Nombres de lugares
]
