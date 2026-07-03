import { describe, it, expect } from 'vitest'
import { findClearSpot, findSpawnPoints } from '../PlanetarySpawns'
import { lngLatDistance } from '../geoUtils'

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

describe('findClearSpot', () => {
  // A tall building covering lng 0..0.001, lat 0..0.001. project() maps
  // degrees to fake screen px at ~1.1 m/px so the real query-box margin
  // (CLEAR_MARGIN_PX) stays proportionate.
  const SCALE = 100000
  const makeMap = (blocks: { minLng: number; maxLng: number; minLat: number; maxLat: number; height?: number }[]) => ({
    project: ([lng, lat]: [number, number]) => ({ x: lng * SCALE, y: lat * SCALE }),
    queryRenderedFeatures: (box: [[number, number], [number, number]], options?: { layers?: string[] }) => {
      if (options?.layers) throw new Error(`style has no layer(s): ${options.layers.join(', ')}`)
      const [[x1, y1], [x2, y2]] = box
      return blocks
        .filter(b => x2 >= b.minLng * SCALE && x1 <= b.maxLng * SCALE && y2 >= b.minLat * SCALE && y1 <= b.maxLat * SCALE)
        .map(b => ({ sourceLayer: 'building', properties: { render_height: b.height ?? 20 } }))
    },
  })

  it('returns the point unchanged when nothing covers it', () => {
    const map = makeMap([])
    expect(findClearSpot(map as any, 0.5, 0.5)).toEqual([0.5, 0.5])
  })

  it('steps out of a building to a nearby clear spot', () => {
    const map = makeMap([{ minLng: 0, maxLng: 0.001, minLat: 0, maxLat: 0.001 }])
    const [lng, lat] = findClearSpot(map as any, 0.0005, 0.0005)
    const inside = lng >= 0 && lng <= 0.001 && lat >= 0 && lat <= 0.001
    expect(inside).toBe(false)
    expect(lngLatDistance(0.0005, 0.0005, lng, lat)).toBeLessThan(150)
  })

  it('ignores buildings below the meshed min height (they are invisible)', () => {
    const map = makeMap([{ minLng: 0, maxLng: 0.001, minLat: 0, maxLat: 0.001, height: 1 }])
    expect(findClearSpot(map as any, 0.0005, 0.0005)).toEqual([0.0005, 0.0005])
  })
})
