import { inferTerrainCategoryFromOsmTags } from '@/lib/terrainFromOsmTags'

describe('terrainFromOsmTags', () => {
  it('clasifica asfalto en residential', () => {
    expect(inferTerrainCategoryFromOsmTags('residential', 'asphalt', undefined)).toBe('pavement')
  })

  it('clasifica steps', () => {
    expect(inferTerrainCategoryFromOsmTags('steps', undefined, undefined)).toBe('steps')
  })

  it('clasifica track con tierra', () => {
    expect(inferTerrainCategoryFromOsmTags('track', 'dirt', 'grade2')).toBe('dirt_path')
  })
})
