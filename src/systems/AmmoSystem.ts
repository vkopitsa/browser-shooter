import type { WeaponType } from '../types'

export interface AmmoCounts {
  pistol: number
  shotgun: number
  rifle: number
}

export class AmmoSystem {
  private ammo: Map<WeaponType, number> = new Map()
  private maxAmmo: Map<WeaponType, number> = new Map()

  constructor(counts?: Partial<AmmoCounts>) {
    this.ammo.set('pistol', counts?.pistol ?? 60)
    this.ammo.set('shotgun', counts?.shotgun ?? 30)
    this.ammo.set('rifle', counts?.rifle ?? 90)

    this.maxAmmo.set('pistol', 60)
    this.maxAmmo.set('shotgun', 30)
    this.maxAmmo.set('rifle', 90)
  }

  getAmmo(type: WeaponType): number {
    return this.ammo.get(type) ?? 0
  }

  getMaxAmmo(type: WeaponType): number {
    return this.maxAmmo.get(type) ?? 0
  }

  hasAmmo(type: WeaponType): boolean {
    return (this.ammo.get(type) ?? 0) > 0
  }

  consumeAmmo(type: WeaponType, amount: number = 1): boolean {
    const current = this.ammo.get(type) ?? 0
    if (current < amount) return false
    this.ammo.set(type, current - amount)
    return true
  }

  addAmmo(type: WeaponType, amount: number): number {
    const current = this.ammo.get(type) ?? 0
    const max = this.maxAmmo.get(type) ?? 0
    const newAmount = Math.min(max, current + amount)
    this.ammo.set(type, newAmount)
    return newAmount - current
  }

  setMaxAmmo(type: WeaponType, max: number) {
    this.maxAmmo.set(type, max)
    const current = this.ammo.get(type) ?? 0
    if (current > max) {
      this.ammo.set(type, max)
    }
  }

  reset() {
    this.ammo.set('pistol', this.maxAmmo.get('pistol') ?? 60)
    this.ammo.set('shotgun', this.maxAmmo.get('shotgun') ?? 30)
    this.ammo.set('rifle', this.maxAmmo.get('rifle') ?? 90)
  }

  isEmpty(type: WeaponType): boolean {
    return (this.ammo.get(type) ?? 0) === 0
  }

  allEmpty(): boolean {
    for (const [, count] of this.ammo) {
      if (count > 0) return false
    }
    return true
  }
}
