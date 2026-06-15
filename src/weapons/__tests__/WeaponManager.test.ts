import { describe, it, expect, beforeEach } from 'vitest'
import { WeaponManager } from '../WeaponManager'
import type { WeaponType } from '../../types'

describe('WeaponManager', () => {
  let manager: WeaponManager

  beforeEach(() => {
    manager = new WeaponManager()
  })

  it('initializes with 3 weapons', () => {
    expect(manager.weapons.length).toBe(3)
  })

  it('starts with pistol as current weapon', () => {
    expect(manager.current.type).toBe('pistol')
    expect(manager.currentIndex).toBe(0)
  })

  it('has pistol, shotgun, and rifle in order', () => {
    expect(manager.weapons[0].type).toBe('pistol')
    expect(manager.weapons[1].type).toBe('shotgun')
    expect(manager.weapons[2].type).toBe('rifle')
  })

  it('each weapon starts with full ammo', () => {
    expect(manager.weapons[0].ammo).toBe(60) // pistol
    expect(manager.weapons[1].ammo).toBe(30) // shotgun
    expect(manager.weapons[2].ammo).toBe(90) // rifle
  })

  it('switches weapon by index', () => {
    manager.switchByIndex(1)
    expect(manager.current.type).toBe('shotgun')
    expect(manager.currentIndex).toBe(1)
  })

  it('switches to rifle by index', () => {
    manager.switchByIndex(2)
    expect(manager.current.type).toBe('rifle')
  })

  it('does not switch on negative index', () => {
    manager.switchByIndex(-1)
    expect(manager.currentIndex).toBe(0)
  })

  it('does not switch on out-of-bounds index', () => {
    manager.switchByIndex(3)
    expect(manager.currentIndex).toBe(0)
    manager.switchByIndex(99)
    expect(manager.currentIndex).toBe(0)
  })

  it('switches weapon by type', () => {
    manager.switchTo('rifle')
    expect(manager.current.type).toBe('rifle')
  })

  it('switches to shotgun by type', () => {
    manager.switchTo('shotgun')
    expect(manager.current.type).toBe('shotgun')
  })

  it('does not switch on unknown type', () => {
    manager.switchTo('laser' as WeaponType)
    expect(manager.current.type).toBe('pistol')
  })

  it('updates all weapons on update', () => {
    // Shoot pistol to set fire timer
    manager.weapons[0].shoot()
    expect(manager.weapons[0].fireTimer).toBeGreaterThan(0)

    manager.update(0.5)
    expect(manager.weapons[0].fireTimer).toBe(0)
  })

  it('updates reload timers on all weapons', () => {
    manager.weapons[0].ammo = 10
    manager.weapons[0].reload()
    expect(manager.weapons[0].isReloading).toBe(true)

    manager.update(1.5)
    expect(manager.weapons[0].isReloading).toBe(false)
    expect(manager.weapons[0].ammo).toBe(60)
  })

  it('adds ammo to specific weapon type', () => {
    manager.weapons[0].ammo = 30
    manager.addAmmo('pistol', 10)
    expect(manager.weapons[0].ammo).toBe(40)
  })

  it('does not add ammo for non-existent weapon', () => {
    // Should not throw
    manager.addAmmo('laser' as WeaponType, 10)
    expect(manager.weapons[0].ammo).toBe(60) // unchanged
  })

  it('addAmmo respects max ammo', () => {
    manager.weapons[0].ammo = 55
    manager.addAmmo('pistol', 100)
    expect(manager.weapons[0].ammo).toBe(60)
  })

  it('switching weapons preserves ammo state', () => {
    manager.weapons[0].ammo = 30
    manager.switchByIndex(1)
    manager.switchByIndex(0)
    expect(manager.weapons[0].ammo).toBe(30)
  })

  it('current weapon reflects after switch and back', () => {
    manager.switchByIndex(2)
    expect(manager.current.type).toBe('rifle')
    manager.switchByIndex(0)
    expect(manager.current.type).toBe('pistol')
  })
})
