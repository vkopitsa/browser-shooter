import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { PlanetaryCollision } from '../PlanetaryCollision'
import { PLANETARY_CONFIG } from '../PlanetaryConfig'

function makeMap(features: object[]) {
  return { queryRenderedFeatures: vi.fn(() => features) }
}

const squareBuilding = {
  geometry: {
    type: 'Polygon',
    coordinates: [[[0, 0], [0.0001, 0], [0.0001, 0.0001], [0, 0.0001], [0, 0]]],
  },
  properties: { height: 20 },
}

describe('PlanetaryCollision', () => {
  it('builds boxes from polygon buildings', () => {
    const map = makeMap([squareBuilding])
    const pc = new PlanetaryCollision(map as any)
    const world = pc.update(0, 0)
    expect(world.boxes.length).toBeGreaterThan(0)
  })

  it('skips re-scan if moved < 50m', () => {
    const map = makeMap([squareBuilding])
    const pc = new PlanetaryCollision(map as any)
    pc.update(0, 0)
    pc.update(0.0001, 0.0001)  // ~15m
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(1)
  })

  it('re-scans after moving > 50m', () => {
    const map = makeMap([squareBuilding])
    const pc = new PlanetaryCollision(map as any)
    pc.update(0, 0)
    pc.update(0, 0.001)  // ~111m
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(2)
  })

  it('ignores features with no polygon geometry', () => {
    const map = makeMap([{ geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }])
    const pc = new PlanetaryCollision(map as any)
    const world = pc.update(0, 0)
    expect(world.boxes.length).toBe(0)
  })

  it('bumps rebuildVersion only when it actually re-scans', () => {
    const map = makeMap([squareBuilding])
    const pc = new PlanetaryCollision(map as any)
    pc.update(0, 0)
    const v1 = pc.rebuildVersion
    pc.update(0.0001, 0.0001) // ~15m, no re-scan
    expect(pc.rebuildVersion).toBe(v1)
    pc.update(0, 0.001) // ~111m, re-scan
    expect(pc.rebuildVersion).toBe(v1 + 1)
  })

  it('queries the building-3d layer (the one rendered at play zoom 17)', () => {
    const map = makeMap([squareBuilding])
    const pc = new PlanetaryCollision(map as any)
    pc.update(0, 0)
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ layers: expect.arrayContaining(['building-3d']) }),
    )
  })

  it('markStale forces a re-scan even within 50m', () => {
    const map = makeMap([squareBuilding])
    const pc = new PlanetaryCollision(map as any)
    pc.update(0, 0)
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(1)
    pc.update(0.0001, 0.0001) // ~15m, normally skipped
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(1)
    pc.markStale()
    pc.update(0.0001, 0.0001) // same spot, but stale → re-scans
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(2)
  })

  it('skips buildings shorter than the render-side minimum height (BuildingGeometry rejects and never meshes them)', () => {
    const shortBuilding = {
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [0.0001, 0], [0.0001, 0.0001], [0, 0.0001], [0, 0]]],
      },
      properties: { height: PLANETARY_CONFIG.building.minHeight - 1 },
    }
    const map = makeMap([shortBuilding])
    const pc = new PlanetaryCollision(map as any)
    const world = pc.update(0, 0)
    expect(world.boxes.length).toBe(0)
  })

  it('culls by the same point (footprint centroid) as render culling, not the AABB center', () => {
    // Lopsided ring: one far corner at x=-1200 balances a cluster of points
    // near x=1180-1200, so the AABB center sits near x=0 (well within the
    // 600m fog-far cull radius) while the arithmetic-mean centroid — what
    // PlanetaryEngine.footprintCentroid uses for render culling — sits at
    // x~792 (beyond it). Render would cull this building; collision must too.
    const lopsided = {
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-1200 / 111320, 0],
          [1200 / 111320, 0],
          [1195 / 111320, -10 / 111320],
          [1190 / 111320, 0],
          [1185 / 111320, -10 / 111320],
          [1180 / 111320, 0],
        ]],
      },
      properties: { height: 20 },
    }
    const map = makeMap([lopsided])
    const pc = new PlanetaryCollision(map as any)
    const world = pc.update(0, 0)
    expect(world.boxes.length).toBe(0)
  })

  it('a diagonal building does not block the street beside it (AABB overcover bug)', () => {
    // Thin building running 45° from (0,0) to (100,100) local meters, ~8m wide.
    // Its axis-aligned bounding box covers the whole 100×100 square — with
    // one-AABB-per-ring collision, the street at (75,25) is inside an invisible
    // wall and the player gets stuck "against nothing" mid-road.
    const diagonal = {
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-2.83, 2.83], [2.83, -2.83], [102.83, 97.17], [97.17, 102.83], [-2.83, 2.83],
        ]],
      },
      properties: { height: 20 },
    }
    const map = makeMap([diagonal])
    // Identity converter: treat feature coords as local meters directly.
    const pc = new PlanetaryCollision(map as any, (x, y) => [x, y])
    const world = pc.update(0, 0)

    const onStreet = new THREE.Vector3(75, 0, 25) // 35m off the building wall
    const before = onStreet.clone()
    world.resolve(onStreet, 0.5)
    expect(onStreet.x).toBeCloseTo(before.x, 3)
    expect(onStreet.z).toBeCloseTo(before.z, 3)

    // On the wall line itself (edge (-2.83,2.83)→(97.17,102.83), i.e. z = x + 5.66)
    // — the building must still block there.
    const atWall = new THREE.Vector3(50, 0, 55.66)
    const beforeWall = atWall.clone()
    world.resolve(atWall, 0.5)
    expect(atWall.distanceTo(beforeWall)).toBeGreaterThan(0.01)
  })

  it('keeps a single box for a well-fitting rectangular footprint', () => {
    const rect = {
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [20, 0], [20, 10], [0, 10], [0, 0]]],
      },
      properties: { height: 20 },
    }
    const map = makeMap([rect])
    const pc = new PlanetaryCollision(map as any, (x, y) => [x, y])
    expect(pc.update(0, 0).boxes.length).toBe(1)
  })

  it('places boxes in the injected origin frame regardless of scan center', () => {
    const map = makeMap([squareBuilding])
    // Origin-relative converter: meters east/south of lng/lat (0,0).
    const MPD = 111320
    const toLocal = (lng: number, lat: number): [number, number] => [
      lng * MPD * Math.cos(0),
      -lat * MPD,
    ]
    const pc = new PlanetaryCollision(map as any, toLocal)

    pc.update(0, 0)
    const first = pc.collisionWorld.boxes[0]

    // Force a re-scan from a far-away center (> 50 m): same building, same world coords.
    pc.update(0, 0.001)
    const second = pc.collisionWorld.boxes[0]

    expect(second.min.x).toBeCloseTo(first.min.x, 5)
    expect(second.min.z).toBeCloseTo(first.min.z, 5)
    expect(second.max.x).toBeCloseTo(first.max.x, 5)
  })
})
