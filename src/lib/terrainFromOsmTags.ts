/**
 * Clasificación ligera de tipo de terreno a partir de tags OSM (sin modelo de visión).
 * Útil cuando hay `highway` / `surface` / `tracktype` en la vía cacheada.
 */

export type TerrainCategory =
  | 'pavement'
  | 'dirt_path'
  | 'rock_rough'
  | 'steps'
  | 'wood_bridge'
  | 'unknown'

const PAVEMENT_SURFACES =
  /^(asphalt|concrete|paving_stones|sett|cobblestone|paved|metal|tartan|rubber)$/i
const DIRT_SURFACES = /^(ground|dirt|earth|mud|sand|grass|unpaved|compacted|fine_gravel|gravel)$/i
const ROCK_SURFACES = /^(rock|stone|pebblestone|scree)$/i

/**
 * Inferencia heurística; no sustituye mapeo detallado en OSM.
 */
export function inferTerrainCategoryFromOsmTags(
  highway?: string,
  surface?: string,
  tracktype?: string
): TerrainCategory {
  const hw = (highway ?? '').toLowerCase()
  const sf = (surface ?? '').toLowerCase()
  const tt = (tracktype ?? '').toLowerCase()

  if (hw === 'steps' || hw === 'elevator') return 'steps'

  if (/motorway|trunk|primary|secondary|tertiary|living_street|residential|service|unclassified|road/i.test(hw)) {
    if (sf && DIRT_SURFACES.test(sf)) return 'dirt_path'
    if (sf && ROCK_SURFACES.test(sf)) return 'rock_rough'
    if (!sf || PAVEMENT_SURFACES.test(sf) || sf === '') return 'pavement'
  }

  if (hw === 'path' || hw === 'track' || hw === 'bridleway' || hw === 'footway' || hw === 'cycleway') {
    if (sf && PAVEMENT_SURFACES.test(sf)) return 'pavement'
    if (sf && ROCK_SURFACES.test(sf)) return 'rock_rough'
    if (tt === 'grade4' || tt === 'grade5') return 'rock_rough'
    if (sf && DIRT_SURFACES.test(sf)) return 'dirt_path'
    if (hw === 'track' && (tt === 'grade2' || tt === 'grade3')) return 'dirt_path'
    return 'dirt_path'
  }

  if (sf === 'wood' || /boardwalk/i.test(hw)) return 'wood_bridge'

  return 'unknown'
}
