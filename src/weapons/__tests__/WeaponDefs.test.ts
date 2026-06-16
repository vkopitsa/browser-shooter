import { describe, it, expect } from 'vitest'
import { WEAPON_DEFS, weaponVisual } from '../WeaponDefs'
import type { WeaponType } from '../../types'

const ALL: WeaponType[] = [
  'pistol', 'usp', 'glock', 'deagle',
  'm4', 'aug', 'ak', 'galil', 'mp5', 'shotgun', 'awp', 'rifle',
]

describe('WeaponDefs', () => {
  it('defines every weapon type with positive stats', () => {
    for (const t of ALL) {
      const def = WEAPON_DEFS[t]
      expect(def, t).toBeDefined()
      expect(def.damage).toBeGreaterThan(0)
      expect(def.maxAmmo).toBeGreaterThan(0)
    }
  })

  it('maps weapons to existing visual classes (no new assets)', () => {
    expect(weaponVisual('usp')).toBe('pistol')
    expect(weaponVisual('deagle')).toBe('pistol')
    expect(weaponVisual('shotgun')).toBe('shotgun')
    expect(weaponVisual('ak')).toBe('rifle')
    expect(weaponVisual('awp')).toBe('rifle')
  })
})
