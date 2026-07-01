import * as THREE from 'three'
import type maplibregl from 'maplibre-gl'
import { CollisionWorld } from '../engine/CollisionWorld'
import { lngLatDistance } from './geoUtils'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

const RESCAN_METERS = 50
// The map runs at zoom 17. In the OpenFreeMap "liberty" style the flat `building`
// layer is maxzoom 14, so it is NOT rendered at z17 and queryRenderedFeatures
// returns nothing for it. The 3D `building-3d` layer (minzoom 14) is what renders
// at play zoom; query it. `building` stays as a fallback for lower zooms.
const BUILDING_LAYERS = ['building-3d', 'building']

export class PlanetaryCollision {
  private world = new CollisionWorld()
  private lastLng = NaN
  private lastLat = NaN
  private _rebuildVersion = 0

  get rebuildVersion(): number { return this._rebuildVersion }

  constructor(
    private map: Pick<maplibregl.Map, 'queryRenderedFeatures'>,
    private toLocal?: (lng: number, lat: number) => [number, number],
  ) {}

  get collisionWorld(): CollisionWorld { return this.world }

  /**
   * Force the next {@link update} to re-scan even within {@link RESCAN_METERS}.
   * Used when the map fires 'idle' (tiles finished rendering) so buildings that
   * weren't yet rendered at the initial scan get picked up.
   */
  markStale(): void {
    this.lastLng = NaN
    this.lastLat = NaN
  }

  update(lng: number, lat: number): CollisionWorld {
    if (
      !isNaN(this.lastLng) &&
      lngLatDistance(lng, lat, this.lastLng, this.lastLat) < RESCAN_METERS
    ) return this.world

    this.lastLng = lng
    this.lastLat = lat
    this.rebuild(lng, lat)
    return this.world
  }

  private rebuild(refLng: number, refLat: number) {
    this._rebuildVersion += 1
    this.world.boxes.length = 0
    const metersPerDegLon = 111320 * Math.cos((refLat * Math.PI) / 180)
    const metersPerDegLat = 111320
    // Fixed origin frame when a converter is supplied; otherwise scan-center-relative.
    const toLocal =
      this.toLocal ??
      ((bLng: number, bLat: number): [number, number] => [
        (bLng - refLng) * metersPerDegLon,
        -(bLat - refLat) * metersPerDegLat,
      ])
    // toLocal may be a fixed-origin frame, not ref-relative — measure the
    // cull distance from the ref point explicitly rather than from (0,0).
    const [refX, refZ] = toLocal(refLng, refLat)

    const features = this.map.queryRenderedFeatures(undefined, { layers: BUILDING_LAYERS })
    for (const f of features) {
      const height = (f.properties?.height as number) ?? (f.properties?.render_height as number) ?? 10
      // BuildingGeometry.generate() throws (and is skipped, unmeshed) below this
      // height — mirror that here so short buildings don't get invisible collision.
      if (height < PLANETARY_CONFIG.building.minHeight) continue
      const rings: [number, number][][] =
        f.geometry.type === 'Polygon'
          ? [f.geometry.coordinates[0] as [number, number][]]
          : f.geometry.type === 'MultiPolygon'
          ? (f.geometry.coordinates as [number, number][][][]).map(p => p[0])
          : []

      for (const ring of rings) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
        let sumX = 0, sumZ = 0
        const pts: [number, number][] = []
        for (const [bLng, bLat] of ring) {
          const [x, z] = toLocal(bLng, bLat)
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (z < minZ) minZ = z
          if (z > maxZ) maxZ = z
          sumX += x
          sumZ += z
          pts.push([x, z])
        }
        // Drop the GeoJSON duplicate closing point so edge iteration can wrap cleanly.
        if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop()
        const sx = maxX - minX
        const sz = maxZ - minZ
        // Cull from the footprint centroid (mean of ring points), matching
        // PlanetaryEngine.footprintCentroid — using the AABB center instead
        // lets irregular/L-shaped buildings' collision outlive their render
        // cull, since the two points diverge for lopsided footprints.
        const dx = sumX / ring.length - refX
        const dz = sumZ / ring.length - refZ
        // Skip buildings beyond render distance — they're invisible, so
        // colliding with them reads as "stuck against nothing".
        if (dx * dx + dz * dz > PLANETARY_CONFIG.fogFar * PLANETARY_CONFIG.fogFar) continue
        if (!(sx > 0.5 && sz > 0.5) || pts.length < 3) continue

        // A single AABB is only valid when it hugs the footprint. Diagonal or
        // L/U-shaped buildings have AABBs far larger than the building itself,
        // and that phantom volume blocks the streets around them (the "stuck
        // in the middle of the road against nothing" bug).
        let area2 = 0
        for (let i = 0; i < pts.length; i++) {
          const [x1, z1] = pts[i]
          const [x2, z2] = pts[(i + 1) % pts.length]
          area2 += x1 * z2 - x2 * z1
        }
        const polyArea = Math.abs(area2) / 2
        if (polyArea >= 0.7 * sx * sz) {
          this.world.addBox(
            new THREE.Vector3((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2),
            new THREE.Vector3(sx, height, sz),
          )
        } else {
          // ponytail: staircase the walls — thin boxes along each edge segment.
          // Interior stays hollow, but the walls seal it, so entry is still blocked.
          const SEG = 6, THICK = 0.9
          for (let i = 0; i < pts.length; i++) {
            const [x1, z1] = pts[i]
            const [x2, z2] = pts[(i + 1) % pts.length]
            const len = Math.hypot(x2 - x1, z2 - z1)
            if (len < 0.1) continue
            const n = Math.min(Math.max(1, Math.ceil(len / SEG)), 64)
            for (let s = 0; s < n; s++) {
              const ax = x1 + ((x2 - x1) * s) / n
              const az = z1 + ((z2 - z1) * s) / n
              const bx = x1 + ((x2 - x1) * (s + 1)) / n
              const bz = z1 + ((z2 - z1) * (s + 1)) / n
              this.world.addBox(
                new THREE.Vector3((ax + bx) / 2, height / 2, (az + bz) / 2),
                new THREE.Vector3(Math.max(Math.abs(bx - ax), THICK), height, Math.max(Math.abs(bz - az), THICK)),
              )
            }
          }
        }
      }
    }
  }
}
