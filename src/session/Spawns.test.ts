import { describe, it, expect } from 'vitest'
import { pickSpawn } from './Spawns'
import { getMap } from '../maps/registry'

const dust2 = getMap('dust2')

describe('pickSpawn', () => {
  it('returns distinct spawn regions per team at eye height', () => {
    const ct = pickSpawn('ct', dust2, 0)
    const t = pickSpawn('t', dust2, 0)
    expect(ct.y).toBe(2)
    expect(t.y).toBe(2)
    // teams spawn on opposite sides
    expect(Math.sign(ct.x)).not.toBe(Math.sign(t.x))
  })

  it('cycles through a team\'s spawn list by index', () => {
    const a = pickSpawn('ct', dust2, 0)
    const b = pickSpawn('ct', dust2, 1)
    expect(a.equals(b)).toBe(false)
  })

  it('picks a random spawn when no index is provided', () => {
    const spawns = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const pos = pickSpawn('ct', dust2)
      spawns.add(`${pos.x},${pos.z}`)
    }
    // With 4 spawn points and 20 tries, we should get at least 2 distinct positions
    expect(spawns.size).toBeGreaterThanOrEqual(2)
  })

  it('defaults to the default map when none is given', () => {
    const pos = pickSpawn('ct', undefined, 0)
    expect(pos.y).toBe(2)
  })

  it('honors each map\'s own spawn points', () => {
    const mirage = getMap('mirage')
    const pos = pickSpawn('ct', mirage, 0)
    expect([pos.x, pos.z]).toEqual([mirage.ctSpawns[0][0], mirage.ctSpawns[0][1]])
  })
})
