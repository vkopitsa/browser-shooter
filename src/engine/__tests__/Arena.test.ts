import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { createArena, rebuildArena, ARENA_GROUP_NAME } from '../Arena'
import { getZone, ZONES } from '../../zones/registry'

// Mock WebGLRenderer to avoid needing a real GL context
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three')
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      shadowMap: { enabled: false, type: 0 },
      domElement: document.createElement('canvas'),
    })),
  }
})

function countRings(scene: THREE.Scene): number {
  let n = 0
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry instanceof THREE.RingGeometry) n++
  })
  return n
}

describe('createArena', () => {
  it('builds the arena into a single named group with 2 bombsite markers', () => {
    const scene = new THREE.Scene()
    const world = createArena(scene)

    const group = scene.getObjectByName(ARENA_GROUP_NAME)
    expect(group).toBeDefined()
    expect(countRings(scene)).toBe(2)
    // Collision world should have the perimeter walls plus structures.
    expect(world.boxes.length).toBeGreaterThan(4)
  })

  it('builds every registered map without throwing', () => {
    for (const map of ZONES) {
      const scene = new THREE.Scene()
      const world = createArena(scene, map)
      expect(countRings(scene)).toBe(2)
      expect(world.boxes.length).toBeGreaterThan(0)
    }
  })
})

describe('rebuildArena', () => {
  it('replaces the existing arena, leaving exactly one arena group', () => {
    const scene = new THREE.Scene()
    createArena(scene, getZone('arid'))
    rebuildArena(scene, getZone('haze'))

    const groups = scene.children.filter((c) => c.name === ARENA_GROUP_NAME)
    expect(groups).toHaveLength(1)
    expect(countRings(scene)).toBe(2)
  })
})