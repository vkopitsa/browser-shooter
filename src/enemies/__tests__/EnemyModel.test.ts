import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildSoldier } from '../EnemyModel'

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
})
