import type { MapDef, MapStructure } from './MapDef'
import { DAYLIGHT } from './MapDef'

// Crate stack helper: two side-by-side boxes with a smaller box on top.
function crateStack(x: number, z: number): MapStructure[] {
  return [
    { center: [x, 1, z], size: [2, 2, 2], material: 'crate' },
    { center: [x + 2, 1, z], size: [2, 2, 2], material: 'crate' },
    { center: [x + 1, 2.6, z], size: [2, 1.4, 2], material: 'crate' },
  ]
}

/**
 * Dust2 — the iconic open desert map and the engine's default. This preserves
 * the original hardcoded arena: a central mid block, two long sight-line walls,
 * scattered crate cover, and waist-high sandbags. Long A to the south, tunnels
 * to B in the north.
 */
export const DUST2: MapDef = {
  id: 'dust2',
  name: 'Dust II',
  description: 'Open desert classic. Long A, tunnels to B, fight for mid.',
  arenaSize: 30,
  floorColor: 0xc2a878,
  lighting: DAYLIGHT,
  structures: [
    // Central hard-cover block (mid)
    { center: [0, 1.5, 0], size: [6, 3, 6], material: 'concrete' },
    // Long sight-line walls
    { center: [-14, 2, -8], size: [1, 4, 14], material: 'concrete' },
    { center: [14, 2, 8], size: [1, 4, 14], material: 'concrete' },
    // Crate cover
    ...crateStack(-10, 10),
    ...crateStack(12, -12),
    ...crateStack(8, 14),
    ...crateStack(-16, -14),
    ...crateStack(18, 0),
    ...crateStack(-6, -18),
    // Low sandbag-style cover
    { center: [6, 0.6, -6], size: [6, 1.2, 0.8], material: 'concrete' },
    { center: [-8, 0.6, 6], size: [6, 1.2, 0.8], material: 'concrete' },
  ],
  ctSpawns: [[-20, -20], [-24, -16], [-16, -24], [-20, -12]],
  tSpawns: [[20, 20], [24, 16], [16, 24], [20, 12]],
  bombsites: [
    { id: 'A', center: [0, -25] },
    { id: 'B', center: [0, 25] },
  ],
}
