# Zone Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the concept "map" to "zone" across the entire codebase, and rename the five CS-named levels to original names (Dust II→Arid, Mirage→Haze, Inferno→Ember, Nuke→Reactor, Overpass→Crossing).

**Architecture:** Pure rename refactor across four layers — zone definitions (`src/zones/`), session config (`MatchConfig`, `GameSession`, `Spawns`), engine (`Arena`), and UI (`App`, `MatchSetup`, `TeamSelect`). No logic changes, no new features. Each task is additive: old `src/maps/` stays untouched until Task 7, so the build stays green throughout.

**Tech Stack:** TypeScript, React, Vitest. Test command: `npm test`. Single-file test: `npx vitest run src/path/to/file.test.ts`.

## Global Constraints

- Never change geometry, spawn points, lighting, or bombsite positions in any zone file — only `id`, `name`, `description`, import paths, and const names change.
- Keep `arenaSize: 50` on arid (was dust2), `arenaSize: 30` on all others.
- Default zone id is `'arid'` (was `'dust2'`).
- Zone display order in the registry: arid, haze, ember, reactor, crossing.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/zones/ZoneDef.ts` | Type definitions (ZoneDef, ZoneStructure, ZoneBombsite, ZoneLighting, DAYLIGHT) |
| Create | `src/zones/buildings.ts` | Building geometry helpers (unchanged logic, updated import) |
| Create | `src/zones/buildings.test.ts` | Building helper tests (updated import) |
| Create | `src/zones/arid.ts` | Desert zone (was dust2.ts — ARID const, id 'arid') |
| Create | `src/zones/haze.ts` | Urban zone (was mirage.ts — HAZE const, id 'haze') |
| Create | `src/zones/ember.ts` | Industrial zone (was inferno.ts — EMBER const, id 'ember') |
| Create | `src/zones/reactor.ts` | Nuclear zone (was nuke.ts — REACTOR const, id 'reactor') |
| Create | `src/zones/crossing.ts` | Bridge zone (was overpass.ts — CROSSING const, id 'crossing') |
| Create | `src/zones/arid.test.ts` | Geometry validation for Arid (was dust2.test.ts) |
| Create | `src/zones/registry.ts` | ZONES array, getZone(), DEFAULT_ZONE_ID |
| Create | `src/zones/registry.test.ts` | Registry tests (updated ids, symbol names) |
| Modify | `src/session/MatchConfig.ts` | mapId → zoneId; default value 'dust2' → 'arid' |
| Modify | `src/session/MatchConfig.test.ts` | mapId → zoneId; 'dust2' → 'arid' |
| Modify | `src/session/GameSession.ts` | import ZoneDef/getZone from zones; mapId → zoneId |
| Modify | `src/session/GameSession.map.test.ts` | import getZone; 'mirage' → 'haze'; zoneId |
| Modify | `src/session/Spawns.ts` | import ZoneDef/getZone from zones |
| Modify | `src/session/Spawns.test.ts` | import getZone; 'dust2'→'arid', 'mirage'→'haze' |
| Modify | `src/engine/Arena.ts` | import ZoneDef/getZone from zones |
| Modify | `src/engine/__tests__/Arena.test.ts` | import getZone/ZONES; 'dust2'→'arid', 'mirage'→'haze' |
| Modify | `src/App.tsx` | import getZone from zones; mapId → zoneId |
| Modify | `src/ui/MatchSetup.tsx` | ZONES/DEFAULT_ZONE_ID; zoneId; label 'ZONE' |
| Modify | `src/ui/TeamSelect.tsx` | ZONES/DEFAULT_ZONE_ID; zoneId; heading 'CHOOSE YOUR ZONE' |
| Modify | `src/ui/__tests__/TeamSelect.test.tsx` | import from zones; DEFAULT_ZONE_ID/ZONES |
| Delete | `src/maps/` (entire folder) | Replaced by src/zones/ |

---

## Task 1: Scaffold `src/zones/` — ZoneDef, buildings

**Files:**
- Create: `src/zones/ZoneDef.ts`
- Create: `src/zones/buildings.ts`
- Create: `src/zones/buildings.test.ts`

**Interfaces:**
- Produces: `ZoneDef`, `ZoneStructure`, `ZoneBombsite`, `ZoneLighting`, `DAYLIGHT` — used by all zone files and Arena.ts
- Produces: `wall`, `doorway`, `building`, `buildingWithRooms`, `stairs` — used by zone data files

- [ ] **Step 1: Create `src/zones/ZoneDef.ts`**

```typescript
// src/zones/ZoneDef.ts
/** Material key for a zone structure; resolved to a THREE material in Arena.ts. */
export type StructureMaterial = 'wall' | 'crate' | 'concrete' | 'metal' | 'wood'

/** A solid box added to both the rendered scene and the collision world. */
export interface ZoneStructure {
  /** Box center [x, y, z]. */
  center: [number, number, number]
  /** Full box size [width, height, depth]. */
  size: [number, number, number]
  material: StructureMaterial
}

/** A bombsite marker / capture zone, positioned on the floor plane. */
export interface ZoneBombsite {
  id: 'A' | 'B'
  /** Center on the floor [x, z]. */
  center: [number, number]
}

export interface ZoneLighting {
  ambientColor: number
  ambientIntensity: number
  sunColor: number
  sunIntensity: number
  sunPosition: [number, number, number]
}

/** A complete, data-driven zone definition: geometry, lighting, spawns, sites. */
export interface ZoneDef {
  id: string
  name: string
  description: string
  /** Half-extent of the (square) arena. */
  arenaSize: number
  floorColor: number
  /** Sky/fog colour for outdoor zones. Omit for indoor zones (uses engine default). */
  skyColor?: number
  /** Fog start distance (default 30). */
  fogNear?: number
  /** Fog end distance (default 100). */
  fogFar?: number
  lighting: ZoneLighting
  structures: ZoneStructure[]
  /** CT spawn points [x, z]. */
  ctSpawns: [number, number][]
  /** T spawn points [x, z]. */
  tSpawns: [number, number][]
  /** Exactly two bombsites: A and B. */
  bombsites: ZoneBombsite[]
}

/** Daylight lighting shared by the desert/outdoor zones; matches the original arena. */
export const DAYLIGHT: ZoneLighting = {
  ambientColor: 0xb0b8c0,
  ambientIntensity: 0.7,
  sunColor: 0xfff4e0,
  sunIntensity: 1.1,
  sunPosition: [20, 30, 10],
}
```

- [ ] **Step 2: Create `src/zones/buildings.ts`** (identical logic, updated import)

```typescript
// src/zones/buildings.ts
import type { ZoneStructure } from './ZoneDef'

export { wall as doorway }

const WALL_H = 5
const WALL_THICK = 0.5
const DOOR_W = 2.5

// One wall of a building: a solid box, or two segments around a centered door.
// axis 'x' => wall runs along x (a north/south face); 'z' => runs along z.
// Exported as `doorway` for standalone use (lane walls + double-doors in zones).
export function wall(cx: number, cz: number, len: number, axis: 'x' | 'z', door: boolean): ZoneStructure[] {
  const size = (l: number): [number, number, number] =>
    axis === 'x' ? [l, WALL_H, WALL_THICK] : [WALL_THICK, WALL_H, l]
  if (!door) return [{ center: [cx, WALL_H / 2, cz], size: size(len), material: 'wall' }]

  const seg = (len - DOOR_W) / 2
  const off = (len + DOOR_W) / 4
  return axis === 'x'
    ? [
        { center: [cx - off, WALL_H / 2, cz], size: size(seg), material: 'wall' },
        { center: [cx + off, WALL_H / 2, cz], size: size(seg), material: 'wall' },
      ]
    : [
        { center: [cx, WALL_H / 2, cz - off], size: size(seg), material: 'wall' },
        { center: [cx, WALL_H / 2, cz + off], size: size(seg), material: 'wall' },
      ]
}

export function building(
  x: number, z: number,
  width: number, depth: number,
  doorSide: 'north' | 'south' | 'east' | 'west'
): ZoneStructure[] {
  const halfW = width / 2
  const halfD = depth / 2
  return [
    ...wall(x, z - halfD, width, 'x', doorSide === 'north'),
    ...wall(x, z + halfD, width, 'x', doorSide === 'south'),
    ...wall(x + halfW, z, depth, 'z', doorSide === 'east'),
    ...wall(x - halfW, z, depth, 'z', doorSide === 'west'),
  ]
}

export function buildingWithRooms(
  x: number, z: number,
  width: number, depth: number,
  doorSide: 'north' | 'south' | 'east' | 'west'
): ZoneStructure[] {
  return [
    ...building(x, z, width, depth, doorSide),
    { center: [x, WALL_H / 2, z], size: [WALL_THICK, WALL_H, depth - WALL_THICK * 2], material: 'wall' },
  ]
}

export function stairs(
  x: number, z: number,
  steps: number,
  direction: 'north' | 'south' | 'east' | 'west'
): ZoneStructure[] {
  const stepH = 1, stepD = 1, stepW = 3
  const dx = direction === 'east' ? 1 : direction === 'west' ? -1 : 0
  const dz = direction === 'south' ? 1 : direction === 'north' ? -1 : 0
  const size: [number, number, number] = dx !== 0 ? [stepD, stepH, stepW] : [stepW, stepH, stepD]

  return Array.from({ length: steps }, (_, i) => ({
    center: [x + dx * i * stepD, stepH / 2 + i * stepH, z + dz * i * stepD] as [number, number, number],
    size,
    material: 'concrete' as const,
  }))
}
```

- [ ] **Step 3: Create `src/zones/buildings.test.ts`** (updated import only)

```typescript
// src/zones/buildings.test.ts
import { describe, it, expect } from 'vitest'
import { building, buildingWithRooms, stairs } from './buildings'

describe('building helper', () => {
  it('creates a rectangular building with doorway', () => {
    const structures = building(0, 0, 8, 6, 'south')
    expect(structures.length).toBe(5)

    const northWall = structures.find(s => s.center[2] === -3)
    expect(northWall).toBeDefined()
    expect(northWall!.material).toBe('wall')

    const southWalls = structures.filter(s => s.center[2] === 3)
    expect(southWalls.length).toBe(2)
  })

  it('creates building with internal rooms', () => {
    const structures = buildingWithRooms(0, 0, 10, 8, 'south')
    expect(structures.length).toBe(6)

    const innerWall = structures.find(s =>
      s.material === 'wall' &&
      s.center[0] === 0 &&
      s.center[2] === 0
    )
    expect(innerWall).toBeDefined()
    expect(innerWall!.size[2]).toBe(8 - 0.5 * 2)
  })
})

describe('stairs helper', () => {
  it('creates staircase with specified steps', () => {
    const structures = stairs(0, 0, 3, 'north')
    expect(structures.length).toBe(3)

    expect(structures[0].center[1]).toBeLessThan(structures[1].center[1])
    expect(structures[1].center[1]).toBeLessThan(structures[2].center[1])
  })
})
```

- [ ] **Step 4: Run buildings tests**

```bash
npx vitest run src/zones/buildings.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/zones/ZoneDef.ts src/zones/buildings.ts src/zones/buildings.test.ts
git commit -m "feat: scaffold src/zones with ZoneDef types and buildings helpers"
```

---

## Task 2: Create the five zone data files

**Files:**
- Create: `src/zones/arid.ts`, `src/zones/haze.ts`, `src/zones/ember.ts`, `src/zones/reactor.ts`, `src/zones/crossing.ts`
- Create: `src/zones/arid.test.ts`

**Interfaces:**
- Consumes: `ZoneDef`, `ZoneStructure`, `ZoneLighting`, `DAYLIGHT` from `./ZoneDef`; `doorway`, `stairs` from `./buildings`
- Produces: `ARID`, `HAZE`, `EMBER`, `REACTOR`, `CROSSING` — consumed by registry.ts

- [ ] **Step 1: Create `src/zones/arid.ts`** (git mv + edit)

```bash
git mv src/maps/dust2.ts src/zones/arid.ts
```

Then open `src/zones/arid.ts` and apply these exact edits:

Change line 1 from:
```typescript
import type { MapDef, MapStructure } from './MapDef'
```
to:
```typescript
import type { ZoneDef, ZoneStructure } from './ZoneDef'
```

Change line 2 from:
```typescript
import { DAYLIGHT } from './MapDef'
```
to:
```typescript
import { DAYLIGHT } from './ZoneDef'
```

Change line 20 from:
```typescript
type Mat = MapStructure['material']
```
to:
```typescript
type Mat = ZoneStructure['material']
```

Change line 26 from:
```typescript
): MapStructure => ({ center, size, material })
```
to:
```typescript
): ZoneStructure => ({ center, size, material })
```

Change line 28 from:
```typescript
const platform = (cx: number, cz: number, w: number, d: number, h: number, mat: Mat): MapStructure =>
```
to:
```typescript
const platform = (cx: number, cz: number, w: number, d: number, h: number, mat: Mat): ZoneStructure =>
```

Change line 31 from:
```typescript
const ceiling = (cx: number, cz: number, w: number, d: number): MapStructure =>
```
to:
```typescript
const ceiling = (cx: number, cz: number, w: number, d: number): ZoneStructure =>
```

Change line 34 from:
```typescript
const crateStack = (x: number, z: number): MapStructure[] => [
```
to:
```typescript
const crateStack = (x: number, z: number): ZoneStructure[] => [
```

Change line 44 from:
```typescript
const wallX = (x1: number, x2: number, z: number, mat: Mat = 'wall'): MapStructure =>
```
to:
```typescript
const wallX = (x1: number, x2: number, z: number, mat: Mat = 'wall'): ZoneStructure =>
```

Change line 46 from:
```typescript
const wallZ = (x: number, z1: number, z2: number, mat: Mat = 'wall'): MapStructure =>
```
to:
```typescript
const wallZ = (x: number, z1: number, z2: number, mat: Mat = 'wall'): ZoneStructure =>
```

Change lines 49–53 from:
```typescript
export const DUST2: MapDef = {
  id: 'dust2',
  name: 'Dust II',
  description: 'The classic four-lane bomb-defusal map: Mid, A Long, A Short, and B Tunnels.',
  arenaSize: 50,
```
to:
```typescript
export const ARID: ZoneDef = {
  id: 'arid',
  name: 'Arid',
  description: 'Four-lane desert zone: Mid, A Long, A Short, and B Tunnels.',
  arenaSize: 50,
```

Also remove the comment on line 5 that reads:
```typescript
// Faithful Dust2 recreation in the box-geometry MapDef format.
```
Replace with:
```typescript
// Arid — desert zone in box-geometry ZoneDef format.
```

- [ ] **Step 2: Create `src/zones/haze.ts`**

```bash
git mv src/maps/mirage.ts src/zones/haze.ts
```

Edit `src/zones/haze.ts`:

Change line 1 from:
```typescript
import type { MapDef } from './MapDef'
```
to:
```typescript
import type { ZoneDef } from './ZoneDef'
```

Change line 2 from:
```typescript
import { DAYLIGHT } from './MapDef'
```
to:
```typescript
import { DAYLIGHT } from './ZoneDef'
```

Replace the JSDoc comment (lines 4–8) with:
```typescript
/**
 * Haze — sun-bleached urban district. Mid doors decide the round.
 */
```

Change lines 9–13 from:
```typescript
export const MIRAGE: MapDef = {
  id: 'mirage',
  name: 'Mirage',
  description: 'Mid doors decide the round. Palace to A, apartments to B.',
```
to:
```typescript
export const HAZE: ZoneDef = {
  id: 'haze',
  name: 'Haze',
  description: 'Mid doors decide the round. Palace to A, apartments to B.',
```

- [ ] **Step 3: Create `src/zones/ember.ts`**

```bash
git mv src/maps/inferno.ts src/zones/ember.ts
```

Edit `src/zones/ember.ts`:

Change line 1 from:
```typescript
import type { MapDef } from './MapDef'
```
to:
```typescript
import type { ZoneDef } from './ZoneDef'
```

Change line 2 from:
```typescript
import { DAYLIGHT } from './MapDef'
```
to:
```typescript
import { DAYLIGHT } from './ZoneDef'
```

Replace the JSDoc comment (lines 4–8) with:
```typescript
/**
 * Ember — industrial heat zone of tight corridors.
 */
```

Change lines 9–12 from:
```typescript
export const INFERNO: MapDef = {
  id: 'inferno',
  name: 'Inferno',
  description: 'Tight corridors. Hold banana to B, arches to A.',
```
to:
```typescript
export const EMBER: ZoneDef = {
  id: 'ember',
  name: 'Ember',
  description: 'Tight corridors. Hold the flank to B, arches to A.',
```

- [ ] **Step 4: Create `src/zones/reactor.ts`**

```bash
git mv src/maps/nuke.ts src/zones/reactor.ts
```

Edit `src/zones/reactor.ts`:

Change line 1 from:
```typescript
import type { MapDef } from './MapDef'
```
to:
```typescript
import type { ZoneDef } from './ZoneDef'
```

Replace the JSDoc comment (lines 3–8) with:
```typescript
/**
 * Reactor — compact nuclear facility. Raised A platform, B behind the silo.
 */
```

Change lines 9–12 from:
```typescript
export const NUKE: MapDef = {
  id: 'nuke',
  name: 'Nuke',
  description: 'Compact facility. Raised A platform, B behind the silo.',
```
to:
```typescript
export const REACTOR: ZoneDef = {
  id: 'reactor',
  name: 'Reactor',
  description: 'Compact facility. Raised A platform, B behind the silo.',
```

- [ ] **Step 5: Create `src/zones/crossing.ts`**

```bash
git mv src/maps/overpass.ts src/zones/crossing.ts
```

Edit `src/zones/crossing.ts`:

Change line 1 from:
```typescript
import type { MapDef } from './MapDef'
```
to:
```typescript
import type { ZoneDef } from './ZoneDef'
```

Change line 2 from:
```typescript
import { DAYLIGHT } from './MapDef'
```
to:
```typescript
import { DAYLIGHT } from './ZoneDef'
```

Replace the JSDoc comment (lines 4–9) with:
```typescript
/**
 * Crossing — urban bridge sector with strong verticality.
 */
```

Change lines 10–13 from:
```typescript
export const OVERPASS: MapDef = {
  id: 'overpass',
  name: 'Overpass',
  description: 'Verticality and water. Long canal to B, elevated A.',
```
to:
```typescript
export const CROSSING: ZoneDef = {
  id: 'crossing',
  name: 'Crossing',
  description: 'Verticality and water. Long canal to B, elevated A.',
```

- [ ] **Step 6: Create `src/zones/arid.test.ts`**

```bash
git mv src/maps/dust2.test.ts src/zones/arid.test.ts
```

Edit `src/zones/arid.test.ts` — replace the entire file content:

```typescript
import { describe, it, expect } from 'vitest'
import { ARID } from './arid'
import type { ZoneStructure } from './ZoneDef'

function obstructs(s: ZoneStructure, x: number, z: number): boolean {
  const [cx, cy, cz] = s.center
  const [w, h, d] = s.size
  const yMin = cy - h / 2
  const yMax = cy + h / 2
  const tall = yMin < 2 && yMax > 2.5
  const insideXZ = Math.abs(x - cx) < w / 2 && Math.abs(z - cz) < d / 2
  return tall && insideXZ
}

describe('ARID zone', () => {
  const size = ARID.arenaSize

  it('keeps every structure inside the arena bounds', () => {
    for (const s of ARID.structures) {
      for (const axis of [0, 2] as const) {
        const max = Math.abs(s.center[axis]) + s.size[axis] / 2
        expect(max, `structure at ${s.center} exceeds bounds`).toBeLessThanOrEqual(size)
      }
    }
  })

  it('has exactly bombsites A and B inside bounds and clear of walls', () => {
    expect(ARID.bombsites.map((b) => b.id).sort()).toEqual(['A', 'B'])
    for (const b of ARID.bombsites) {
      const [x, z] = b.center
      expect(Math.abs(x)).toBeLessThanOrEqual(size)
      expect(Math.abs(z)).toBeLessThanOrEqual(size)
      const blocker = ARID.structures.find((s) => obstructs(s, x, z))
      expect(blocker, `bombsite ${b.id} is embedded in ${blocker?.material} at ${blocker?.center}`).toBeUndefined()
    }
  })

  it('places all spawns inside bounds and clear of walls', () => {
    const spawns = [...ARID.ctSpawns, ...ARID.tSpawns]
    expect(ARID.ctSpawns.length).toBeGreaterThan(0)
    expect(ARID.tSpawns.length).toBeGreaterThan(0)
    for (const [x, z] of spawns) {
      expect(Math.abs(x)).toBeLessThanOrEqual(size)
      expect(Math.abs(z)).toBeLessThanOrEqual(size)
      const blocker = ARID.structures.find((s) => obstructs(s, x, z))
      expect(blocker, `spawn ${[x, z]} is embedded in ${blocker?.material} at ${blocker?.center}`).toBeUndefined()
    }
  })

  it('separates T spawn (south) from CT spawn (north)', () => {
    const avg = (pts: [number, number][]) => pts.reduce((a, p) => a + p[1], 0) / pts.length
    expect(avg(ARID.tSpawns)).toBeGreaterThan(avg(ARID.ctSpawns))
  })
})
```

- [ ] **Step 7: Run zone data tests**

```bash
npx vitest run src/zones/arid.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/zones/arid.ts src/zones/haze.ts src/zones/ember.ts src/zones/reactor.ts src/zones/crossing.ts src/zones/arid.test.ts
git commit -m "feat: add zone data files — arid, haze, ember, reactor, crossing"
```

---

## Task 3: Create `src/zones/registry.ts` and its test

**Files:**
- Create: `src/zones/registry.ts`
- Create: `src/zones/registry.test.ts`

**Interfaces:**
- Consumes: `ARID`, `HAZE`, `EMBER`, `REACTOR`, `CROSSING` from their respective zone files; `ZoneDef` from `./ZoneDef`
- Produces: `ZONES: ZoneDef[]`, `DEFAULT_ZONE_ID: string`, `getZone(id?: string): ZoneDef` — consumed by session, engine, and UI layers

- [ ] **Step 1: Write the failing test**

```bash
git mv src/maps/registry.test.ts src/zones/registry.test.ts
```

Replace the entire content of `src/zones/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ZONES, DEFAULT_ZONE_ID, getZone } from './registry'

describe('zone registry', () => {
  it('provides the five zones in order', () => {
    expect(ZONES.map((z) => z.id)).toEqual(['arid', 'haze', 'ember', 'reactor', 'crossing'])
  })

  it('defaults to arid', () => {
    expect(DEFAULT_ZONE_ID).toBe('arid')
    expect(getZone().id).toBe('arid')
  })

  it('falls back to the default for unknown or undefined ids', () => {
    expect(getZone('does-not-exist').id).toBe('arid')
    expect(getZone(undefined).id).toBe('arid')
  })

  it('looks up each zone by id', () => {
    for (const z of ZONES) expect(getZone(z.id)).toBe(z)
  })

  describe.each(ZONES)('zone "$id"', (zone) => {
    it('has a name and description', () => {
      expect(zone.name.length).toBeGreaterThan(0)
      expect(zone.description.length).toBeGreaterThan(0)
    })

    it('uses the standard arena size', () => {
      if (zone.id === 'arid') expect(zone.arenaSize).toBe(50)
      else expect(zone.arenaSize).toBe(30)
    })

    it('has at least one spawn per team', () => {
      expect(zone.ctSpawns.length).toBeGreaterThan(0)
      expect(zone.tSpawns.length).toBeGreaterThan(0)
    })

    it('places CT and T spawns on opposite sides', () => {
      const avg = (pts: [number, number][], axis: 0 | 1) =>
        pts.reduce((s, p) => s + p[axis], 0) / pts.length
      const dx = Math.abs(avg(zone.ctSpawns, 0) - avg(zone.tSpawns, 0))
      const dz = Math.abs(avg(zone.ctSpawns, 1) - avg(zone.tSpawns, 1))
      expect(Math.max(dx, dz)).toBeGreaterThan(10)
    })

    it('defines exactly two bombsites: A and B', () => {
      expect(zone.bombsites.map((b) => b.id).sort()).toEqual(['A', 'B'])
    })

    it('keeps spawns and bombsites inside the arena bounds', () => {
      const within = ([x, z]: [number, number]) =>
        Math.abs(x) < zone.arenaSize && Math.abs(z) < zone.arenaSize
      for (const s of [...zone.ctSpawns, ...zone.tSpawns]) expect(within(s)).toBe(true)
      for (const b of zone.bombsites) expect(within(b.center)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/zones/registry.test.ts
```

Expected: FAIL — `Cannot find module './registry'`

- [ ] **Step 3: Create `src/zones/registry.ts`**

```typescript
// src/zones/registry.ts
import type { ZoneDef } from './ZoneDef'
import { ARID } from './arid'
import { HAZE } from './haze'
import { EMBER } from './ember'
import { REACTOR } from './reactor'
import { CROSSING } from './crossing'

/** All selectable zones, in menu order. Arid first (the default). */
export const ZONES: ZoneDef[] = [ARID, HAZE, EMBER, REACTOR, CROSSING]

export const DEFAULT_ZONE_ID = ARID.id

/** Look up a zone by id, falling back to the default (Arid) for unknown/undefined ids. */
export function getZone(id?: string): ZoneDef {
  return ZONES.find((z) => z.id === id) ?? ARID
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/zones/registry.test.ts
```

Expected: all tests PASS (6 root tests + 6 per-zone × 5 zones = 36 total).

- [ ] **Step 5: Commit**

```bash
git add src/zones/registry.ts src/zones/registry.test.ts
git commit -m "feat: add zone registry — ZONES, getZone, DEFAULT_ZONE_ID"
```

---

## Task 4: Update the session layer

**Files:**
- Modify: `src/session/MatchConfig.ts`
- Modify: `src/session/MatchConfig.test.ts`
- Modify: `src/session/GameSession.ts`
- Modify: `src/session/GameSession.map.test.ts`
- Modify: `src/session/Spawns.ts`
- Modify: `src/session/Spawns.test.ts`

**Interfaces:**
- Consumes: `ZoneDef` from `../zones/ZoneDef`; `getZone` from `../zones/registry`
- Produces: `MatchConfig.zoneId` — consumed by App.tsx, MatchSetup.tsx, TeamSelect.tsx

- [ ] **Step 1: Update `src/session/MatchConfig.ts`**

Apply these three edits:

Change line 16 from:
```typescript
  mapId?: string            // selected map id; undefined falls back to the default map (Dust2)
```
to:
```typescript
  zoneId?: string           // selected zone id; undefined falls back to the default zone (Arid)
```

Change line 20 from:
```typescript
  return { mode: 'coop', damagePolicy: 'team', fragLimit: 30, joinPolicy: 'lobby', mapId: 'dust2' }
```
to:
```typescript
  return { mode: 'coop', damagePolicy: 'team', fragLimit: 30, joinPolicy: 'lobby', zoneId: 'arid' }
```

Change line 32 from:
```typescript
    mapId: 'dust2',
```
to:
```typescript
    zoneId: 'arid',
```

- [ ] **Step 2: Update `src/session/MatchConfig.test.ts`**

Change line 21 from:
```typescript
    expect(defaultMatchConfig()).toEqual({ mode: 'coop', damagePolicy: 'team', fragLimit: 30, joinPolicy: 'lobby', mapId: 'dust2' })
```
to:
```typescript
    expect(defaultMatchConfig()).toEqual({ mode: 'coop', damagePolicy: 'team', fragLimit: 30, joinPolicy: 'lobby', zoneId: 'arid' })
```

- [ ] **Step 3: Update `src/session/GameSession.ts`**

Change line 24 from:
```typescript
import type { MapDef } from '../maps/MapDef'
```
to:
```typescript
import type { ZoneDef } from '../zones/ZoneDef'
```

Change line 25 from:
```typescript
import { getMap } from '../maps/registry'
```
to:
```typescript
import { getZone } from '../zones/registry'
```

Find the field declaration `map: MapDef` (around line 63) and change to:
```typescript
  map: ZoneDef
```

Find `this.map = getMap(config.mapId)` (around line 83) and change to:
```typescript
    this.map = getZone(config.zoneId)
```

- [ ] **Step 4: Update `src/session/GameSession.map.test.ts`**

Change line 4 from:
```typescript
import { getMap } from '../maps/registry'
```
to:
```typescript
import { getZone } from '../zones/registry'
```

Change line 11 from:
```typescript
    const session = new GameSession({ ...defaultCompetitiveConfig(), mapId: 'mirage' })
```
to:
```typescript
    const session = new GameSession({ ...defaultCompetitiveConfig(), zoneId: 'haze' })
```

Change line 16 from:
```typescript
    const mirage = getMap('mirage')
```
to:
```typescript
    const haze = getZone('haze')
```

Change line 12 from:
```typescript
    expect(session.map.id).toBe('mirage')
```
to:
```typescript
    expect(session.map.id).toBe('haze')
```

Change line 17 from:
```typescript
    const session = new GameSession({ ...defaultCompetitiveConfig(), mapId: 'mirage' })
```
to:
```typescript
    const session = new GameSession({ ...defaultCompetitiveConfig(), zoneId: 'haze' })
```

Change line 21 from:
```typescript
    const expected = mirage.bombsites
```
to:
```typescript
    const expected = haze.bombsites
```

- [ ] **Step 5: Update `src/session/Spawns.ts`**

Change line 3 from:
```typescript
import type { MapDef } from '../maps/MapDef'
```
to:
```typescript
import type { ZoneDef } from '../zones/ZoneDef'
```

Change line 4 from:
```typescript
import { getMap } from '../maps/registry'
```
to:
```typescript
import { getZone } from '../zones/registry'
```

Change line 9 from:
```typescript
export function pickSpawn(team: Team, map: MapDef = getMap(), index?: number): THREE.Vector3 {
```
to:
```typescript
export function pickSpawn(team: Team, map: ZoneDef = getZone(), index?: number): THREE.Vector3 {
```

- [ ] **Step 6: Update `src/session/Spawns.test.ts`**

Change line 3 from:
```typescript
import { getMap } from '../maps/registry'
```
to:
```typescript
import { getZone } from '../zones/registry'
```

Change line 5 from:
```typescript
const dust2 = getMap('dust2')
```
to:
```typescript
const arid = getZone('arid')
```

Replace all three occurrences of `dust2` (the variable, not the string) with `arid`:
- `pickSpawn('ct', dust2, 0)` → `pickSpawn('ct', arid, 0)`
- `pickSpawn('t', dust2, 0)` → `pickSpawn('t', arid, 0)`
- `pickSpawn('ct', dust2, 1)` → `pickSpawn('ct', arid, 1)`
- `pickSpawn('ct', dust2)` (in the loop) → `pickSpawn('ct', arid)`

Change the last test (line 39) from:
```typescript
    const mirage = getMap('mirage')
    const pos = pickSpawn('ct', mirage, 0)
    expect([pos.x, pos.z]).toEqual([mirage.ctSpawns[0][0], mirage.ctSpawns[0][1]])
```
to:
```typescript
    const haze = getZone('haze')
    const pos = pickSpawn('ct', haze, 0)
    expect([pos.x, pos.z]).toEqual([haze.ctSpawns[0][0], haze.ctSpawns[0][1]])
```

- [ ] **Step 7: Run session tests**

```bash
npx vitest run src/session/MatchConfig.test.ts src/session/GameSession.map.test.ts src/session/Spawns.test.ts
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/session/MatchConfig.ts src/session/MatchConfig.test.ts src/session/GameSession.ts src/session/GameSession.map.test.ts src/session/Spawns.ts src/session/Spawns.test.ts
git commit -m "feat: update session layer to use zones (zoneId, getZone, ZoneDef)"
```

---

## Task 5: Update the engine layer

**Files:**
- Modify: `src/engine/Arena.ts`
- Modify: `src/engine/__tests__/Arena.test.ts`

**Interfaces:**
- Consumes: `ZoneDef`, `StructureMaterial` from `../zones/ZoneDef`; `getZone` from `../zones/registry`

- [ ] **Step 1: Update `src/engine/Arena.ts`**

Change line 3 from:
```typescript
import type { MapDef, StructureMaterial } from '../maps/MapDef'
```
to:
```typescript
import type { ZoneDef, StructureMaterial } from '../zones/ZoneDef'
```

Change line 4 from:
```typescript
import { getMap } from '../maps/registry'
```
to:
```typescript
import { getZone } from '../zones/registry'
```

Find the JSDoc comment referencing `{@link MapDef}` (around line 29) and change to:
```typescript
 * a {@link ZoneDef} into a single named group added to `scene`, and returns its
```

Find the function signature for `createArena` (around line 32):
```typescript
export function createArena(scene: THREE.Scene, map: MapDef = getMap()): CollisionWorld {
```
Change to:
```typescript
export function createArena(scene: THREE.Scene, map: ZoneDef = getZone()): CollisionWorld {
```

Find the function signature for `rebuildArena` (around line 125):
```typescript
export function rebuildArena(scene: THREE.Scene, map: MapDef = getMap()): CollisionWorld {
```
Change to:
```typescript
export function rebuildArena(scene: THREE.Scene, map: ZoneDef = getZone()): CollisionWorld {
```

- [ ] **Step 2: Update `src/engine/__tests__/Arena.test.ts`**

Change line 4 from:
```typescript
import { getMap, MAPS } from '../../maps/registry'
```
to:
```typescript
import { getZone, ZONES } from '../../zones/registry'
```

Find the loop `for (const map of MAPS)` (around line 42) and change to:
```typescript
    for (const map of ZONES) {
```

Find the calls to `getMap` (around lines 54–55):
```typescript
    createArena(scene, getMap('dust2'))
    rebuildArena(scene, getMap('mirage'))
```
Change to:
```typescript
    createArena(scene, getZone('arid'))
    rebuildArena(scene, getZone('haze'))
```

- [ ] **Step 3: Run engine tests**

```bash
npx vitest run src/engine/__tests__/Arena.test.ts
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/Arena.ts src/engine/__tests__/Arena.test.ts
git commit -m "feat: update Arena to use ZoneDef and getZone"
```

---

## Task 6: Update the UI and App layer

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/ui/MatchSetup.tsx`
- Modify: `src/ui/TeamSelect.tsx`
- Modify: `src/ui/__tests__/TeamSelect.test.tsx`

**Interfaces:**
- Consumes: `ZONES`, `DEFAULT_ZONE_ID`, `getZone` from `./zones/registry` (App) or `../zones/registry` (ui)
- Produces: `MatchConfig.zoneId` flow through UI — `zoneId` selected in menus, passed to `onConfirm`/`onSelect`

- [ ] **Step 1: Update `src/App.tsx`**

Change line 5 from:
```typescript
import { getMap } from './maps/registry'
```
to:
```typescript
import { getZone } from './zones/registry'
```

Replace all occurrences of `getMap(` with `getZone(` (there are 6 call sites, all in the form `getMap(data.matchConfig.mapId)` or `getMap(config.mapId)`):

- `getMap(data.matchConfig.mapId)` → `getZone(data.matchConfig.zoneId)` (3 occurrences)
- `getMap(config.mapId)` → `getZone(config.zoneId)` (1 occurrence)
- `getMap(data.session.config.mapId)` → `getZone(data.session.config.zoneId)` (1 occurrence)

Also find around line 1372–1374:
```typescript
        <TeamSelect onBack={() => updateGameState('menu')} onSelect={(t, mapId) => {
          ...
          gameDataRef.current.matchConfig = { ...gameDataRef.current.matchConfig, mapId }
```
Change to:
```typescript
        <TeamSelect onBack={() => updateGameState('menu')} onSelect={(t, zoneId) => {
          ...
          gameDataRef.current.matchConfig = { ...gameDataRef.current.matchConfig, zoneId }
```

- [ ] **Step 2: Update `src/ui/MatchSetup.tsx`**

Change line 5 from:
```typescript
import { MAPS, DEFAULT_MAP_ID } from '../maps/registry'
```
to:
```typescript
import { ZONES, DEFAULT_ZONE_ID } from '../zones/registry'
```

Change line 33 from:
```typescript
  const [mapId, setMapId] = useState<string>(DEFAULT_MAP_ID)
```
to:
```typescript
  const [zoneId, setZoneId] = useState<string>(DEFAULT_ZONE_ID)
```

Change line 50 from:
```typescript
      <div><div style={{ opacity: 0.6, marginBottom: 6 }}>MAP</div>
```
to:
```typescript
      <div><div style={{ opacity: 0.6, marginBottom: 6 }}>ZONE</div>
```

Change line 52 from:
```typescript
          {MAPS.map(m => {
            const active = mapId === m.id
```
to:
```typescript
          {ZONES.map(m => {
            const active = zoneId === m.id
```

Find `onClick={() => setMapId(m.id)}` and change to:
```typescript
onClick={() => setZoneId(m.id)}
```

Find line 109 where `mapId` is spread into the config:
```typescript
          mapId,
```
Change to:
```typescript
          zoneId,
```

- [ ] **Step 3: Update `src/ui/TeamSelect.tsx`**

Change line 3 from:
```typescript
import { MAPS, DEFAULT_MAP_ID } from '../maps/registry'
```
to:
```typescript
import { ZONES, DEFAULT_ZONE_ID } from '../zones/registry'
```

Change the `onSelect` prop type (line 7) from:
```typescript
  onSelect: (team: Team, mapId: string) => void
```
to:
```typescript
  onSelect: (team: Team, zoneId: string) => void
```

Change line 14 from:
```typescript
  const [mapId, setMapId] = useState<string>(DEFAULT_MAP_ID)
```
to:
```typescript
  const [zoneId, setZoneId] = useState<string>(DEFAULT_ZONE_ID)
```

Change line 18 from:
```typescript
      onClick={() => onSelect(team, mapId)}
```
to:
```typescript
      onClick={() => onSelect(team, zoneId)}
```

Change line 39 (the heading) from:
```typescript
      <h2 style={{ margin: 0 }}>CHOOSE YOUR MAP</h2>
```
to:
```typescript
      <h2 style={{ margin: 0 }}>CHOOSE YOUR ZONE</h2>
```

Change line 41 from:
```typescript
        {MAPS.map((m) => {
          const active = mapId === m.id
```
to:
```typescript
        {ZONES.map((m) => {
          const active = zoneId === m.id
```

Find `onClick={() => setMapId(m.id)}` and change to:
```typescript
onClick={() => setZoneId(m.id)}
```

- [ ] **Step 4: Update `src/ui/__tests__/TeamSelect.test.tsx`**

Change line 4 from:
```typescript
import { DEFAULT_MAP_ID, MAPS } from '../../maps/registry'
```
to:
```typescript
import { DEFAULT_ZONE_ID, ZONES } from '../../zones/registry'
```

Change line 11 from:
```typescript
    expect(onSelect).toHaveBeenCalledWith('ct', DEFAULT_MAP_ID)
```
to:
```typescript
    expect(onSelect).toHaveBeenCalledWith('ct', DEFAULT_ZONE_ID)
```

Change line 13 from:
```typescript
    expect(onSelect).toHaveBeenCalledWith('t', DEFAULT_MAP_ID)
```
to:
```typescript
    expect(onSelect).toHaveBeenCalledWith('t', DEFAULT_ZONE_ID)
```

Change line 19 from:
```typescript
    const mirage = MAPS.find((m) => m.id === 'mirage')!
```
to:
```typescript
    const haze = ZONES.find((z) => z.id === 'haze')!
```

Update the assertion on the next line to use `haze` instead of `mirage`.

Change line 27 from:
```typescript
    for (const m of MAPS) expect(screen.getByText(m.name)).toBeTruthy()
```
to:
```typescript
    for (const z of ZONES) expect(screen.getByText(z.name)).toBeTruthy()
```

- [ ] **Step 5: Run UI tests**

```bash
npx vitest run src/ui/__tests__/TeamSelect.test.tsx src/ui/__tests__/MatchSetup.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/ui/MatchSetup.tsx src/ui/TeamSelect.tsx src/ui/__tests__/TeamSelect.test.tsx
git commit -m "feat: update UI layer to use zones — CHOOSE YOUR ZONE, zoneId, ZONES"
```

---

## Task 7: Delete `src/maps/` and verify

**Files:**
- Delete: `src/maps/` (entire folder — all files were git-mv'd in Tasks 1–3, so git already tracks them as deleted)

- [ ] **Step 1: Confirm `src/maps/` only has deleted/moved files**

```bash
git status src/maps/
```

Expected: the only remaining file should be `src/maps/MapDef.ts` (if it wasn't git-mv'd yet, delete it now). All other files were moved via `git mv` in Tasks 1–3.

If `src/maps/MapDef.ts` still exists:
```bash
git rm src/maps/MapDef.ts
```

- [ ] **Step 2: Remove the folder**

```bash
git rm -r src/maps/ 2>/dev/null || true
rmdir src/maps/ 2>/dev/null || true
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS. No references to `src/maps/` remain in any test output.

If any test fails with a `Cannot find module '../maps/...'` error, find the file that still imports from `../maps/` and update it to the corresponding `../zones/` path.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: delete src/maps/ — zone rename complete"
```
