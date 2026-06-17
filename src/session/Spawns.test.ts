import { describe, it, expect } from 'vitest'
import { pickSpawn } from './Spawns'

describe('pickSpawn', () => {
  it('returns distinct spawn regions per team at eye height', () => {
    const ct = pickSpawn('ct', 0)
    const t = pickSpawn('t', 0)
    expect(ct.y).toBe(2)
    expect(t.y).toBe(2)
    // teams spawn on opposite sides
    expect(Math.sign(ct.x)).not.toBe(Math.sign(t.x))
  })

  it('cycles through a team\'s spawn list by index', () => {
    const a = pickSpawn('ct', 0)
    const b = pickSpawn('ct', 1)
    expect(a.equals(b)).toBe(false)
  })

  it('picks a random spawn when no index is provided', () => {
    const spawns = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const pos = pickSpawn('ct')
      spawns.add(`${pos.x},${pos.z}`)
    }
    // With 4 spawn points and 20 tries, we should get at least 2 distinct positions
    expect(spawns.size).toBeGreaterThanOrEqual(2)
  })
})
