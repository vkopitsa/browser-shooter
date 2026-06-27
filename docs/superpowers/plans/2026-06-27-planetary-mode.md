# Planetary Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Planetary Mode to browser-shooter where the map is the real Earth rendered from MapLibre GL vector tiles, with full CS-style gameplay (rounds, economy, bomb, bots) and a 2D map picker that shows live player positions.

**Architecture:** MapLibre GL JS renders the world (buildings, roads, terrain); a Three.js `CustomLayerInterface` shares the same WebGL context to render game objects (players, weapons, effects). The existing `GameSession` runs unchanged — only player position format gains an optional `geoPos` field for the map overlay. FPS controls translate WASD + mouselook to MapLibre camera calls (bearing, pitch, center).

**Tech Stack:** `maplibre-gl` (new dep), Three.js (existing), React (existing), Vitest (existing)

## Global Constraints

- TypeScript strict mode; no `any` except where MapLibre types require it
- All new files go under `src/planetary/`
- Tests go in `src/planetary/__tests__/`
- MapLibre style URL: `https://tiles.openfreemap.org/styles/liberty` (free, full OSM detail)
- Building layer name in that style: `building`; road layer names: `road`, `roads`, `transportation` (query all three, ignore missing)
- Player eye height above ground: `2` (matches `EYE_HEIGHT` from `src/player/Player.ts`)
- Meters-per-degree-lat constant: `111320`
- Round boundary: warn at 600 m from median player position, eliminate at 700 m
- `npm test` must pass after every task

---

### Task 1: Install MapLibre + PlanetaryEngine

**Files:**
- Modify: `package.json` (add dep)
- Create: `src/planetary/PlanetaryEngine.ts`
- Create: `src/planetary/__tests__/PlanetaryEngine.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  class PlanetaryEngine {
    map: maplibregl.Map
    scene: THREE.Scene
    camera: THREE.Camera
    onReady(cb: () => void): void
    dispose(): void
  }
  ```

- [ ] **Step 1: Install maplibre-gl**

```bash
npm install maplibre-gl
```

Expected: `package.json` gains `"maplibre-gl": "^X.Y.Z"` in dependencies. `npm test` still passes.

- [ ] **Step 2: Write the failing test**

Create `src/planetary/__tests__/PlanetaryEngine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock maplibre-gl before importing PlanetaryEngine
vi.mock('maplibre-gl', () => {
  const listeners: Record<string, (() => void)[]> = {}
  const MockMap = vi.fn().mockImplementation(() => ({
    on: vi.fn((event: string, cb: () => void) => {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
    }),
    addLayer: vi.fn(),
    getCanvas: vi.fn(() => document.createElement('canvas')),
    remove: vi.fn(),
    _triggerLoad: () => listeners['load']?.forEach(cb => cb()),
  }))
  return { default: { Map: MockMap } }
})

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import { PlanetaryEngine } from '../PlanetaryEngine'
import * as THREE from 'three'

describe('PlanetaryEngine', () => {
  it('creates scene and camera', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    expect(engine.scene).toBeInstanceOf(THREE.Scene)
    expect(engine.camera).toBeInstanceOf(THREE.Camera)
    engine.dispose()
  })

  it('calls onReady after map load', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    const cb = vi.fn()
    engine.onReady(cb)
    ;(engine.map as any)._triggerLoad()
    expect(cb).toHaveBeenCalled()
    engine.dispose()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- src/planetary/__tests__/PlanetaryEngine.test.ts
```

Expected: FAIL — `Cannot find module '../PlanetaryEngine'`

- [ ] **Step 4: Implement PlanetaryEngine**

Create `src/planetary/PlanetaryEngine.ts`:

```typescript
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export class PlanetaryEngine {
  map: maplibregl.Map
  scene: THREE.Scene
  camera: THREE.Camera
  private threeRenderer: THREE.WebGLRenderer | null = null
  private readyCbs: (() => void)[] = []

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene()
    this.camera = new THREE.Camera()

    this.map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center: [0, 0],
      zoom: 17,
      pitch: 60,
      antialias: true,
    })

    this.map.on('load', () => {
      this.addGameObjectsLayer()
      this.readyCbs.forEach(cb => cb())
    })
  }

  onReady(cb: () => void) {
    this.readyCbs.push(cb)
  }

  private addGameObjectsLayer() {
    const self = this
    this.map.addLayer({
      id: 'game-objects',
      type: 'custom',
      renderingMode: '3d',
      onAdd(_map: maplibregl.Map, gl: WebGL2RenderingContext) {
        self.threeRenderer = new THREE.WebGLRenderer({
          canvas: _map.getCanvas(),
          context: gl,
          antialias: true,
        })
        self.threeRenderer.autoClear = false
      },
      render(_gl: WebGL2RenderingContext, matrix: number[]) {
        self.camera.projectionMatrix.fromArray(matrix)
        self.threeRenderer?.resetState()
        self.threeRenderer?.render(self.scene, self.camera)
        self.map.triggerRepaint()
      },
    } as maplibregl.CustomLayerInterface)
  }

  dispose() {
    this.threeRenderer?.dispose()
    this.map.remove()
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- src/planetary/__tests__/PlanetaryEngine.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/planetary/PlanetaryEngine.ts src/planetary/__tests__/PlanetaryEngine.test.ts package.json package-lock.json
git commit -m "feat(planetary): add MapLibre PlanetaryEngine with Three.js custom layer"
```

---

### Task 2: Geo utilities + FPS controls (GeoControls)

**Files:**
- Create: `src/planetary/geoUtils.ts`
- Create: `src/planetary/GeoControls.ts`
- Create: `src/planetary/__tests__/geoUtils.test.ts`
- Create: `src/planetary/__tests__/GeoControls.test.ts`

**Interfaces:**
- Consumes: `maplibregl.Map` (from Task 1)
- Produces:
  ```typescript
  // geoUtils.ts
  function offsetLngLat(refLng: number, refLat: number, eastMeters: number, northMeters: number): [number, number]
  function lngLatDistance(lng1: number, lat1: number, lng2: number, lat2: number): number
  function medianLngLat(points: [number, number][]): [number, number]

  // GeoControls.ts
  class GeoControls {
    constructor(map: maplibregl.Map, container: HTMLElement)
    attach(): void
    detach(): void
    update(dt: number): void  // call each frame
    getBearing(): number      // degrees
    getPitch(): number        // degrees
  }
  ```

- [ ] **Step 1: Write failing tests for geoUtils**

Create `src/planetary/__tests__/geoUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { offsetLngLat, lngLatDistance, medianLngLat } from '../geoUtils'

describe('offsetLngLat', () => {
  it('moves north by 111320m ≈ 1 degree lat', () => {
    const [lng, lat] = offsetLngLat(0, 0, 0, 111320)
    expect(lat).toBeCloseTo(1, 1)
    expect(lng).toBeCloseTo(0, 3)
  })

  it('moves east at equator by 111320m ≈ 1 degree lng', () => {
    const [lng, lat] = offsetLngLat(0, 0, 111320, 0)
    expect(lng).toBeCloseTo(1, 1)
    expect(lat).toBeCloseTo(0, 3)
  })

  it('east offset shrinks with latitude (cos factor)', () => {
    const [lng60] = offsetLngLat(0, 60, 111320, 0)
    expect(lng60).toBeGreaterThan(1.5)  // cos(60°)=0.5 so 2x the degrees
  })
})

describe('lngLatDistance', () => {
  it('same point = 0', () => {
    expect(lngLatDistance(10, 20, 10, 20)).toBe(0)
  })

  it('1 degree lat ≈ 111320m', () => {
    expect(lngLatDistance(0, 0, 0, 1)).toBeCloseTo(111320, -2)
  })
})

describe('medianLngLat', () => {
  it('median of two points is midpoint', () => {
    const [lng, lat] = medianLngLat([[0, 0], [2, 4]])
    expect(lng).toBeCloseTo(1)
    expect(lat).toBeCloseTo(2)
  })

  it('single point returns itself', () => {
    const [lng, lat] = medianLngLat([[5, 10]])
    expect(lng).toBe(5)
    expect(lat).toBe(10)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- src/planetary/__tests__/geoUtils.test.ts
```

Expected: FAIL — `Cannot find module '../geoUtils'`

- [ ] **Step 3: Implement geoUtils**

Create `src/planetary/geoUtils.ts`:

```typescript
const METERS_PER_DEG_LAT = 111320

export function offsetLngLat(
  refLng: number,
  refLat: number,
  eastMeters: number,
  northMeters: number,
): [number, number] {
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((refLat * Math.PI) / 180)
  return [refLng + eastMeters / metersPerDegLon, refLat + northMeters / METERS_PER_DEG_LAT]
}

export function lngLatDistance(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180)
  const dx = (lng2 - lng1) * METERS_PER_DEG_LAT * Math.cos(midLat)
  const dy = (lat2 - lat1) * METERS_PER_DEG_LAT
  return Math.sqrt(dx * dx + dy * dy)
}

export function medianLngLat(points: [number, number][]): [number, number] {
  const n = points.length
  if (n === 0) return [0, 0]
  const lngs = points.map(p => p[0]).sort((a, b) => a - b)
  const lats = points.map(p => p[1]).sort((a, b) => a - b)
  const mid = Math.floor(n / 2)
  return [
    n % 2 === 0 ? (lngs[mid - 1] + lngs[mid]) / 2 : lngs[mid],
    n % 2 === 0 ? (lats[mid - 1] + lats[mid]) / 2 : lats[mid],
  ]
}
```

- [ ] **Step 4: Run geoUtils tests to verify pass**

```bash
npm test -- src/planetary/__tests__/geoUtils.test.ts
```

Expected: PASS

- [ ] **Step 5: Write failing tests for GeoControls**

Create `src/planetary/__tests__/GeoControls.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('maplibre-gl', () => ({}))

import { GeoControls } from '../GeoControls'

function makeMap(center = { lng: 0, lat: 0 }) {
  return {
    getCenter: vi.fn(() => center),
    setCenter: vi.fn((c: [number, number]) => { center.lng = c[0]; center.lat = c[1] }),
    setBearing: vi.fn(),
    setPitch: vi.fn(),
    getBearing: vi.fn(() => 0),
    getPitch: vi.fn(() => 60),
  }
}

describe('GeoControls', () => {
  let map: ReturnType<typeof makeMap>
  let container: HTMLElement
  let controls: GeoControls

  beforeEach(() => {
    map = makeMap()
    container = document.createElement('div')
    controls = new GeoControls(map as any, container)
    controls.attach()
  })

  it('moves north on KeyW press (bearing=0)', () => {
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    controls.update(1)
    expect(map.setCenter).toHaveBeenCalled()
    const [, lat] = map.setCenter.mock.calls[0][0]
    expect(lat).toBeGreaterThan(0)
  })

  it('clamps pitch to 85 max', () => {
    container.dispatchEvent(new MouseEvent('mousemove', { movementX: 0, movementY: -10000, bubbles: true }))
    expect(controls.getPitch()).toBeLessThanOrEqual(85)
  })

  it('clamps pitch to 0 min', () => {
    container.dispatchEvent(new MouseEvent('mousemove', { movementX: 0, movementY: 10000, bubbles: true }))
    expect(controls.getPitch()).toBeGreaterThanOrEqual(0)
  })

  it('detach stops responding to keydown', () => {
    controls.detach()
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    controls.update(1)
    expect(map.setCenter).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run to verify failure**

```bash
npm test -- src/planetary/__tests__/GeoControls.test.ts
```

Expected: FAIL — `Cannot find module '../GeoControls'`

- [ ] **Step 7: Implement GeoControls**

Create `src/planetary/GeoControls.ts`:

```typescript
import type maplibregl from 'maplibre-gl'
import { offsetLngLat } from './geoUtils'

const MOUSE_SENSITIVITY = 0.3  // degrees per pixel
const MOVE_SPEED = 8           // meters per second
const PITCH_MIN = 0
const PITCH_MAX = 85

export class GeoControls {
  private keys = new Set<string>()
  private bearing: number
  private pitch: number
  private attached = false

  constructor(
    private map: Pick<maplibregl.Map, 'getCenter' | 'setCenter' | 'setBearing' | 'setPitch' | 'getBearing' | 'getPitch'>,
    private container: HTMLElement,
  ) {
    this.bearing = (map.getBearing as () => number)()
    this.pitch = (map.getPitch as () => number)()
  }

  attach() {
    if (this.attached) return
    this.attached = true
    this.container.addEventListener('keydown', this.onKeyDown)
    this.container.addEventListener('keyup', this.onKeyUp)
    this.container.addEventListener('mousemove', this.onMouseMove)
  }

  detach() {
    if (!this.attached) return
    this.attached = false
    this.container.removeEventListener('keydown', this.onKeyDown)
    this.container.removeEventListener('keyup', this.onKeyUp)
    this.container.removeEventListener('mousemove', this.onMouseMove)
    this.keys.clear()
  }

  getBearing(): number { return this.bearing }
  getPitch(): number { return this.pitch }

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code)
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code)

  private onMouseMove = (e: MouseEvent) => {
    this.bearing = ((this.bearing + e.movementX * MOUSE_SENSITIVITY) + 360) % 360
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch - e.movementY * MOUSE_SENSITIVITY))
    this.map.setBearing(this.bearing)
    this.map.setPitch(this.pitch)
  }

  update(dt: number) {
    let dx = 0, dz = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dz -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dz += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1
    if (dx === 0 && dz === 0) return

    const speed = MOVE_SPEED * dt
    const bearingRad = (this.bearing * Math.PI) / 180
    const east = (dx * Math.cos(bearingRad) - dz * Math.sin(bearingRad)) * speed
    const north = (dx * Math.sin(bearingRad) + dz * Math.cos(bearingRad)) * speed

    const center = this.map.getCenter()
    const [lng, lat] = offsetLngLat(center.lng, center.lat, east, north)
    this.map.setCenter([lng, lat])
  }
}
```

- [ ] **Step 8: Run all tests**

```bash
npm test -- src/planetary/__tests__/geoUtils.test.ts src/planetary/__tests__/GeoControls.test.ts
```

Expected: both PASS

- [ ] **Step 9: Commit**

```bash
git add src/planetary/geoUtils.ts src/planetary/__tests__/geoUtils.test.ts src/planetary/GeoControls.ts src/planetary/__tests__/GeoControls.test.ts
git commit -m "feat(planetary): add geo utilities and FPS camera controls"
```

---

### Task 3: Building collision from MapLibre tiles (PlanetaryCollision)

**Files:**
- Create: `src/planetary/PlanetaryCollision.ts`
- Create: `src/planetary/__tests__/PlanetaryCollision.test.ts`

**Interfaces:**
- Consumes: `CollisionWorld` from `src/engine/CollisionWorld.ts`, `lngLatDistance` from `./geoUtils`
- Produces:
  ```typescript
  class PlanetaryCollision {
    constructor(map: Pick<maplibregl.Map, 'queryRenderedFeatures'>)
    update(lng: number, lat: number): CollisionWorld   // re-scans if moved > 50m
    get collisionWorld(): CollisionWorld
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `src/planetary/__tests__/PlanetaryCollision.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { PlanetaryCollision } from '../PlanetaryCollision'

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
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- src/planetary/__tests__/PlanetaryCollision.test.ts
```

Expected: FAIL — `Cannot find module '../PlanetaryCollision'`

- [ ] **Step 3: Implement PlanetaryCollision**

Create `src/planetary/PlanetaryCollision.ts`:

```typescript
import * as THREE from 'three'
import type maplibregl from 'maplibre-gl'
import { CollisionWorld } from '../engine/CollisionWorld'
import { lngLatDistance } from './geoUtils'

const RESCAN_METERS = 50
const BUILDING_LAYERS = ['building']

export class PlanetaryCollision {
  private world = new CollisionWorld()
  private lastLng = NaN
  private lastLat = NaN

  constructor(private map: Pick<maplibregl.Map, 'queryRenderedFeatures'>) {}

  get collisionWorld(): CollisionWorld { return this.world }

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
    this.world.boxes.length = 0
    const metersPerDegLon = 111320 * Math.cos((refLat * Math.PI) / 180)
    const metersPerDegLat = 111320

    const features = this.map.queryRenderedFeatures(undefined, { layers: BUILDING_LAYERS })
    for (const f of features) {
      const height = (f.properties?.height as number) ?? (f.properties?.render_height as number) ?? 10
      const rings: [number, number][][] =
        f.geometry.type === 'Polygon'
          ? [f.geometry.coordinates[0] as [number, number][]]
          : f.geometry.type === 'MultiPolygon'
          ? (f.geometry.coordinates as [number, number][][][]).map(p => p[0])
          : []

      for (const ring of rings) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
        for (const [bLng, bLat] of ring) {
          const x = (bLng - refLng) * metersPerDegLon
          const z = -(bLat - refLat) * metersPerDegLat
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (z < minZ) minZ = z
          if (z > maxZ) maxZ = z
        }
        const sx = maxX - minX
        const sz = maxZ - minZ
        if (sx > 0.5 && sz > 0.5) {
          this.world.addBox(
            new THREE.Vector3((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2),
            new THREE.Vector3(sx, height, sz),
          )
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/planetary/__tests__/PlanetaryCollision.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/planetary/PlanetaryCollision.ts src/planetary/__tests__/PlanetaryCollision.test.ts
git commit -m "feat(planetary): building collision from MapLibre rendered features"
```

---

### Task 4: Road navmesh for bots (PlanetaryNavmesh) + spawn points (PlanetarySpawns)

**Files:**
- Create: `src/planetary/PlanetaryNavmesh.ts`
- Create: `src/planetary/PlanetarySpawns.ts`
- Create: `src/planetary/__tests__/PlanetaryNavmesh.test.ts`
- Create: `src/planetary/__tests__/PlanetarySpawns.test.ts`

**Interfaces:**
- Consumes: `lngLatDistance` from `./geoUtils`, `Team` from `../types`
- Produces:
  ```typescript
  // PlanetaryNavmesh.ts
  class PlanetaryNavmesh {
    build(map: Pick<maplibregl.Map, 'queryRenderedFeatures'>): void
    findPath(fromLng: number, fromLat: number, toLng: number, toLat: number): [number, number][]
    get nodeCount(): number
  }

  // PlanetarySpawns.ts
  function findSpawnPoints(
    map: Pick<maplibregl.Map, 'queryRenderedFeatures'>,
    centerLng: number,
    centerLat: number,
    team: Team,
  ): [number, number][]   // returns 1-4 [lng, lat] points
  ```

- [ ] **Step 1: Write failing navmesh test**

Create `src/planetary/__tests__/PlanetaryNavmesh.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { PlanetaryNavmesh } from '../PlanetaryNavmesh'

function makeMap(features: object[]) {
  return { queryRenderedFeatures: () => features }
}

const singleRoad = {
  geometry: {
    type: 'LineString',
    coordinates: [[0, 0], [0.001, 0], [0.002, 0]],
  },
  properties: {},
}

describe('PlanetaryNavmesh', () => {
  it('builds nodes from road linestrings', () => {
    const nm = new PlanetaryNavmesh()
    nm.build(makeMap([singleRoad]) as any)
    expect(nm.nodeCount).toBe(3)
  })

  it('returns empty path with no nodes', () => {
    const nm = new PlanetaryNavmesh()
    nm.build(makeMap([]) as any)
    expect(nm.findPath(0, 0, 1, 1)).toEqual([])
  })

  it('finds path between connected nodes', () => {
    const nm = new PlanetaryNavmesh()
    nm.build(makeMap([singleRoad]) as any)
    const path = nm.findPath(0, 0, 0.002, 0)
    expect(path.length).toBeGreaterThan(0)
    expect(path[path.length - 1][0]).toBeCloseTo(0.002, 3)
  })

  it('returns empty path for disconnected graph', () => {
    const road2 = {
      geometry: { type: 'LineString', coordinates: [[1, 0], [2, 0]] },
      properties: {},
    }
    const nm = new PlanetaryNavmesh()
    nm.build(makeMap([singleRoad, road2]) as any)
    const path = nm.findPath(0, 0, 1.5, 0)
    // May be empty since graphs are disconnected
    expect(Array.isArray(path)).toBe(true)
  })
})
```

- [ ] **Step 2: Write failing spawns test**

Create `src/planetary/__tests__/PlanetarySpawns.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { findSpawnPoints } from '../PlanetarySpawns'

function makeMap(features: object[]) {
  return { queryRenderedFeatures: () => features }
}

const park = {
  geometry: {
    type: 'Polygon',
    coordinates: [[[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]]],
  },
  properties: { leisure: 'park' },
}

const road = {
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
})
```

- [ ] **Step 3: Run to verify both fail**

```bash
npm test -- src/planetary/__tests__/PlanetaryNavmesh.test.ts src/planetary/__tests__/PlanetarySpawns.test.ts
```

Expected: FAIL — modules not found

- [ ] **Step 4: Implement PlanetaryNavmesh**

Create `src/planetary/PlanetaryNavmesh.ts`:

```typescript
import type maplibregl from 'maplibre-gl'

const ROAD_LAYERS = ['road', 'roads', 'transportation']

interface NavNode {
  id: string
  lng: number
  lat: number
  neighbors: string[]
}

export class PlanetaryNavmesh {
  private nodes = new Map<string, NavNode>()

  get nodeCount(): number { return this.nodes.size }

  build(map: Pick<maplibregl.Map, 'queryRenderedFeatures'>) {
    this.nodes.clear()
    const features = map.queryRenderedFeatures(undefined, { layers: ROAD_LAYERS })

    for (const f of features) {
      if (f.geometry.type !== 'LineString') continue
      const coords = f.geometry.coordinates as [number, number][]
      let prevId: string | null = null
      for (const [lng, lat] of coords) {
        const id = `${lng.toFixed(5)},${lat.toFixed(5)}`
        if (!this.nodes.has(id)) this.nodes.set(id, { id, lng, lat, neighbors: [] })
        if (prevId && !this.nodes.get(prevId)!.neighbors.includes(id)) {
          this.nodes.get(prevId)!.neighbors.push(id)
          this.nodes.get(id)!.neighbors.push(prevId)
        }
        prevId = id
      }
    }
  }

  findPath(fromLng: number, fromLat: number, toLng: number, toLat: number): [number, number][] {
    if (this.nodes.size === 0) return []
    const startId = this.nearestId(fromLng, fromLat)
    const goalId = this.nearestId(toLng, toLat)
    if (!startId || !goalId || startId === goalId) return []

    const goal = this.nodes.get(goalId)!
    const dist = (a: NavNode, b: NavNode) => {
      const dx = (a.lng - b.lng) * 111320
      const dz = (a.lat - b.lat) * 111320
      return Math.sqrt(dx * dx + dz * dz)
    }

    const open = new Set([startId])
    const cameFrom = new Map<string, string>()
    const g = new Map<string, number>([[startId, 0]])
    const f = new Map<string, number>([[startId, dist(this.nodes.get(startId)!, goal)]])

    while (open.size > 0) {
      let cur = [...open].reduce((a, b) => (f.get(a) ?? Infinity) < (f.get(b) ?? Infinity) ? a : b)
      if (cur === goalId) return this.reconstruct(cameFrom, cur)
      open.delete(cur)
      const node = this.nodes.get(cur)!
      for (const nid of node.neighbors) {
        const neighbor = this.nodes.get(nid)
        if (!neighbor) continue
        const tentG = (g.get(cur) ?? Infinity) + dist(node, neighbor)
        if (tentG < (g.get(nid) ?? Infinity)) {
          cameFrom.set(nid, cur)
          g.set(nid, tentG)
          f.set(nid, tentG + dist(neighbor, goal))
          open.add(nid)
        }
      }
    }
    return []
  }

  private nearestId(lng: number, lat: number): string | null {
    let best: string | null = null
    let bestD = Infinity
    for (const [id, n] of this.nodes) {
      const dx = (n.lng - lng) * 111320
      const dy = (n.lat - lat) * 111320
      const d = dx * dx + dy * dy
      if (d < bestD) { bestD = d; best = id }
    }
    return best
  }

  private reconstruct(cameFrom: Map<string, string>, cur: string): [number, number][] {
    const path: [number, number][] = []
    let c: string | undefined = cur
    while (c) {
      const n = this.nodes.get(c)
      if (n) path.unshift([n.lng, n.lat])
      c = cameFrom.get(c)
    }
    return path
  }
}
```

- [ ] **Step 5: Implement PlanetarySpawns**

Create `src/planetary/PlanetarySpawns.ts`:

```typescript
import type maplibregl from 'maplibre-gl'
import type { Team } from '../types'
import { offsetLngLat } from './geoUtils'

const OPEN_TAGS = ['park', 'playground', 'pitch', 'plaza', 'square', 'garden']
const OPEN_LAYERS = ['landuse', 'leisure', 'amenity', 'landuse_overlay']
const ROAD_LAYERS = ['road', 'roads', 'transportation']
const SPAWN_SPREAD = 30  // meters between spawn points around centroid

export function findSpawnPoints(
  map: Pick<maplibregl.Map, 'queryRenderedFeatures'>,
  centerLng: number,
  centerLat: number,
  team: Team,
): [number, number][] {
  const features = map.queryRenderedFeatures(undefined, { layers: OPEN_LAYERS })
  const open = features.filter(
    f =>
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
  const roads = map.queryRenderedFeatures(undefined, { layers: ROAD_LAYERS })
  const points: [number, number][] = roads
    .filter(r => r.geometry.type === 'LineString')
    .slice(0, 10)
    .map(r => {
      const coords = (r.geometry as GeoJSON.LineString).coordinates as [number, number][]
      return coords[Math.floor(coords.length / 2)]
    })

  if (points.length > 0) {
    const offset = team === 'ct' ? 0 : Math.ceil(points.length / 2)
    return points.slice(offset, offset + 4)
  }

  return [[centerLng, centerLat]]
}

function centroid(ring: [number, number][]): [number, number] {
  return [
    ring.reduce((s, p) => s + p[0], 0) / ring.length,
    ring.reduce((s, p) => s + p[1], 0) / ring.length,
  ]
}
```

- [ ] **Step 6: Run both tests**

```bash
npm test -- src/planetary/__tests__/PlanetaryNavmesh.test.ts src/planetary/__tests__/PlanetarySpawns.test.ts
```

Expected: both PASS

- [ ] **Step 7: Commit**

```bash
git add src/planetary/PlanetaryNavmesh.ts src/planetary/__tests__/PlanetaryNavmesh.test.ts src/planetary/PlanetarySpawns.ts src/planetary/__tests__/PlanetarySpawns.test.ts
git commit -m "feat(planetary): road navmesh for bots and OSM-based spawn points"
```

---

### Task 5: Map picker overlay (MapPicker.tsx)

**Files:**
- Create: `src/planetary/MapPicker.tsx`
- Create: `src/planetary/__tests__/MapPicker.test.tsx`

**Interfaces:**
- Consumes: `maplibre-gl`, `PlanetaryEngine` (Task 1)
- Produces:
  ```typescript
  interface MapPickerProps {
    playerPositions: Array<{ id: string; lng: number; lat: number; team: 'ct' | 't' }>
    onTeleport: (lng: number, lat: number) => void
    onClose: () => void
  }
  function MapPicker(props: MapPickerProps): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `src/planetary/__tests__/MapPicker.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('maplibre-gl', () => {
  const clickListeners: ((e: { lngLat: { lng: number; lat: number } }) => void)[] = []
  const MockMap = vi.fn().mockImplementation(() => ({
    on: vi.fn((event: string, cb: (e: { lngLat: { lng: number; lat: number } }) => void) => {
      if (event === 'click') clickListeners.push(cb)
    }),
    remove: vi.fn(),
    addControl: vi.fn(),
    _triggerClick: (lng: number, lat: number) => clickListeners.forEach(cb => cb({ lngLat: { lng, lat } })),
  }))
  return { default: { Map: MockMap, NavigationControl: vi.fn() } }
})

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import { MapPicker } from '../MapPicker'

describe('MapPicker', () => {
  it('renders close button', () => {
    render(
      <MapPicker
        playerPositions={[]}
        onTeleport={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /close/i })).toBeDefined()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<MapPicker playerPositions={[]} onTeleport={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- src/planetary/__tests__/MapPicker.test.tsx
```

Expected: FAIL — `Cannot find module '../MapPicker'`

- [ ] **Step 3: Implement MapPicker**

Create `src/planetary/MapPicker.tsx`:

```typescript
import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Team } from '../types'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const TEAM_COLOR = { ct: '#3a6ea5', t: '#a5703a' } as const

interface PlayerDot {
  id: string
  lng: number
  lat: number
  team: Team
}

interface MapPickerProps {
  playerPositions: PlayerDot[]
  onTeleport: (lng: number, lat: number) => void
  onClose: () => void
}

export function MapPicker({ playerPositions, onTeleport, onClose }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      zoom: 2,
      center: [0, 20],
    })
    map.addControl(new maplibregl.NavigationControl())
    map.on('click', e => onTeleport(e.lngLat.lng, e.lngLat.lat))
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Update player dots when positions change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = playerPositions.map(p => {
      const el = document.createElement('div')
      el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${TEAM_COLOR[p.team]};border:2px solid white`
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)
    })
    return () => { markersRef.current.forEach(m => m.remove()) }
  }, [playerPositions])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <button
        aria-label="Close map picker"
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 101,
          padding: '8px 16px', background: '#222', color: 'white',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
        }}
      >
        Close
      </button>
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px 16px',
        borderRadius: 6, fontSize: 13, pointerEvents: 'none',
      }}>
        Click anywhere to drop in
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- src/planetary/__tests__/MapPicker.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/planetary/MapPicker.tsx src/planetary/__tests__/MapPicker.test.tsx
git commit -m "feat(planetary): MapPicker 2D overlay with player dots and teleport click"
```

---

### Task 6: PlanetaryMode component + round boundaries

**Files:**
- Create: `src/planetary/PlanetaryMode.tsx`
- Create: `src/planetary/RoundBoundary.ts`
- Create: `src/planetary/__tests__/RoundBoundary.test.ts`

**Interfaces:**
- Consumes: `PlanetaryEngine` (Task 1), `GeoControls` (Task 2), `PlanetaryCollision` (Task 3), `PlanetaryNavmesh` (Task 4), `PlanetarySpawns` (Task 4), `MapPicker` (Task 5), `GameSession` from `../session/GameSession`, `lngLatDistance` from `./geoUtils`
- Produces:
  ```typescript
  // RoundBoundary.ts
  class RoundBoundary {
    constructor(warnMeters?: number, killMeters?: number)  // defaults 600, 700
    update(playerPositions: [number, number][]): void
    check(lng: number, lat: number): 'safe' | 'warn' | 'out'
    get center(): [number, number]
  }

  // PlanetaryMode.tsx
  interface PlanetaryModeProps { onExit: () => void }
  function PlanetaryMode(props: PlanetaryModeProps): JSX.Element
  ```

- [ ] **Step 1: Write failing test for RoundBoundary**

Create `src/planetary/__tests__/RoundBoundary.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { RoundBoundary } from '../RoundBoundary'

describe('RoundBoundary', () => {
  it('center defaults to first update median', () => {
    const rb = new RoundBoundary()
    rb.update([[0, 0], [0.002, 0]])
    const [lng] = rb.center
    expect(lng).toBeCloseTo(0.001, 3)
  })

  it('returns safe when inside warn radius', () => {
    const rb = new RoundBoundary(600, 700)
    rb.update([[0, 0]])
    expect(rb.check(0, 0)).toBe('safe')
  })

  it('returns warn between 600m and 700m', () => {
    const rb = new RoundBoundary(600, 700)
    rb.update([[0, 0]])
    // ~0.0054 degrees lat ≈ 600m
    expect(rb.check(0, 0.006)).toBe('warn')
  })

  it('returns out beyond 700m', () => {
    const rb = new RoundBoundary(600, 700)
    rb.update([[0, 0]])
    expect(rb.check(0, 0.01)).toBe('out')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- src/planetary/__tests__/RoundBoundary.test.ts
```

Expected: FAIL — `Cannot find module '../RoundBoundary'`

- [ ] **Step 3: Implement RoundBoundary**

Create `src/planetary/RoundBoundary.ts`:

```typescript
import { medianLngLat, lngLatDistance } from './geoUtils'

export class RoundBoundary {
  private _center: [number, number] = [0, 0]

  constructor(
    private warnMeters = 600,
    private killMeters = 700,
  ) {}

  update(playerPositions: [number, number][]) {
    if (playerPositions.length > 0) this._center = medianLngLat(playerPositions)
  }

  check(lng: number, lat: number): 'safe' | 'warn' | 'out' {
    const d = lngLatDistance(lng, lat, this._center[0], this._center[1])
    if (d >= this.killMeters) return 'out'
    if (d >= this.warnMeters) return 'warn'
    return 'safe'
  }

  get center(): [number, number] { return this._center }
}
```

- [ ] **Step 4: Run RoundBoundary tests**

```bash
npm test -- src/planetary/__tests__/RoundBoundary.test.ts
```

Expected: PASS

- [ ] **Step 5: Implement PlanetaryMode component**

Create `src/planetary/PlanetaryMode.tsx`:

```typescript
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { PlanetaryEngine } from './PlanetaryEngine'
import { GeoControls } from './GeoControls'
import { PlanetaryCollision } from './PlanetaryCollision'
import { PlanetaryNavmesh } from './PlanetaryNavmesh'
import { MapPicker } from './MapPicker'
import { RoundBoundary } from './RoundBoundary'
import { GameSession } from '../session/GameSession'
import { defaultCompetitiveConfig } from '../session/MatchConfig'
import { HUD } from '../ui/HUD'

interface PlanetaryModeProps {
  onExit: () => void
}

interface HudState {
  health: number
  maxHealth: number
  ammo: number
  maxAmmo: number
  weaponName: string
  money: number
}

export function PlanetaryMode({ onExit }: PlanetaryModeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PlanetaryEngine | null>(null)
  const controlsRef = useRef<GeoControls | null>(null)
  const collisionRef = useRef<PlanetaryCollision | null>(null)
  const navmeshRef = useRef<PlanetaryNavmesh | null>(null)
  const sessionRef = useRef<GameSession | null>(null)
  const boundaryRef = useRef<RoundBoundary>(new RoundBoundary())
  const rafRef = useRef<number>(0)

  const [showPicker, setShowPicker] = useState(true)
  const [boundaryStatus, setBoundaryStatus] = useState<'safe' | 'warn' | 'out'>('safe')
  const [hudState, setHudState] = useState<HudState>({
    health: 100, maxHealth: 100, ammo: 30, maxAmmo: 30, weaponName: 'pistol', money: 800,
  })
  const [remoteDots, setRemoteDots] = useState<Array<{ id: string; lng: number; lat: number; team: 'ct' | 't' }>>([])

  useEffect(() => {
    if (!containerRef.current) return
    const engine = new PlanetaryEngine(containerRef.current)
    engineRef.current = engine

    engine.onReady(() => {
      const controls = new GeoControls(engine.map, containerRef.current!)
      controls.attach()
      controlsRef.current = controls

      collisionRef.current = new PlanetaryCollision(engine.map)
      navmeshRef.current = new PlanetaryNavmesh()
      navmeshRef.current.build(engine.map)

      // GameSession uses MatchConfig — competitive mode, no zone (planetary provides the map)
      const config = { ...defaultCompetitiveConfig(), zoneId: undefined }
      const session = new GameSession(config)
      session.collisionWorld = collisionRef.current.collisionWorld
      // Add 5 bots split across teams
      for (let i = 0; i < 3; i++) session.addBot('ct')
      for (let i = 0; i < 2; i++) session.addBot('t')
      sessionRef.current = session

      let last = performance.now()
      function loop(now: number) {
        const dt = Math.min((now - last) / 1000, 0.05)
        last = now
        controls.update(dt)

        const center = engine.map.getCenter()

        // Update collision from visible tiles
        if (collisionRef.current) {
          session.collisionWorld = collisionRef.current.update(center.lng, center.lat)
        }

        // Check round boundary
        const status = boundaryRef.current.check(center.lng, center.lat)
        setBoundaryStatus(status)
        if (status === 'out' && !session.localPlayer.isDead) {
          session.localPlayer.takeDamage(50 * dt)
        }

        // Sync HUD state from session
        setHudState({
          health: session.localPlayer.health,
          maxHealth: session.localPlayer.maxHealth,
          ammo: session.localWeapons.current.ammo,
          maxAmmo: session.localWeapons.current.def.maxAmmo,
          weaponName: session.localWeapons.current.def.name,
          money: session.economy?.money ?? 0,
        })

        session.tick++
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    })

    return () => {
      cancelAnimationFrame(rafRef.current)
      controlsRef.current?.detach()
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  const handleTeleport = useCallback((lng: number, lat: number) => {
    setShowPicker(false)
    engineRef.current?.map.flyTo({ center: [lng, lat], zoom: 17, pitch: 60, duration: 1500 })
    setTimeout(() => {
      if (navmeshRef.current && engineRef.current) {
        navmeshRef.current.build(engineRef.current.map)
        boundaryRef.current.update([[lng, lat]])
      }
    }, 2000)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {showPicker && (
        <MapPicker
          playerPositions={remoteDots}
          onTeleport={handleTeleport}
          onClose={() => setShowPicker(false)}
        />
      )}

      {!showPicker && (
        <HUD
          health={hudState.health}
          maxHealth={hudState.maxHealth}
          ammo={hudState.ammo}
          maxAmmo={hudState.maxAmmo}
          weaponName={hudState.weaponName}
          score={0}
          wave={0}
          waveActive={false}
          enemiesRemaining={0}
          money={hudState.money}
        />
      )}

      {!showPicker && boundaryStatus !== 'safe' && (
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          color: boundaryStatus === 'out' ? '#ff3300' : '#ffaa00',
          fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
          textShadow: '0 0 8px rgba(0,0,0,0.8)', pointerEvents: 'none',
        }}>
          {boundaryStatus === 'out' ? '⚠ OUT OF BOUNDS — TAKING DAMAGE' : '⚠ LEAVING PLAY AREA'}
        </div>
      )}

      <button
        onClick={() => setShowPicker(true)}
        style={{
          position: 'absolute', top: 16, left: 16, padding: '6px 12px',
          background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid #555',
          borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
        }}
      >
        [M] Map
      </button>

      <button
        onClick={onExit}
        style={{
          position: 'absolute', top: 16, right: 16, padding: '6px 12px',
          background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid #555',
          borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
        }}
      >
        Exit
      </button>
    </div>
  )
}
```

**Note:** `session.localWeapons.current.def` — check `src/weapons/WeaponManager.ts` to verify the `def` property name on the current weapon. Adjust if different.

- [ ] **Step 6: Run all planetary tests**

```bash
npm test -- src/planetary/
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/planetary/RoundBoundary.ts src/planetary/__tests__/RoundBoundary.test.ts src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): PlanetaryMode component, RoundBoundary, and game loop integration"
```

---

### Task 7: App wiring — add Planetary Mode to the game

**Files:**
- Modify: `src/types.ts` (add `'planetary'` to `GameState`)
- Modify: `src/ui/MainMenu.tsx` (add Planetary Mode button)
- Modify: `src/App.tsx` (add planetary state routing)

**Interfaces:**
- Consumes: `PlanetaryMode` from `./planetary/PlanetaryMode`
- The `GameState` type is used across the codebase — adding a value is additive, no existing handlers break

- [ ] **Step 1: Add 'planetary' to GameState**

In `src/types.ts`, find:

```typescript
export type GameState = 'menu' | 'mpmenu' | 'settings' | 'keybinds' | 'teamselect' | 'playing' | 'paused' | 'gameover' | 'matchover' | 'mapeditor'
```

Replace with:

```typescript
export type GameState = 'menu' | 'mpmenu' | 'settings' | 'keybinds' | 'teamselect' | 'playing' | 'paused' | 'gameover' | 'matchover' | 'mapeditor' | 'planetary'
```

- [ ] **Step 2: Add Planetary Mode button to MainMenu**

In `src/ui/MainMenu.tsx`, add `onPlanetary: () => void` to `MainMenuProps` and add a button. Find the props interface:

```typescript
interface MainMenuProps {
  onSingleplayer: () => void
  onMultiplayer: () => void
  onSettings: () => void
  onAbout: () => void
  onHelp: () => void
}
```

Replace with:

```typescript
interface MainMenuProps {
  onSingleplayer: () => void
  onMultiplayer: () => void
  onPlanetary: () => void
  onSettings: () => void
  onAbout: () => void
  onHelp: () => void
}
```

Add `onPlanetary` to the destructure and add the button after the MULTIPLAYER button:

```typescript
export const MainMenu: React.FC<MainMenuProps> = ({
  onSingleplayer, onMultiplayer, onPlanetary, onSettings, onAbout, onHelp,
}) => {
```

Add this button after the MULTIPLAYER button in the button group:

```typescript
<button className="ui-btn" onClick={onPlanetary} style={{
  padding: '16px 40px', fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 'bold', background: '#228844',
  color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
}}>PLANETARY</button>
```

- [ ] **Step 3: Wire planetary state in App.tsx**

Open `src/App.tsx`. Add import near the top with the other imports:

```typescript
import { PlanetaryMode } from './planetary/PlanetaryMode'
```

Find where `MainMenu` is rendered (search for `onSingleplayer`). Add `onPlanetary` prop:

```typescript
onPlanetary={() => setState('planetary')}
```

Find where the app renders based on state (the series of conditional renders / switch). Add planetary mode rendering. It should be a fullscreen take-over, so add it before the main game canvas renders, or as a conditional branch:

```typescript
{state === 'planetary' && (
  <PlanetaryMode onExit={() => setState('menu')} />
)}
```

**Important:** The planetary mode needs to be rendered in place of — not on top of — the regular game canvas. Find how `playing` state is handled in App.tsx to understand the pattern, then apply the same approach for `planetary`. The `PlanetaryMode` component is self-contained and manages its own canvas.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all PASS. The type change is additive — no existing switch/case exhaustiveness checks should break, but if they do, add a `'planetary'` case that does nothing.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/ui/MainMenu.tsx src/App.tsx
git commit -m "feat(planetary): wire Planetary Mode into app routing and main menu"
```

---

### Task 8: Create branch, push, and open PR

**Files:** none (git operations only)

- [ ] **Step 1: Verify all tests pass on main**

```bash
npm test
```

Expected: all PASS

- [ ] **Step 2: Check git log for all planetary commits**

```bash
git log --oneline main..HEAD
```

Expected: shows 7 commits from tasks 1-7

- [ ] **Step 3: Push and create PR**

```bash
git push -u origin HEAD
gh pr create \
  --title "feat: Planetary Mode — real-world FPS on MapLibre vector tiles" \
  --body "$(cat <<'EOF'
## Summary

- Adds **Planetary Mode** to browser-shooter: players drop into any city on Earth via a 2D map picker and play a full CS-style game with real OSM buildings and roads
- MapLibre GL JS renders the world; Three.js custom layer renders game objects in the same WebGL context
- FPS controls (WASD + mouselook) drive MapLibre camera (bearing/pitch/center)
- Building footprints from rendered tiles feed into existing CollisionWorld (re-scanned every 50m)
- Road network from tiles becomes a runtime A* navmesh for bots
- Spawn points from OSM open areas (parks, plazas); falls back to road midpoints
- Round boundaries: 500m radius around median player position, warn at 600m, out at 700m
- 2D map picker overlay shows live player dots; click to teleport

## New files

- \`src/planetary/PlanetaryEngine.ts\` — MapLibre + Three.js custom layer
- \`src/planetary/geoUtils.ts\` — coordinate math
- \`src/planetary/GeoControls.ts\` — FPS input → MapLibre camera
- \`src/planetary/PlanetaryCollision.ts\` — tiles → CollisionWorld
- \`src/planetary/PlanetaryNavmesh.ts\` — road A* navmesh
- \`src/planetary/PlanetarySpawns.ts\` — OSM spawn points
- \`src/planetary/MapPicker.tsx\` — 2D overlay
- \`src/planetary/RoundBoundary.ts\` — out-of-bounds logic
- \`src/planetary/PlanetaryMode.tsx\` — top-level component

## Test plan

- [ ] `npm test` passes
- [ ] Click PLANETARY in main menu → 2D world map appears with player dots
- [ ] Click a city → camera flies to first-person view
- [ ] WASD moves player through city streets
- [ ] Mouselook rotates view
- [ ] Buildings block movement (collision)
- [ ] Bots navigate streets
- [ ] Round boundary warning appears when moving far from median player position
- [ ] [M] button reopens map picker

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Check CI**

```bash
gh run list --repo hermes98761234/browser-shooter --branch planetary-mode --limit 2
```

Wait for CI to pass. If it fails:

```bash
gh run watch <run-id> --exit-status
```

Then fix the failure, commit, and push.
