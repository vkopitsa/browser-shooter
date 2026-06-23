import { describe, it, expect } from 'vitest'
import { DUST2 } from './dust2'
import type { MapStructure } from './MapDef'

// A structure "obstructs" a ground point if that point falls inside its XZ
// footprint AND it rises from near the floor through standing height — i.e. a
// wall or tall obstacle. Low platforms (top ≤ ~2) you stand on don't count.
function obstructs(s: MapStructure, x: number, z: number): boolean {
  const [cx, cy, cz] = s.center
  const [w, h, d] = s.size
  const yMin = cy - h / 2
  const yMax = cy + h / 2
  const tall = yMin < 2 && yMax > 2.5
  const insideXZ = Math.abs(x - cx) < w / 2 && Math.abs(z - cz) < d / 2
  return tall && insideXZ
}

describe('DUST2 map', () => {
  const size = DUST2.arenaSize

  it('keeps every structure inside the arena bounds', () => {
    for (const s of DUST2.structures) {
      for (const axis of [0, 2] as const) {
        const max = Math.abs(s.center[axis]) + s.size[axis] / 2
        expect(max, `structure at ${s.center} exceeds bounds`).toBeLessThanOrEqual(size)
      }
    }
  })

  it('has exactly bombsites A and B inside bounds and clear of walls', () => {
    expect(DUST2.bombsites.map((b) => b.id).sort()).toEqual(['A', 'B'])
    for (const b of DUST2.bombsites) {
      const [x, z] = b.center
      expect(Math.abs(x)).toBeLessThanOrEqual(size)
      expect(Math.abs(z)).toBeLessThanOrEqual(size)
      const blocker = DUST2.structures.find((s) => obstructs(s, x, z))
      expect(blocker, `bombsite ${b.id} is embedded in ${blocker?.material} at ${blocker?.center}`).toBeUndefined()
    }
  })

  it('places all spawns inside bounds and clear of walls', () => {
    const spawns = [...DUST2.ctSpawns, ...DUST2.tSpawns]
    expect(DUST2.ctSpawns.length).toBeGreaterThan(0)
    expect(DUST2.tSpawns.length).toBeGreaterThan(0)
    for (const [x, z] of spawns) {
      expect(Math.abs(x)).toBeLessThanOrEqual(size)
      expect(Math.abs(z)).toBeLessThanOrEqual(size)
      const blocker = DUST2.structures.find((s) => obstructs(s, x, z))
      expect(blocker, `spawn ${[x, z]} is embedded in ${blocker?.material} at ${blocker?.center}`).toBeUndefined()
    }
  })

  it('separates T spawn (south) from CT spawn (north)', () => {
    const avg = (pts: [number, number][]) => pts.reduce((a, p) => a + p[1], 0) / pts.length
    expect(avg(DUST2.tSpawns)).toBeGreaterThan(avg(DUST2.ctSpawns))
  })
})
