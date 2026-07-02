import { describe, it, expect } from 'vitest'
import { GroundTiles, lngLatToTile, tileToLngLat } from '../GroundTiles'

describe('tile math', () => {
  it('lngLat 0,0 at z17 is tile 65536/65536', () => {
    expect(lngLatToTile(0, 0, 17)).toEqual([65536, 65536])
  })

  it('roundtrips: tile corner → lngLat → same tile', () => {
    const [lng, lat] = tileToLngLat(70000, 45000, 17)
    // corner is shared — nudge inside the tile
    expect(lngLatToTile(lng + 1e-6, lat - 1e-6, 17)).toEqual([70000, 45000])
  })

  it('y increases southward', () => {
    const [, yNorth] = lngLatToTile(13.4, 52.6, 17)
    const [, ySouth] = lngLatToTile(13.4, 52.4, 17)
    expect(ySouth).toBeGreaterThan(yNorth)
  })
})

describe('GroundTiles', () => {
  // identity-ish projection: 1° ≈ 111320 m relative to (13.4, 52.5)
  const proj = (lng: number, lat: number): [number, number] =>
    [(lng - 13.4) * 111320, (52.5 - lat) * 111320]

  it('builds a 7x7 grid around the player and evicts on move', () => {
    const gt = new GroundTiles(proj)
    gt.update(13.4, 52.5)
    expect(gt.group.children.length).toBe(49)

    // no-op while center tile unchanged
    gt.update(13.4, 52.5)
    expect(gt.group.children.length).toBe(49)

    // move far away — grid stays 49, old tiles evicted
    gt.update(13.6, 52.5)
    expect(gt.group.children.length).toBe(49)

    gt.dispose()
    expect(gt.group.children.length).toBe(0)
  })

  it('displaces grid vertices by the height sampler and rebuilds on refresh', () => {
    let h = 7
    const gt = new GroundTiles(proj, () => h)
    gt.update(13.4, 52.5)
    const mesh = gt.group.children[0] as import('three').Mesh
    const pos = mesh.geometry.getAttribute('position')
    expect(pos.count).toBe(81) // 9×9 grid per tile
    expect(pos.getY(0)).toBe(7)

    h = 3
    gt.refresh()
    expect(gt.group.children.length).toBe(0)
    gt.update(13.4, 52.5)
    const mesh2 = gt.group.children[0] as import('three').Mesh
    expect(mesh2.geometry.getAttribute('position').getY(0)).toBe(3)
    gt.dispose()
  })
})
