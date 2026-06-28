# Planetary Three.js FPS World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Planetary Mode's world (ground + extruded buildings) in a standalone Three.js scene viewed by a real first-person camera, instead of MapLibre's aerial map camera — so the player stands on the ground and looks at building facades.

**Architecture:** MapLibre is demoted from renderer to a hidden vector-tile *data source* (kept alive only for `queryRenderedFeatures` + `setCenter` tile loading). A separate `THREE.WebGLRenderer` with its own canvas is overlaid on top of the map container and draws an opaque FPS scene: a ground plane, building meshes extruded from the same collision boxes the player physically collides with, plus the existing viewmodel parented to the camera. The camera is a plain `PerspectiveCamera` placed at `player.position` (which already encodes eye height) and oriented `rotation.set(pitch, yaw, 0, 'YXZ')` — identical to the main game (`App.tsx:1289`). Building meshes and collision boxes are both expressed in origin-relative local meters so what you see is what you hit.

**Tech Stack:** TypeScript, React, three.js, maplibre-gl, Vitest.

## Global Constraints

- Coordinate convention (unchanged from codebase): local game space X = east, Z = south; `player.position` **is the eye position** (`Player.ts:6,26` — `EYE_HEIGHT = 2` already baked into `position.y`).
- Camera orientation must match the main game exactly: `camera.rotation.set(pitch, yaw, 0, 'YXZ')` (see `App.tsx:1289`).
- Building box vertical convention (unchanged): a box of `height` h spans y ∈ [0, h]; its center y = h/2 (`PlanetaryCollision.ts:59`).
- Tests run under jsdom, which has **no WebGL context**. `THREE.WebGLRenderer` must NOT be constructed at module load, in the `PlanetaryEngine` constructor, or in the `map.on('load')` path — only lazily on the first `render()` call (which unit tests never invoke).
- Do not add new dependencies. three and maplibre-gl are already present.

---

## File Structure

- `src/planetary/PlanetaryCollision.ts` — MODIFY: build boxes in origin-relative local meters via an injected converter (so boxes align with `player.position` regardless of scan center).
- `src/planetary/PlanetaryEngine.ts` — MODIFY: remove the MapLibre custom-layer Three rendering; add a standalone renderer + scene (ground, lights, sky), `setBuildings()`, lazy `render()`, and a simplified `setViewFromPlayer()`.
- `src/planetary/PlanetaryMode.tsx` — MODIFY: stop forcing `setPitch(75)`/look manipulation, pass `engine.lngLatToLocal` to collision, push collision boxes into `engine.setBuildings()` on rebuild, and call `engine.render()` each frame.
- `src/planetary/__tests__/PlanetaryCollision.test.ts` — MODIFY: add an origin-invariance test.
- `src/planetary/__tests__/PlanetaryEngine.test.ts` — MODIFY: add `setBuildings`/`setViewFromPlayer` tests; keep existing construct/onReady tests green (no WebGL).

**Out of scope (explicitly skipped):** rendering dynamic entities (enemies/remote players/bullets) into the new scene. Planetary competitive mode currently has no AI bots (commit `743faa3`) and runs a local single session, so the scene's only dynamic object is the viewmodel. Add entity rendering later if multiplayer/bots return to this mode.

---

### Task 1: Origin-relative collision boxes

Make `PlanetaryCollision` place boxes in a fixed origin-relative frame (the drop point), so they coincide with `player.position`. Today boxes are built relative to the *moving* scan center, so they only line up with the player near spawn. We inject the engine's existing `lngLatToLocal` converter; when none is given, behavior is unchanged (scan-center-relative) so existing tests stay valid.

**Files:**
- Modify: `src/planetary/PlanetaryCollision.ts`
- Test: `src/planetary/__tests__/PlanetaryCollision.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `new PlanetaryCollision(map, toLocal?)` where `toLocal?: (lng: number, lat: number) => [number, number]` returns `[localX, localZ]` (east, south) meters. `update(lng, lat)` and `collisionWorld` signatures unchanged.

- [ ] **Step 1: Write the failing test**

Add to `src/planetary/__tests__/PlanetaryCollision.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/planetary/__tests__/PlanetaryCollision.test.ts -t "injected origin frame"`
Expected: FAIL — without the converter the box coords shift with the scan center (`second` differs from `first`), or constructor rejects the 2nd arg.

- [ ] **Step 3: Implement the converter injection**

In `src/planetary/PlanetaryCollision.ts`, change the constructor and `rebuild`:

```ts
export class PlanetaryCollision {
  private world = new CollisionWorld()
  private lastLng = NaN
  private lastLat = NaN

  constructor(
    private map: Pick<maplibregl.Map, 'queryRenderedFeatures'>,
    private toLocal?: (lng: number, lat: number) => [number, number],
  ) {}
```

Replace the body of `rebuild` so vertex→local conversion uses the injected converter, falling back to scan-center-relative when absent:

```ts
  private rebuild(refLng: number, refLat: number) {
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
          const [x, z] = toLocal(bLng, bLat)
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
```

Note: `rebuild(refLng, refLat)` already receives the scan center from `update` (`this.rebuild(lng, lat)` at `PlanetaryCollision.ts:26`). Keep that call site as-is.

- [ ] **Step 4: Run the full collision test file**

Run: `npx vitest run src/planetary/__tests__/PlanetaryCollision.test.ts`
Expected: PASS — the new origin-invariance test passes and all 4 existing tests stay green (they pass no converter, so behavior is unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/planetary/PlanetaryCollision.ts src/planetary/__tests__/PlanetaryCollision.test.ts
git commit -m "feat(planetary): build collision boxes in origin-relative frame"
```

---

### Task 2: Standalone Three.js FPS renderer in PlanetaryEngine

Replace the MapLibre custom-layer rendering with an independent Three.js renderer, scene (ground + lights + sky), building meshes, and a real first-person camera. Keep the MapLibre map for data + tile loading.

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts`
- Test: `src/planetary/__tests__/PlanetaryEngine.test.ts`

**Interfaces:**
- Consumes: `BoxCollider` from `../engine/CollisionWorld` (`{ min: THREE.Vector3; max: THREE.Vector3 }`).
- Produces:
  - `setBuildings(boxes: BoxCollider[]): void` — rebuilds the visible building meshes from collision boxes.
  - `setViewFromPlayer(playerPos: THREE.Vector3, yaw: number, pitch: number): void` — camera at `playerPos`, oriented `(pitch, yaw, 0, 'YXZ')`. **Note: `mapBearing` parameter is removed.**
  - `render(): void` — lazily creates the WebGL renderer/canvas on first call, then draws the scene.
  - `lngLatToLocal`, `localToLngLat` — unchanged, still exported for map centering + collision.

- [ ] **Step 1: Write the failing tests**

Add to `src/planetary/__tests__/PlanetaryEngine.test.ts` (the existing maplibre mock + imports stay):

```ts
import { CollisionWorld } from '../../engine/CollisionWorld'

it('builds building meshes from collision boxes', () => {
  const container = document.createElement('div')
  const engine = new PlanetaryEngine(container)
  const world = new CollisionWorld()
  world.addBox(new THREE.Vector3(5, 10, 5), new THREE.Vector3(4, 20, 4))
  engine.setBuildings(world.boxes)
  let meshCount = 0
  engine.scene.traverse(o => { if (o instanceof THREE.Mesh) meshCount++ })
  expect(meshCount).toBeGreaterThan(0)
  engine.dispose()
})

it('places the camera at the player eye position and faces yaw/pitch', () => {
  const container = document.createElement('div')
  const engine = new PlanetaryEngine(container)
  engine.setViewFromPlayer(new THREE.Vector3(3, 2, -7), Math.PI / 2, 0.1)
  expect(engine.camera.position.x).toBeCloseTo(3)
  expect(engine.camera.position.y).toBeCloseTo(2)
  expect(engine.camera.position.z).toBeCloseTo(-7)
  expect(engine.camera.rotation.y).toBeCloseTo(Math.PI / 2)
  expect(engine.camera.rotation.x).toBeCloseTo(0.1)
  engine.dispose()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: FAIL — `setBuildings` / new `setViewFromPlayer` signature not present yet.

- [ ] **Step 3: Rewrite PlanetaryEngine**

Replace `src/planetary/PlanetaryEngine.ts` with:

```ts
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'
import type { BoxCollider } from '../engine/CollisionWorld'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const METERS_PER_DEG_LAT = 111320

function lngLatToMercator(lng: number, lat: number): [number, number] {
  const x = lng * METERS_PER_DEG_LAT * Math.cos((Math.min(Math.abs(lat), 89) * Math.PI) / 180)
  const y = lat * METERS_PER_DEG_LAT
  return [x, y]
}

function mercatorToLngLat(x: number, y: number): [number, number] {
  const lat = y / METERS_PER_DEG_LAT
  const lng = x / (METERS_PER_DEG_LAT * Math.cos((Math.min(Math.abs(lat), 89) * Math.PI) / 180))
  return [lng, lat]
}

export class PlanetaryEngine {
  map: maplibregl.Map
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer | null = null
  private buildings = new THREE.Group()
  private buildingMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.9, metalness: 0 })
  private readyCbs: (() => void)[] = []
  private originMercator: [number, number] = [0, 0]

  constructor(private container: HTMLElement, center: [number, number] = [0, 0]) {
    this.originMercator = lngLatToMercator(center[0], center[1])

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x9ec7e8) // daytime sky
    this.scene.fog = new THREE.Fog(0x9ec7e8, 120, 600)

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000)

    // Lights: soft ambient + sun.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(100, 200, 50)
    this.scene.add(sun)

    // Ground plane (large, lies at y=0 like the building bottoms).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ color: 0x5b6b4a, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    this.scene.add(ground)
    this.scene.add(this.buildings)

    this.map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center,
      zoom: 17,
      pitch: 0,
    })
    this.map.on('load', () => {
      this.readyCbs.forEach(cb => cb())
    })
  }

  onReady(cb: () => void) {
    this.readyCbs.push(cb)
  }

  /** Position/orient the FPS camera. playerPos is the eye position (Player.EYE_HEIGHT baked in). */
  setViewFromPlayer(playerPos: THREE.Vector3, yaw: number, pitch: number) {
    this.camera.position.copy(playerPos)
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ')
  }

  /** Rebuild visible building meshes from the collision boxes (origin-relative meters). */
  setBuildings(boxes: BoxCollider[]) {
    this.disposeBuildings()
    for (const b of boxes) {
      const sx = b.max.x - b.min.x
      const sy = b.max.y - b.min.y
      const sz = b.max.z - b.min.z
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), this.buildingMat)
      mesh.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)
      this.buildings.add(mesh)
    }
  }

  private disposeBuildings() {
    for (const m of this.buildings.children) {
      if (m instanceof THREE.Mesh) m.geometry.dispose()
    }
    this.buildings.clear()
  }

  /** Lazily create the WebGL renderer on first frame (kept out of constructor for jsdom tests). */
  render() {
    if (!this.renderer) {
      const r = new THREE.WebGLRenderer({ antialias: true })
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      const canvas = r.domElement
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      this.container.appendChild(canvas)
      this.renderer = r
    }
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    const size = this.renderer.getSize(new THREE.Vector2())
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
    this.renderer.render(this.scene, this.camera)
  }

  localToMercator(localX: number, localZ: number, height = 0): THREE.Vector3 {
    return new THREE.Vector3(this.originMercator[0] + localX, height, this.originMercator[1] - localZ)
  }

  mercatorToLocal(mx: number, my: number): [number, number] {
    return [mx - this.originMercator[0], this.originMercator[1] - my]
  }

  lngLatToLocal(lng: number, lat: number): [number, number] {
    const [mx, my] = lngLatToMercator(lng, lat)
    return this.mercatorToLocal(mx, my)
  }

  localToLngLat(localX: number, localZ: number): [number, number] {
    const mx = this.originMercator[0] + localX
    const my = this.originMercator[1] - localZ
    return mercatorToLngLat(mx, my)
  }

  dispose() {
    this.disposeBuildings()
    this.renderer?.domElement.remove()
    this.renderer?.dispose()
    this.map.remove()
  }
}
```

Note: this removes `addGameObjectsLayer` and the shared-context renderer entirely. `localToMercator`/`mercatorToLocal` are retained (cheap, used by `lngLatToLocal`/`localToLngLat`).

- [ ] **Step 4: Run the engine tests**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: PASS — both new tests pass; the existing "creates scene and camera" and "calls onReady after map load" tests stay green (no WebGL constructed in constructor or load path).

- [ ] **Step 5: Commit**

```bash
git add src/planetary/PlanetaryEngine.ts src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "feat(planetary): standalone Three.js FPS renderer with extruded buildings"
```

---

### Task 3: Wire the FPS world into PlanetaryMode

Feed origin-relative collision boxes to the engine, push them into `setBuildings()` whenever the collision world rebuilds, render the Three scene each frame, and stop the MapLibre aerial-camera manipulation.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx`

**Interfaces:**
- Consumes: `engine.lngLatToLocal`, `engine.setBuildings`, `engine.render`, new `engine.setViewFromPlayer(pos, yaw, pitch)` from Tasks 1–2.

- [ ] **Step 1: Inject the origin converter into collision**

In `src/planetary/PlanetaryMode.tsx`, change the collision construction (currently `PlanetaryMode.tsx:85`):

```tsx
      collisionRef.current = new PlanetaryCollision(
        engine.map,
        (lng, lat) => engine.lngLatToLocal(lng, lat),
      )
```

- [ ] **Step 2: Render buildings whenever the collision world rebuilds**

Replace the collision-update + camera + map-sync block (currently `PlanetaryMode.tsx:156-159` and `244-255`). First, the camera update right after `session.step` — drop the `mapBearing` argument:

```tsx
        // 4. Update the Three.js camera from player state (eye pos + look).
        const p = session.player.position
        engine.setViewFromPlayer(p, session.player.rotation.y, session.player.rotation.x)
```

Then the map-sync / collision block becomes:

```tsx
        // 5. Keep the (hidden) map centered on the player so vector tiles load.
        const [lng, lat] = engine.localToLngLat(p.x, p.z)
        engine.map.setCenter([lng, lat])

        // 6. Rebuild collision near the player; mirror the boxes into the visible scene.
        const center = engine.map.getCenter()
        if (collisionRef.current) {
          const before = collisionRef.current.collisionWorld.boxes.length
          session.collisionWorld = collisionRef.current.update(center.lng, center.lat)
          // update() is a no-op within 50 m; only re-mesh when the box set actually changed.
          if (collisionRef.current.collisionWorld.boxes.length !== before || before === 0) {
            engine.setBuildings(collisionRef.current.collisionWorld.boxes)
          }
        }
```

Remove the now-deleted lines `engine.map.setPitch(75)` and `engine.map.setBearing(0)` (they were `PlanetaryMode.tsx:248-249`). The map no longer drives the view.

- [ ] **Step 3: Render the Three scene each frame**

At the end of `loop`, just before `viewmodel.update(...)` (currently `PlanetaryMode.tsx:277-278`), add the draw call:

```tsx
        // 9. Draw the FPS scene (lazily creates the WebGL canvas on first frame).
        engine.render()
        viewmodel.update(dt, false)
```

- [ ] **Step 4: Fix the re-teleport path**

In `handleTeleport` (currently `PlanetaryMode.tsx:346`), the `flyTo` uses `pitch: 60`; since the map is now a hidden data source, use `pitch: 0` to keep feature queries flat and wide:

```tsx
      engineRef.current.map.flyTo({ center: [lng, lat], zoom: 17, pitch: 0, duration: 1500 })
```

- [ ] **Step 5: Typecheck + run the planetary test suite**

Run: `npx tsc --noEmit && npx vitest run src/planetary`
Expected: PASS — no type errors (the removed `mapBearing` arg and removed `setPitch`/`setBearing` calls compile), all planetary tests green.

- [ ] **Step 6: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): render FPS world, demote MapLibre to data source"
```

---

### Task 4: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS (or only the known pre-existing failures — see memory `preexisting-e2e-failures`). No new failures in `src/planetary`, `src/engine`, `src/session`.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build.

- [ ] **Step 3: Manual smoke test (use the `verify` skill / `/run`)**

Launch the app, enter Planetary Mode, pick a dense-city drop point. Confirm:
- The view is at ground level (standing between buildings), NOT a top-down/oblique fly-over.
- Mouse-look rotates yaw/pitch like an FPS; WASD walks forward in the look direction.
- Buildings are solid boxes you cannot walk through, and they sit where you see them (visual == collision).
- The green crosshair is centered; the viewmodel gun is visible at the bottom.

- [ ] **Step 4: Commit any fixes from manual testing, then push**

```bash
git push
```

Then check CI per `CLAUDE.md`:

```bash
gh run list --repo hermes98761234/browser-shooter --branch <branch> --limit 2
gh run watch <run-id> --exit-status
```

---

## Self-Review Notes

- **Spec coverage:** root cause #1 (MapLibre aerial camera) → Tasks 2–3 (own renderer + camera, stop `setPitch(75)`); root cause #2 (MVP matrix misused as projection) → Task 2 (no shared-context custom layer; real `projectionMatrix` via `updateProjectionMatrix`); visual/collision alignment → Task 1 (origin-relative boxes) + Task 3 (`setBuildings` from those boxes).
- **jsdom/WebGL:** renderer creation deferred to `render()`; unit tests never call it. Verified against existing `PlanetaryEngine.test.ts` which only constructs + triggers load.
- **Type consistency:** `setViewFromPlayer(pos, yaw, pitch)` (3 args) is used consistently in Engine and Mode; `mapBearing` removed in both. `setBuildings(boxes)` / `collisionWorld.boxes` (`BoxCollider[]`) match `CollisionWorld`. `PlanetaryCollision(map, toLocal?)` optional arg keeps existing tests valid.
