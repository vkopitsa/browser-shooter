import type { MapDef, MapStructure } from './MapDef'
import { DAYLIGHT } from './MapDef'
import { doorway, stairs } from './buildings'

// Faithful Dust2 layout in the box-geometry MapDef format.
// Radar orientation: +x = east (A side), -x = west (B side),
// +z = south (T spawn), -z = north (CT side). Mid runs vertically through x≈2.
// All structures stay within ±48 so they sit inside the auto perimeter (±50).

type Mat = MapStructure['material']

const box = (center: [number, number, number], size: [number, number, number], material: Mat): MapStructure =>
  ({ center, size, material })

// Flat-topped platform sitting on the floor, top surface at height `h`.
const platform = (cx: number, cz: number, w: number, d: number, h: number, material: Mat): MapStructure =>
  box([cx, h / 2, cz], [w, h, d], material)

// Two side-by-side crates with one stacked on top — a climbable step.
const crateStack = (x: number, z: number): MapStructure[] => [
  box([x, 1, z], [2, 2, 2], 'crate'),
  box([x + 2, 1, z], [2, 2, 2], 'crate'),
  box([x + 1, 2.6, z], [2, 1.4, 2], 'crate'),
]

export const DUST2: MapDef = {
  id: 'dust2',
  name: 'Dust II',
  description: 'The classic four-lane bomb-defusal map: Mid, A Long, A Short, and B Tunnels.',
  arenaSize: 50,
  floorColor: 0xc2a878,
  lighting: DAYLIGHT,
  structures: [
    // ===== T SPAWN (south) — open courtyard with three exits =====
    ...crateStack(16, 44), // east cover (toward Long)
    ...crateStack(-18, 44), // west cover (toward Tunnels)
    box([4, 1, 40], [4, 2, 1], 'wood'), // central crate facing Mid

    // ===== MID (central spine, x≈2) =====
    // West wall of Mid (separates Mid from Tunnels/B); gap near z+2 = Lower Tunnel exit.
    ...doorway(-8, 18, 32, 'z', false), // z +34 → +2
    // East wall of Mid (separates Mid from A Short approach), under the catwalk; z +34 → 0.
    ...doorway(12, 17, 34, 'z', false),
    // Mid Doors — double doors with the famous T↔CT sightline through the gap.
    ...doorway(2, -4, 20, 'x', true),
    // Xbox — crate in front of Mid Doors; jump up to reach Catwalk.
    box([6, 1, -1], [2, 2, 2], 'crate'),
    // Suicide / Top Mid — short incline dropping from T into the Mid corridor.
    ...stairs(4, 32, 3, 'north'),

    // ===== A LONG (east corridor, x 30→48) =====
    // Long divider wall: Long vs. Catwalk/Mid; runs z +38 → -8, opens into A site at the top.
    ...doorway(29, 15, 46, 'z', false),
    // Long Doors — two sequential double-door sets bottlenecking T into Long.
    ...doorway(39, 34, 18, 'x', true),
    ...doorway(39, 30, 18, 'x', true),
    // A Car — burnt-out sedan on the ramp side of Long.
    box([36, 1, 4], [3, 2, 5], 'metal'),
    // The Pit — sniper nook at the far (north) end of Long.
    // ponytail: flat floor can't recess below y=0, so the pit is a waist-high 3-sided box.
    box([47, 0.6, -2], [0.5, 1.2, 9], 'concrete'),
    box([44, 0.6, -6], [6, 1.2, 0.5], 'concrete'),
    box([44, 0.6, 2], [6, 1.2, 0.5], 'concrete'),
    // A Ramp — slope from Long up onto the A platform.
    ...stairs(34, -17, 2, 'north'),

    // ===== A SITE (north-east) =====
    // Default-plant platform set back toward the rear wall; the plant spot
    // (bombsite A) stays on open ground just in front of it.
    platform(34, -22, 12, 6, 2, 'concrete'),
    // Back wall of the platform.
    ...doorway(34, -25, 16, 'x', false),
    // Goose — recessed alcove in the back-right corner (two short walls form the nook).
    box([40, 2.5, -22], [0.5, 5, 5], 'wall'),
    box([44, 2.5, -22], [0.5, 5, 5], 'wall'),
    // Site crates flanking the platform.
    ...crateStack(28, -22),
    box([40, 3, -14], [2, 2, 2], 'crate'),

    // ===== A SHORT / CATWALK (Mid → A, over CT) =====
    // Narrow elevated ledge snaking from Top Mid up the right wall toward A.
    platform(16, 4, 4, 22, 2.2, 'metal'),
    // Stairs up onto the Catwalk from the Mid floor.
    ...stairs(16, 16, 2, 'north'),
    // Short — straight walkway overlooking CT before opening into A.
    platform(20, -10, 5, 8, 2.2, 'concrete'),

    // ===== CT SPAWN (north-center, under A Short / behind Mid Doors) =====
    ...doorway(-4, -36, 28, 'x', false), // back wall (x -18 → +10)
    box([-12, 1, -30], [3, 2, 3], 'concrete'), // cover
    box([6, 1, -32], [3, 2, 3], 'concrete'),

    // ===== B TUNNELS (west, x -40 → -24) =====
    // Inner tunnel wall separating Tunnels from Mid/B-approach; z +40 → -8.
    ...doorway(-24, 16, 48, 'z', false),
    // Upper Tunnel — entry corridor from outside T spawn.
    ...doorway(-32, 38, 16, 'x', true), // mouth at T end
    // Lower Tunnel — branch down stairs that opens into Mid near Xbox.
    ...stairs(-20, 6, 3, 'east'),

    // ===== B SITE (north-west courtyard) =====
    ...doorway(-34, -28, 16, 'x', false), // north wall
    ...doorway(-44, -20, 16, 'z', false), // west wall
    ...doorway(-30, -13, 14, 'x', true), // B Doors — facing Mid/CT
    // The Window — hole blown in the east wall next to the doors.
    // ponytail: a window is a wall with a gap, so it's a low + high segment, open in the middle.
    box([-26, 1, -22], [0.5, 2, 12], 'wall'), // sill (low)
    box([-26, 4.5, -22], [0.5, 1, 12], 'wall'), // lintel (high)
    // Humvee / Car — parked just outside B doors in Lower Mid / Hole.
    box([-22, 1.2, -8], [3, 2.4, 6], 'metal'),
    // Site crates.
    ...crateStack(-40, -24),
    box([-30, 1, -24], [2, 2, 2], 'crate'),
  ],

  // Spawns clustered in their courtyards, clear of geometry.
  tSpawns: [[-2, 44], [8, 45], [12, 42], [-10, 45]],
  ctSpawns: [[-2, -32], [4, -33], [-8, -32], [8, -31]],

  bombsites: [
    { id: 'A', center: [34, -18] }, // on the A platform
    { id: 'B', center: [-34, -20] }, // B courtyard
  ],
}
