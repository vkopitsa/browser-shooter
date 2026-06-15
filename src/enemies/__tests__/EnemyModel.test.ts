import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildSoldier } from '../EnemyModel'
import { resolveZone } from '../../systems/DamageZones'

describe('buildSoldier', () => {
  it('returns a Group with body parts', () => {
    const soldier = buildSoldier('grunt')
    expect(soldier).toBeInstanceOf(THREE.Group)
    expect(soldier.children.length).toBeGreaterThan(4)
  })

  it('scales the tank larger than the runner', () => {
    const tank = buildSoldier('tank')
    const runner = buildSoldier('runner')
    expect(tank.scale.x).toBeGreaterThan(runner.scale.x)
  })

  it('tags a head, body and legs zone', () => {
    const group = buildSoldier('grunt')
    const zones = new Set<string>()
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) zones.add(resolveZone(o))
    })
    expect(zones.has('head')).toBe(true)
    expect(zones.has('body')).toBe(true)
    expect(zones.has('legs')).toBe(true)
  })
})
