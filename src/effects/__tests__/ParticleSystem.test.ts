import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { ParticleSystem } from '../ParticleSystem'
import { createMuzzleFlash, getMuzzleFlashPosition } from '../MuzzleFlash'
import { createSparkBurst, createBloodSplatter, updateParticleHandle } from '../BulletImpact'
import { createExplosion, updateExplosion, disposeExplosion, getExplosionScale } from '../Explosion'

describe('ParticleSystem', () => {
  let scene: THREE.Scene
  let ps: ParticleSystem

  beforeEach(() => {
    scene = new THREE.Scene()
    ps = new ParticleSystem(scene)
  })

  it('creates particles and adds them to scene', () => {
    ps.emit(new THREE.Vector3(0, 0, 0), 10, 0xff0000)
    ps.update(0.01)
    // Particles should be in the scene
    expect(scene.children.length).toBeGreaterThan(0)
  })

  it('clears all particles from scene', () => {
    ps.emit(new THREE.Vector3(0, 0, 0), 20, 0xff0000)
    ps.clear()
    ps.update(0.01)
    // After clear, scene should have no particle meshes
    // (the pool keeps them but they're removed from scene)
    const sphereMeshes = scene.children.filter(
      c => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.SphereGeometry
    )
    expect(sphereMeshes.length).toBe(0)
  })

  it('creates muzzle flash particles', () => {
    const before = scene.children.length
    ps.muzzleFlash(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1))
    ps.update(0.01)
    expect(scene.children.length).toBeGreaterThan(before)
  })

  it('creates explosion particles', () => {
    const before = scene.children.length
    ps.explosion(new THREE.Vector3(0, 0, 0))
    ps.update(0.01)
    expect(scene.children.length).toBeGreaterThan(before)
  })

  it('creates larger explosion for tank than runner', () => {
    ps.explosion(new THREE.Vector3(0, 0, 0), 'tank')
    ps.update(0.01)
    const tankCount = scene.children.length

    ps.clear()

    ps.explosion(new THREE.Vector3(0, 0, 0), 'runner')
    ps.update(0.01)
    const runnerCount = scene.children.length

    expect(tankCount).toBeGreaterThan(runnerCount)
  })

  it('creates bullet impact sparks', () => {
    const before = scene.children.length
    ps.bulletImpact(new THREE.Vector3(1, 2, 3))
    ps.update(0.01)
    expect(scene.children.length).toBeGreaterThan(before)
  })

  it('creates blood splatter on enemy hit', () => {
    const before = scene.children.length
    ps.bloodSplatter(new THREE.Vector3(1, 2, 3))
    ps.update(0.01)
    expect(scene.children.length).toBeGreaterThan(before)
  })

  it('pools particles for reuse after death', () => {
    // Emit particles with very short life
    ps.emit(new THREE.Vector3(0, 0, 0), 5, 0xff0000, 5, 0.01)
    ps.update(1.0) // all die, returned to pool

    const childrenAfterDeath = scene.children.length

    // Emit again — should reuse from pool
    ps.emit(new THREE.Vector3(0, 0, 0), 5, 0xff0000, 5, 1.0)
    ps.update(0.01)

    // Scene should have the new particles
    expect(scene.children.length).toBeGreaterThan(childrenAfterDeath)
  })

  it('particles shrink as they age', () => {
    ps.emit(new THREE.Vector3(0, 0, 0), 1, 0xff0000, 0, 1.0) // no velocity, just age
    ps.update(0.01)
    const particle = scene.children[0] as THREE.Mesh
    const initialScale = particle.scale.x

    ps.update(0.5)
    const laterScale = particle.scale.x

    expect(laterScale).toBeLessThan(initialScale)
  })

  it('removes dead particles from scene', () => {
    ps.emit(new THREE.Vector3(0, 0, 0), 5, 0xff0000, 5, 0.01)
    ps.update(1.0) // all die

    const sphereMeshes = scene.children.filter(
      c => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.SphereGeometry
    )
    expect(sphereMeshes.length).toBe(0)
  })

  it('handles multiple emit calls', () => {
    ps.emit(new THREE.Vector3(0, 0, 0), 10, 0xff0000)
    ps.emit(new THREE.Vector3(1, 0, 0), 10, 0x00ff00)
    ps.emit(new THREE.Vector3(2, 0, 0), 10, 0x0000ff)
    ps.update(0.01)
    expect(scene.children.length).toBeGreaterThanOrEqual(30)
  })
})

describe('MuzzleFlash', () => {
  it('creates a point light at position', () => {
    const scene = new THREE.Scene()
    const pos = new THREE.Vector3(1, 2, 3)
    const light = createMuzzleFlash(scene, pos)
    expect(light).toBeInstanceOf(THREE.PointLight)
    expect(light.position.x).toBe(1)
    expect(scene.children.length).toBeGreaterThan(0)
  })

  it('auto-removes light after duration', () => {
    vi.useFakeTimers()
    const scene = new THREE.Scene()
    const pos = new THREE.Vector3(0, 0, 0)
    createMuzzleFlash(scene, pos, 0xffff00, 2, 5, 50)
    const countBefore = scene.children.length
    vi.advanceTimersByTime(60)
    expect(scene.children.length).toBeLessThan(countBefore)
    vi.useRealTimers()
  })

  it('computes muzzle flash position from camera', () => {
    const camPos = new THREE.Vector3(0, 2, 0)
    const camQuat = new THREE.Quaternion()
    const pos = getMuzzleFlashPosition(camPos, camQuat)
    expect(pos).toBeInstanceOf(THREE.Vector3)
    expect(pos.z).toBeLessThan(0) // forward is -Z
  })

  it('muzzle flash position is offset from camera', () => {
    const camPos = new THREE.Vector3(5, 3, 10)
    const camQuat = new THREE.Quaternion()
    const pos = getMuzzleFlashPosition(camPos, camQuat)
    // Should not be the same as camera position
    expect(pos.equals(camPos)).toBe(false)
  })
})

describe('BulletImpact', () => {
  it('creates spark burst particles', () => {
    const scene = new THREE.Scene()
    const pos = new THREE.Vector3(0, 1, 0)
    const handle = createSparkBurst(scene, pos, 8)
    expect(handle.particles.length).toBe(8)
    expect(handle.directions.length).toBe(8)
    expect(handle.life).toBeGreaterThan(0)
  })

  it('creates blood splatter particles', () => {
    const scene = new THREE.Scene()
    const pos = new THREE.Vector3(0, 1, 0)
    const handle = createBloodSplatter(scene, pos, 12)
    expect(handle.particles.length).toBe(12)
    expect(handle.directions.length).toBe(12)
  })

  it('updates particle handle and returns true while alive', () => {
    const scene = new THREE.Scene()
    const handle = createSparkBurst(scene, new THREE.Vector3(0, 0, 0), 3, 0xffaa00, 3, 1.0)
    const alive = updateParticleHandle(handle, 0.1)
    expect(alive).toBe(true)
  })

  it('returns false when particles expire', () => {
    const scene = new THREE.Scene()
    const handle = createSparkBurst(scene, new THREE.Vector3(0, 0, 0), 3, 0xffaa00, 3, 0.01)
    const alive = updateParticleHandle(handle, 1.0)
    expect(alive).toBe(false)
  })

  it('decrements life on update', () => {
    const scene = new THREE.Scene()
    const handle = createSparkBurst(scene, new THREE.Vector3(0, 0, 0), 3, 0xffaa00, 3, 1.0)
    updateParticleHandle(handle, 0.1)
    expect(handle.life).toBeLessThan(1.0)
  })

  it('spark particles are added to scene', () => {
    const scene = new THREE.Scene()
    const before = scene.children.length
    createSparkBurst(scene, new THREE.Vector3(0, 0, 0), 5)
    expect(scene.children.length).toBe(before + 5)
  })
})

describe('Explosion', () => {
  it('creates explosion with debris and sparks', () => {
    const scene = new THREE.Scene()
    const pos = new THREE.Vector3(0, 1, 0)
    const handle = createExplosion(scene, { position: pos })
    expect(handle.debris.particles.length).toBeGreaterThan(0)
    expect(handle.sparks.particles.length).toBeGreaterThan(0)
    expect(handle.flash).toBeInstanceOf(THREE.PointLight)
  })

  it('scales explosion by enemy type', () => {
    const scene = new THREE.Scene()
    const pos = new THREE.Vector3(0, 1, 0)
    const tankExp = createExplosion(scene, { position: pos, scale: getExplosionScale('tank') })
    const runnerExp = createExplosion(scene, { position: pos, scale: getExplosionScale('runner') })
    expect(tankExp.debris.particles.length).toBeGreaterThan(runnerExp.debris.particles.length)
  })

  it('returns correct explosion scales', () => {
    expect(getExplosionScale('tank')).toBe(1.8)
    expect(getExplosionScale('runner')).toBe(0.8)
    expect(getExplosionScale('grunt')).toBe(1.0)
    expect(getExplosionScale('unknown')).toBe(1.0)
  })

  it('updates explosion while alive', () => {
    const scene = new THREE.Scene()
    const handle = createExplosion(scene, { position: new THREE.Vector3(0, 0, 0), life: 1.0 })
    const alive = updateExplosion(handle, 0.01)
    expect(alive).toBe(true)
  })

  it('returns false when explosion expires', () => {
    const scene = new THREE.Scene()
    // Use a very short life so Date.now() - startTime > duration
    const handle = createExplosion(scene, { position: new THREE.Vector3(0, 0, 0), life: 0.001 })
    // Wait for real time to pass (duration is life * 1000 = 1ms)
    const start = Date.now()
    while (Date.now() - start < 5) { /* busy wait */ }
    const alive = updateExplosion(handle, 1.0)
    expect(alive).toBe(false)
  })

  it('disposes explosion resources without throwing', () => {
    const scene = new THREE.Scene()
    const handle = createExplosion(scene, { position: new THREE.Vector3(0, 0, 0) })
    disposeExplosion(handle)
    // Should not throw
    expect(true).toBe(true)
  })

  it('explosion flash light is added to scene', () => {
    const scene = new THREE.Scene()
    const before = scene.children.length
    createExplosion(scene, { position: new THREE.Vector3(0, 0, 0) })
    expect(scene.children.length).toBeGreaterThan(before)
  })
})
