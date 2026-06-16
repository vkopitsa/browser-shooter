import type { WeaponDef, WeaponType } from '../types'

export const WEAPON_DEFS: Record<WeaponType, WeaponDef> = {
  // --- secondary (pistols) ---
  pistol: { name: 'Pistol', damage: 25, fireRate: 0.3,  maxAmmo: 60, spread: 0.02,  range: 50, reloadTime: 1.5 },
  usp:    { name: 'USP',    damage: 28, fireRate: 0.32, maxAmmo: 60, spread: 0.018, range: 50, reloadTime: 1.6 },
  glock:  { name: 'Glock',  damage: 22, fireRate: 0.18, maxAmmo: 60, spread: 0.025, range: 45, reloadTime: 1.5 },
  deagle: { name: 'Deagle', damage: 50, fireRate: 0.4,  maxAmmo: 35, spread: 0.03,  range: 55, reloadTime: 1.8 },

  // --- primary ---
  m4:      { name: 'M4',      damage: 24, fireRate: 0.09, maxAmmo: 90,  spread: 0.04,  range: 65,  reloadTime: 2.4 },
  aug:     { name: 'AUG',     damage: 28, fireRate: 0.1,  maxAmmo: 90,  spread: 0.045, range: 70,  reloadTime: 2.6 },
  ak:      { name: 'AK-47',   damage: 30, fireRate: 0.1,  maxAmmo: 90,  spread: 0.05,  range: 65,  reloadTime: 2.5 },
  galil:   { name: 'Galil',   damage: 22, fireRate: 0.09, maxAmmo: 105, spread: 0.05,  range: 60,  reloadTime: 2.6 },
  mp5:     { name: 'MP5',     damage: 18, fireRate: 0.07, maxAmmo: 90,  spread: 0.05,  range: 45,  reloadTime: 2.0 },
  shotgun: { name: 'Shotgun', damage: 15, fireRate: 0.8,  maxAmmo: 30,  spread: 0.15,  range: 20,  reloadTime: 2.0 },
  awp:     { name: 'AWP',     damage: 100, fireRate: 1.2, maxAmmo: 20,  spread: 0.005, range: 120, reloadTime: 3.0 },
  rifle:   { name: 'Rifle',   damage: 20, fireRate: 0.1,  maxAmmo: 90,  spread: 0.05,  range: 60,  reloadTime: 2.5 },
}

/** Existing render/audio assets only know these three classes. */
export type WeaponVisual = 'pistol' | 'shotgun' | 'rifle'

const VISUAL: Record<WeaponType, WeaponVisual> = {
  pistol: 'pistol', usp: 'pistol', glock: 'pistol', deagle: 'pistol',
  shotgun: 'shotgun',
  m4: 'rifle', aug: 'rifle', ak: 'rifle', galil: 'rifle', mp5: 'rifle', awp: 'rifle', rifle: 'rifle',
}

/** Map any weapon to an existing visual/audio class so no new assets are needed. */
export function weaponVisual(type: WeaponType): WeaponVisual {
  return VISUAL[type]
}
