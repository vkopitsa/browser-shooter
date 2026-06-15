import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { GameSession } from '../GameSession'
import { Enemy } from '../../enemies/Enemy'
import { emptyInput } from '../protocol'

function placeEnemyInFront(s: GameSession, atZone: 'head' | 'body') {
  // Player sits at (0,2,0) facing -Z. Put an enemy ahead on -Z.
  const enemy = new Enemy('grunt', new THREE.Vector3(0, 0, -5))
  s.enemies.push(enemy)
  const targetY = atZone === 'head' ? 1.85 : 1.3
  const dir = new THREE.Vector3(0, targetY - 2, -5).normalize()
  s.player.rotation.y = Math.atan2(dir.x, -dir.z)
  s.player.rotation.x = Math.asin(dir.y)
  return enemy
}

describe('GameSession hit zones', () => {
  // Neutralize weapon spread so the pellet flies dead straight (deterministic zone hits).
  beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(0.5) })
  afterEach(() => { vi.restoreAllMocks() })

  // Read damage from the emitted event (NOT health delta) so the enemy's HP cap
  // can't clamp a one-shot headshot and hide the 4x multiplier.
  function fireDamage(zone: 'head' | 'body'): number {
    const s = new GameSession()
    placeEnemyInFront(s, zone)
    s.applyInput('local', { ...emptyInput(), yaw: s.player.rotation.y, pitch: s.player.rotation.x, shoot: true })
    const events = s.step(0.016)
    const hit = events.find((e) => e.type === 'playerHitEnemy') as any
    return hit ? hit.hit.damage : 0
  }

  it('a headshot deals 4x the body damage', () => {
    const head = fireDamage('head')
    const body = fireDamage('body')
    expect(body).toBeGreaterThan(0)
    expect(head).toBeCloseTo(body * 4, 5)
  })

  it('emits a playerHitEnemy event with the resolved zone', () => {
    const s = new GameSession()
    placeEnemyInFront(s, 'head')
    s.applyInput('local', { ...emptyInput(), yaw: s.player.rotation.y, pitch: s.player.rotation.x, shoot: true })
    const events = s.step(0.016)
    const hit = events.find((e) => e.type === 'playerHitEnemy')
    expect(hit).toBeTruthy()
    expect((hit as any).hit.zone).toBe('head')
  })
})
