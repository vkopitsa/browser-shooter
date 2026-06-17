// src/session/GameSession.pvp.test.ts
import { describe, it, expect } from 'vitest'
import { GameSession } from './GameSession'
import * as THREE from 'three'

function aimAt(shooter: { player: { position: THREE.Vector3; rotation: THREE.Euler } }, target: THREE.Vector3) {
  const from = shooter.player.position
  const dx = target.x - from.x
  const dz = target.z - from.z
  shooter.player.rotation.y = Math.atan2(dx, -dz) // yaw so -Z forward points at target
  shooter.player.rotation.x = 0
}

function emptyInputForShoot() {
  return { forward: false, backward: false, left: false, right: false, jump: false, shoot: true, yaw: 0, pitch: 0, seq: 0, renderTime: 0 }
}

describe('GameSession PvP damage', () => {
  function twoPlayers(config: any) {
    const s = new GameSession(config)
    const a = s.getPlayer(s.localId)!
    a.team = 'ct'
    a.player.position.set(0, 2, 0)
    const b = s.addPlayer('b', 'Bob', 't')
    b.player.position.set(0, 2, -8)
    aimAt(a, b.player.position)
    return { s, a, b }
  }

  it('opposite-team shot damages the target', () => {
    const { s, a, b } = twoPlayers({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    s.applyInput(a.id, { ...emptyInputForShoot(), yaw: a.player.rotation.y })
    s.step(1 / 30)
    expect(b.player.health).toBeLessThan(100)
  })

  it('same-team shot does no damage under team policy', () => {
    const { s, a, b } = twoPlayers({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    b.team = 'ct' // same team as a
    s.applyInput(a.id, { ...emptyInputForShoot(), yaw: a.player.rotation.y })
    s.step(1 / 30)
    expect(b.player.health).toBe(100)
  })

  it('same-team shot damages under friendly policy', () => {
    const { s, a, b } = twoPlayers({ mode: 'pvp', damagePolicy: 'friendly', fragLimit: 0 })
    b.team = 'ct'
    s.applyInput(a.id, { ...emptyInputForShoot(), yaw: a.player.rotation.y })
    s.step(1 / 30)
    expect(b.player.health).toBeLessThan(100)
  })

  it('coop mode never applies PvP damage', () => {
    const { s, a, b } = twoPlayers({ mode: 'coop', damagePolicy: 'team', fragLimit: 0 })
    s.applyInput(a.id, { ...emptyInputForShoot(), yaw: a.player.rotation.y })
    s.step(1 / 30)
    expect(b.player.health).toBe(100)
  })
})

describe('GameSession team + scores in snapshot', () => {
  it('defaults to coop config and tags the local player with a team', () => {
    const s = new GameSession()
    const snap = s.getSnapshot()
    expect(snap.players[0].team).toBe('ct')
    expect(snap.scores).toEqual({ teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null })
  })

  it('addPlayer stores the chosen team', () => {
    const s = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    s.addPlayer('p2', 'Bob', 't')
    const snap = s.getSnapshot()
    expect(snap.players.find(p => p.id === 'p2')!.team).toBe('t')
  })
})
