import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { RemotePlayer } from '../RemotePlayer'
import { RemotePlayerManager } from '../RemotePlayerManager'
import type { EntityState } from '../../session/protocol'

function state(id: string, x: number): EntityState {
  return { id, kind: 'player', type: 'player', position: { x, y: 0, z: 0 }, rotationY: 0, health: 100, isDead: false, name: id }
}

describe('RemotePlayer', () => {
  it('interpolates toward the latest target position', () => {
    const rp = new RemotePlayer('player-2', 'Bob')
    rp.pushState(state('player-2', 0))
    rp.pushState(state('player-2', 10))
    rp.update(1) // big dt → converges most of the way
    expect(rp.group.position.x).toBeGreaterThan(0)
    expect(rp.group.position.x).toBeLessThanOrEqual(10)
  })
})

describe('RemotePlayerManager', () => {
  it('adds, updates and removes remote players, excluding the local id', () => {
    const scene = new THREE.Scene()
    const mgr = new RemotePlayerManager(scene, 'player-1')

    mgr.sync([state('player-1', 0), state('player-2', 5)])
    expect(mgr.ids()).toEqual(['player-2']) // local excluded

    mgr.sync([state('player-2', 5), state('player-3', 7)])
    expect(mgr.ids().sort()).toEqual(['player-2', 'player-3'])

    mgr.sync([state('player-3', 7)])
    expect(mgr.ids()).toEqual(['player-3'])
  })
})
