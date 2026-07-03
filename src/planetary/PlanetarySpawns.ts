/// <reference types="geojson" />
import type maplibregl from 'maplibre-gl'
import type { Team } from '../types'
import { offsetLngLat } from './geoUtils'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

const OPEN_TAGS = ['park', 'playground', 'pitch', 'plaza', 'square', 'garden']
// OMT vector-tile *source* layer names — style *render* layer ids (e.g. in the
// "liberty" style) don't match these, and queryRenderedFeatures throws if
// asked to filter by a layer id that doesn't exist in the current style. Query
// everything and filter by the feature's underlying source layer instead
// (same approach as PlanetaryScenery.queryBySourceLayer).
const OPEN_SOURCE_LAYERS = new Set(['landuse', 'landcover', 'park'])
const ROAD_SOURCE_LAYER = 'transportation'
const SPAWN_SPREAD = 30  // meters between spawn points around centroid

export function findSpawnPoints(
  map: Pick<maplibregl.Map, 'queryRenderedFeatures'>,
  centerLng: number,
  centerLat: number,
  team: Team,
): [number, number][] {
  const features = map.queryRenderedFeatures(undefined)
  const open = features.filter(
    f =>
      OPEN_SOURCE_LAYERS.has(f.sourceLayer as string) &&
      f.geometry.type === 'Polygon' &&
      OPEN_TAGS.some(
        t =>
          f.properties?.landuse === t ||
          f.properties?.leisure === t ||
          f.properties?.amenity === t,
      ),
  )

  if (open.length > 0) {
    const idx = team === 'ct' ? 0 : Math.min(1, open.length - 1)
    const ring = (open[idx].geometry as GeoJSON.Polygon).coordinates[0] as [number, number][]
    const [cLng, cLat] = centroid(ring)
    return Array.from({ length: 4 }, (_, i) => {
      const angle = (i / 4) * Math.PI * 2
      return offsetLngLat(cLng, cLat, Math.cos(angle) * SPAWN_SPREAD, Math.sin(angle) * SPAWN_SPREAD)
    })
  }

  // Fallback: road midpoints
  const points: [number, number][] = features
    .filter(r => r.sourceLayer === ROAD_SOURCE_LAYER && r.geometry.type === 'LineString')
    .slice(0, 10)
    .map(r => {
      const coords = (r.geometry as GeoJSON.LineString).coordinates as [number, number][]
      return coords[Math.floor(coords.length / 2)]
    })

  if (points.length > 0) {
    const offset = team === 'ct' ? 0 : Math.min(Math.ceil(points.length / 2), points.length - 1)
    return points.slice(offset, offset + 4)
  }

  return [[centerLng, centerLat]]
}

type ClearSpotMap = Pick<maplibregl.Map, 'queryRenderedFeatures' | 'project'>

/** True when a meshed (tall-enough) building's footprint covers or comes
 * within {@link CLEAR_METERS} of this lng/lat. Queried as a screen-space box,
 * not a single pixel: a point right at a footprint edge still puts the camera
 * inside the extruded wall mesh, and a spot with less than a few metres of
 * clearance (a back-alley slot between tall walls) reads as "nothing visible".
 * Queries unfiltered and matches by source layer — same missing-style-layer
 * caveat as findSpawnPoints above. */
const CLEAR_METERS = 6
function onBuilding(map: ClearSpotMap, lng: number, lat: number): boolean {
  const a = map.project(offsetLngLat(lng, lat, -CLEAR_METERS, -CLEAR_METERS))
  const b = map.project(offsetLngLat(lng, lat, CLEAR_METERS, CLEAR_METERS))
  const box: [maplibregl.PointLike, maplibregl.PointLike] = [
    [Math.min(a.x, b.x), Math.min(a.y, b.y)],
    [Math.max(a.x, b.x), Math.max(a.y, b.y)],
  ]
  return map
    .queryRenderedFeatures(box)
    .some(
      f =>
        f.sourceLayer === 'building' &&
        ((f.properties?.height as number) ?? (f.properties?.render_height as number) ?? 10) >=
          PLANETARY_CONFIG.building.minHeight,
    )
}

/**
 * The nearest spot to (lng, lat) not covered by a rendered building, searched
 * in expanding rings. Tiles must be rendered (map 'idle') for this to see
 * anything — before that it just returns the input.
 */
export function findClearSpot(map: ClearSpotMap, lng: number, lat: number): [number, number] {
  if (!onBuilding(map, lng, lat)) return [lng, lat]
  for (let r = 6; r <= 120; r += 6) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const [cLng, cLat] = offsetLngLat(lng, lat, Math.cos(a) * r, Math.sin(a) * r)
      if (!onBuilding(map, cLng, cLat)) return [cLng, cLat]
    }
  }
  // ponytail: >120 m of solid building in every direction — give up, the
  // collision resolver's inside-a-box eject is the remaining safety net.
  return [lng, lat]
}

function centroid(ring: [number, number][]): [number, number] {
  return [
    ring.reduce((s, p) => s + p[0], 0) / ring.length,
    ring.reduce((s, p) => s + p[1], 0) / ring.length,
  ]
}
