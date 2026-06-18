import { describe, it, expect } from 'vitest'
import { Grenade } from '../Grenade'

describe('Grenade', () => {
  it('should create grenade with correct type', () => {
    const grenade = new Grenade('he', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    expect(grenade.type).toBe('he')
    expect(grenade.position.y).toBe(2)
  })

  it('should tick fuse timer', () => {
    const grenade = new Grenade('he', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    expect(grenade.fuseTimer).toBe(2.5)
    grenade.update(0.1)
    expect(grenade.fuseTimer).toBeCloseTo(2.4)
  })

  it('should be expired when fuse reaches zero', () => {
    const grenade = new Grenade('flash', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    grenade.update(2.0)
    expect(grenade.isExpired()).toBe(true)
  })

  it('should apply gravity to velocity', () => {
    const grenade = new Grenade('he', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    const initialVy = grenade.velocity.y
    grenade.update(0.1)
    expect(grenade.velocity.y).toBeLessThan(initialVy)
  })

  it('should bounce off ground', () => {
    const grenade = new Grenade('he', { x: 0, y: 0.5, z: 0 }, { x: 0, y: -5, z: 0 })
    grenade.update(0.2)
    expect(grenade.velocity.y).toBeGreaterThan(0)
    expect(grenade.bounces).toBe(1)
  })

  it('should stop bouncing after max bounces', () => {
    const grenade = new Grenade('he', { x: 0, y: 0.5, z: 0 }, { x: 0, y: -5, z: 0 })
    for (let i = 0; i < 5; i++) {
      grenade.update(0.2)
    }
    expect(grenade.bounces).toBeLessThanOrEqual(3)
  })
})