import { describe, it, expect, beforeEach } from 'vitest'
import { AmmoSystem } from '../AmmoSystem'
import type { WeaponType } from '../../types'

describe('AmmoSystem', () => {
  let ammo: AmmoSystem

  beforeEach(() => {
    ammo = new AmmoSystem()
  })

  it('initializes with default ammo counts', () => {
    expect(ammo.getAmmo('pistol')).toBe(60)
    expect(ammo.getAmmo('shotgun')).toBe(30)
    expect(ammo.getAmmo('rifle')).toBe(90)
  })

  it('initializes with custom ammo counts', () => {
    const custom = new AmmoSystem({ pistol: 30, shotgun: 15, rifle: 45 })
    expect(custom.getAmmo('pistol')).toBe(30)
    expect(custom.getAmmo('shotgun')).toBe(15)
    expect(custom.getAmmo('rifle')).toBe(45)
  })

  it('reports max ammo', () => {
    expect(ammo.getMaxAmmo('pistol')).toBe(60)
    expect(ammo.getMaxAmmo('shotgun')).toBe(30)
    expect(ammo.getMaxAmmo('rifle')).toBe(90)
  })

  it('checks if has ammo', () => {
    expect(ammo.hasAmmo('pistol')).toBe(true)
    const empty = new AmmoSystem({ pistol: 0, shotgun: 0, rifle: 0 })
    expect(empty.hasAmmo('pistol')).toBe(false)
  })

  it('consumes ammo and returns true on success', () => {
    const result = ammo.consumeAmmo('pistol', 5)
    expect(result).toBe(true)
    expect(ammo.getAmmo('pistol')).toBe(55)
  })

  it('fails to consume when not enough ammo', () => {
    const low = new AmmoSystem({ pistol: 3 })
    const result = low.consumeAmmo('pistol', 5)
    expect(result).toBe(false)
    expect(low.getAmmo('pistol')).toBe(3)
  })

  it('fails to consume when empty', () => {
    const empty = new AmmoSystem({ pistol: 0 })
    const result = empty.consumeAmmo('pistol', 1)
    expect(result).toBe(false)
  })

  it('consumeAmmo defaults to 1', () => {
    ammo.consumeAmmo('pistol')
    expect(ammo.getAmmo('pistol')).toBe(59)
  })

  it('adds ammo up to max when at max', () => {
    const added = ammo.addAmmo('pistol', 5)
    expect(added).toBe(0) // already at max, nothing added
    expect(ammo.getAmmo('pistol')).toBe(60)
  })

  it('adds ammo when below max', () => {
    const low = new AmmoSystem({ pistol: 50 })
    const added = low.addAmmo('pistol', 5)
    expect(added).toBe(5)
    expect(low.getAmmo('pistol')).toBe(55)
  })

  it('does not exceed max ammo when adding', () => {
    const near = new AmmoSystem({ pistol: 55 })
    const added = near.addAmmo('pistol', 10)
    expect(added).toBe(5)
    expect(near.getAmmo('pistol')).toBe(60)
  })

  it('reports actual amount added', () => {
    const near = new AmmoSystem({ pistol: 58 })
    const added = near.addAmmo('pistol', 10)
    expect(added).toBe(2)
  })

  it('sets max ammo', () => {
    ammo.setMaxAmmo('pistol', 100)
    expect(ammo.getMaxAmmo('pistol')).toBe(100)
  })

  it('clips current ammo when reducing max', () => {
    ammo.setMaxAmmo('pistol', 30)
    expect(ammo.getAmmo('pistol')).toBe(30)
  })

  it('reset restores all ammo to max', () => {
    ammo.consumeAmmo('pistol', 30)
    ammo.consumeAmmo('shotgun', 10)
    ammo.consumeAmmo('rifle', 45)
    ammo.reset()
    expect(ammo.getAmmo('pistol')).toBe(60)
    expect(ammo.getAmmo('shotgun')).toBe(30)
    expect(ammo.getAmmo('rifle')).toBe(90)
  })

  it('checks if specific ammo type is empty', () => {
    const a = new AmmoSystem({ pistol: 0, shotgun: 5 })
    expect(a.isEmpty('pistol')).toBe(true)
    expect(a.isEmpty('shotgun')).toBe(false)
  })

  it('checks if all ammo is empty', () => {
    const empty = new AmmoSystem({ pistol: 0, shotgun: 0, rifle: 0 })
    expect(empty.allEmpty()).toBe(true)
    empty.addAmmo('pistol', 1)
    expect(empty.allEmpty()).toBe(false)
  })

  it('handles unknown ammo type gracefully', () => {
    expect(ammo.getAmmo('laser' as WeaponType)).toBe(0)
    expect(ammo.hasAmmo('laser' as WeaponType)).toBe(false)
    expect(ammo.isEmpty('laser' as WeaponType)).toBe(true)
  })

  it('adding ammo to unknown type does not throw', () => {
    const result = ammo.addAmmo('laser' as WeaponType, 10)
    expect(result).toBe(0)
  })

  it('consuming unknown type returns false', () => {
    const result = ammo.consumeAmmo('laser' as WeaponType, 1)
    expect(result).toBe(false)
  })

  it('setMaxAmmo on unknown type does not throw', () => {
    ammo.setMaxAmmo('laser' as WeaponType, 50)
    expect(ammo.getMaxAmmo('laser' as WeaponType)).toBe(50)
  })
})
