import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GameSession } from '../GameSession'
import { emptyInput } from '../protocol'

describe('GameSession players map', () => {
  it('seeds exactly the local player', () => {
    const s = new GameSession()
    expect(s.playerIds()).toEqual([s.localId])
  })

  it('player/weaponManager getters point at the local entity', () => {
    const s = new GameSession()
    expect(s.player).toBe(s.getPlayer(s.localId)!.player)
    expect(s.weaponManager).toBe(s.getPlayer(s.localId)!.weapons)
  })

  it('keeps the local/host player at origin but disperses joining players', () => {
    const s = new GameSession()
    const host = s.getPlayer(s.localId)!.player.position
    expect(Math.hypot(host.x, host.z)).toBeCloseTo(0)

    s.addPlayer('player-2', 'Bob')
    s.addPlayer('player-3', 'Cara')
    const p2 = s.getPlayer('player-2')!.player.position
    const p3 = s.getPlayer('player-3')!.player.position

    expect(Math.hypot(p2.x, p2.z)).toBeGreaterThan(5) // off-center
    expect(Math.hypot(p3.x, p3.z)).toBeGreaterThan(5)
    expect(p2.distanceTo(p3)).toBeGreaterThan(1)       // not stacked on each other
  })
})

describe('GameSession multi-player movement', () => {
  it('moves a second player independently of the local player', () => {
    const s = new GameSession()
    s.addPlayer('player-2', 'Bob')
    const before = s.getPlayer('player-2')!.player.position.z

    // player-2 holds forward; local player holds nothing.
    s.applyInput('player-2', { ...emptyInput(), forward: true })
    s.step(0.1)

    const after = s.getPlayer('player-2')!.player.position.z
    expect(after).toBeLessThan(before)            // moved along -Z (forward)
    expect(s.player.position.x).toBeCloseTo(0)    // local player did not move on x
  })
})

describe('GameSession multi-player snapshot + targeting', () => {
  it('snapshot lists every player with pitch, weapon and name', () => {
    const s = new GameSession()
    s.addPlayer('player-2', 'Bob')
    s.applyInput('player-2', { ...emptyInput(), yaw: 1, pitch: 0.3 })
    s.step(0.016)

    const snap = s.getSnapshot()
    const ids = snap.players.map(p => p.id).sort()
    expect(ids).toEqual([s.localId, 'player-2'])
    const bob = snap.players.find(p => p.id === 'player-2')!
    expect(bob.name).toBe('Bob')
    expect(bob.weaponType).toBe(s.getPlayer('player-2')!.weapons.current.type)
    expect(bob.rotationX).toBeCloseTo(0.3, 5)
  })

  it('nearestPlayer returns the closest living player to a point', () => {
    const s = new GameSession()
    s.addPlayer('player-2', 'Bob')
    s.getPlayer('player-2')!.player.position.set(10, 2, 0)
    const near = s.nearestPlayer(new THREE.Vector3(9, 2, 0))
    expect(near?.id).toBe('player-2')
  })
})
