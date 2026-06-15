import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { ZONE_MULTIPLIERS, resolveZone, zonedDamage } from '../DamageZones'

describe('DamageZones', () => {
  it('exposes head/body/legs multipliers', () => {
    expect(ZONE_MULTIPLIERS.head).toBe(4)
    expect(ZONE_MULTIPLIERS.body).toBe(1)
    expect(ZONE_MULTIPLIERS.legs).toBe(0.75)
  })

  it('resolves a tagged mesh to its zone', () => {
    const mesh = new THREE.Mesh()
    mesh.userData.zone = 'head'
    expect(resolveZone(mesh)).toBe('head')
  })

  it('walks up parents to find the zone tag', () => {
    const parent = new THREE.Group()
    parent.userData.zone = 'legs'
    const child = new THREE.Mesh()
    parent.add(child)
    expect(resolveZone(child)).toBe('legs')
  })

  it('defaults to body when no zone tag exists', () => {
    expect(resolveZone(new THREE.Mesh())).toBe('body')
  })

  it('scales weapon damage by the zone multiplier', () => {
    expect(zonedDamage(20, 'head')).toBe(80)
    expect(zonedDamage(20, 'body')).toBe(20)
    expect(zonedDamage(20, 'legs')).toBe(15)
  })
})
