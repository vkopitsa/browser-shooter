import { describe, it, expect } from 'vitest'
import { findSpawnPoints } from '../PlanetarySpawns'

function makeMap(features: object[]) {
  return { queryRenderedFeatures: () => features }
}

const park = {
  sourceLayer: 'landuse',
  geometry: {
    type: 'Polygon',
    coordinates: [[[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]]],
  },
  properties: { leisure: 'park' },
}

const road = {
  sourceLayer: 'transportation',
  geometry: { type: 'LineString', coordinates: [[0.1, 0.1], [0.2, 0.1]] },
  properties: {},
}

describe('findSpawnPoints', () => {
  it('returns spawn points from open area (park)', () => {
    const map = makeMap([park])
    const points = findSpawnPoints(map as any, 0.005, 0.005, 'ct')
    expect(points.length).toBeGreaterThan(0)
    expect(points[0]).toHaveLength(2)
  })

  it('falls back to road when no open area', () => {
    const map = makeMap([road])
    const points = findSpawnPoints(map as any, 0.15, 0.1, 'ct')
    expect(points.length).toBeGreaterThan(0)
  })

  it('returns center as last resort', () => {
    const map = makeMap([])
    const points = findSpawnPoints(map as any, 5, 10, 't')
    expect(points).toEqual([[5, 10]])
  })

  // Regression: queryRenderedFeatures throws if asked to filter by a style
  // render-layer id that doesn't exist in the current style (e.g. 'landuse',
  // 'road' are OMT *source* layer names, not style layer ids). Must query
  // unfiltered and filter by sourceLayer instead.
  it('never passes a layers filter to queryRenderedFeatures', () => {
    const queryRenderedFeatures = (_filter: unknown, options?: { layers?: string[] }) => {
      if (options?.layers) throw new Error(`style has no layer(s): ${options.layers.join(', ')}`)
      return [park]
    }
    const points = findSpawnPoints({ queryRenderedFeatures } as any, 0.005, 0.005, 'ct')
    expect(points.length).toBeGreaterThan(0)
  })
})
