import type { Object3D } from 'three'

export type HitZone = 'head' | 'body' | 'legs'

export const ZONE_MULTIPLIERS: Record<HitZone, number> = {
  head: 4,
  body: 1,
  legs: 0.75,
}

/** Walks up the parent chain to find a `userData.zone`; defaults to 'body'. */
export function resolveZone(object: Object3D | null): HitZone {
  let current: Object3D | null = object
  while (current) {
    const zone = current.userData?.zone
    if (zone === 'head' || zone === 'body' || zone === 'legs') return zone
    current = current.parent
  }
  return 'body'
}

export function zonedDamage(weaponDamage: number, zone: HitZone): number {
  return weaponDamage * ZONE_MULTIPLIERS[zone]
}
