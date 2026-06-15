import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  createDamageIndicatorState,
  triggerDamage,
  updateDamageIndicator,
} from '../DamageIndicator'

describe('DamageIndicator', () => {
  it('creates initial state', () => {
    const state = createDamageIndicatorState()
    expect(state.flashOpacity).toBe(0)
    expect(state.directionalAngle).toBeNull()
    expect(state.active).toBe(false)
  })

  it('triggers damage with flash and direction', () => {
    const state = createDamageIndicatorState()
    const playerPos = new THREE.Vector3(0, 2, 0)
    const enemyPos = new THREE.Vector3(5, 2, 0) // to the right

    const triggered = triggerDamage(enemyPos, playerPos, 0)
    expect(triggered.flashOpacity).toBeGreaterThan(0)
    expect(triggered.directionalAngle).not.toBeNull()
    expect(triggered.active).toBe(true)
  })

  it('fades out over time', () => {
    const state = triggerDamage(
      new THREE.Vector3(5, 2, 0),
      new THREE.Vector3(0, 2, 0),
      0
    )

    const updated = updateDamageIndicator(state, 0.1)
    expect(updated.flashOpacity).toBeLessThan(state.flashOpacity)
  })

  it('becomes inactive when fully faded', () => {
    const state = triggerDamage(
      new THREE.Vector3(5, 2, 0),
      new THREE.Vector3(0, 2, 0),
      0,
      0.1 // low intensity
    )

    let current = state
    for (let i = 0; i < 20; i++) {
      current = updateDamageIndicator(current, 0.1)
    }
    expect(current.active).toBe(false)
    expect(current.flashOpacity).toBe(0)
    expect(current.directionalAngle).toBeNull()
  })

  it('indicates direction from behind', () => {
    const playerPos = new THREE.Vector3(0, 2, 0)
    const enemyBehind = new THREE.Vector3(0, 2, 5) // behind player

    const triggered = triggerDamage(enemyBehind, playerPos, 0)
    expect(triggered.active).toBe(true)
    // Behind should produce angle near PI
    expect(Math.abs(triggered.directionalAngle!)).toBeGreaterThan(1)
  })

  it('updates non-active state cleanly', () => {
    const state = createDamageIndicatorState()
    const result = updateDamageIndicator(state, 0.1)
    expect(result.active).toBe(false)
  })
})
