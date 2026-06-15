import * as THREE from 'three'
import { createMuzzleFlash, getMuzzleFlashPosition } from './MuzzleFlash'
import { createSparkBurst, createBloodSplatter, updateParticleHandle } from './BulletImpact'
import { createExplosion, updateExplosion, disposeExplosion, getExplosionScale, type ExplosionHandle } from './Explosion'
import type { ParticleHandle } from './BulletImpact'

interface Particle {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  life: number
  maxLife: number
}

export class ParticleSystem {
  private particles: Particle[] = []
  private scene: THREE.Scene
  private pool: THREE.Mesh[] = []
  private impacts: ParticleHandle[] = []
  private explosions: ExplosionHandle[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  private getParticle(): THREE.Mesh {
    if (this.pool.length > 0) {
      return this.pool.pop()!
    }
    const geo = new THREE.SphereGeometry(0.05, 4, 4)
    return new THREE.Mesh(geo)
  }

  private returnParticle(mesh: THREE.Mesh) {
    this.scene.remove(mesh)
    if (mesh.material instanceof THREE.Material) {
      mesh.material.dispose()
    }
    this.pool.push(mesh)
  }

  emit(
    position: THREE.Vector3,
    count: number,
    color: number,
    speed: number = 5,
    life: number = 0.5,
    spread: number = 1
  ) {
    for (let i = 0; i < count; i++) {
      const mesh = this.getParticle()
      const mat = new THREE.MeshBasicMaterial({ color })
      mesh.material = mat
      mesh.position.copy(position)
      mesh.scale.setScalar(1)
      this.scene.add(mesh)

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        Math.random() * spread,
        (Math.random() - 0.5) * spread
      ).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5))

      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
      })
    }
  }

  muzzleFlash(position: THREE.Vector3, direction: THREE.Vector3) {
    void direction
    this.emit(position, 5, 0xffff00, 10, 0.1, 0.3)
    createMuzzleFlash(this.scene, position, 0xffff00, 2, 5, 50)
  }

  bulletImpact(position: THREE.Vector3) {
    this.emit(position, 8, 0xffaa00, 3, 0.3, 0.5)
    const handle = createSparkBurst(this.scene, position)
    this.impacts.push(handle)
  }

  bloodSplatter(position: THREE.Vector3) {
    this.emit(position, 12, 0xff0000, 4, 0.4, 0.8)
    const handle = createBloodSplatter(this.scene, position)
    this.impacts.push(handle)
  }

  explosion(position: THREE.Vector3, enemyType: string = 'grunt') {
    const scale = getExplosionScale(enemyType)
    this.emit(position, Math.floor(30 * scale), 0xff4400, 8 * scale, 0.6, 2)
    this.emit(position, Math.floor(20 * scale), 0xffaa00, 6 * scale, 0.8, 1.5)

    const handle = createExplosion(this.scene, { position, scale })
    this.explosions.push(handle)
  }

  update(dt: number) {
    // Update core particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      p.velocity.y -= 9.8 * dt
      p.mesh.position.addScaledVector(p.velocity, dt)
      const scale = Math.max(0, p.life / p.maxLife)
      p.mesh.scale.setScalar(scale)

      if (p.life <= 0) {
        this.returnParticle(p.mesh)
        this.particles.splice(i, 1)
      }
    }

    // Update bullet impacts
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      if (!updateParticleHandle(this.impacts[i], dt)) {
        this.impacts.splice(i, 1)
      }
    }

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      if (!updateExplosion(this.explosions[i], dt)) {
        disposeExplosion(this.explosions[i])
        this.explosions.splice(i, 1)
      }
    }
  }

  clear() {
    for (const p of this.particles) {
      this.returnParticle(p.mesh)
    }
    this.particles = []

    for (const handle of this.impacts) {
      for (const mesh of handle.particles) {
        this.scene.remove(mesh)
        mesh.geometry.dispose()
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose()
        }
      }
    }
    this.impacts = []

    for (const handle of this.explosions) {
      disposeExplosion(handle)
    }
    this.explosions = []
  }
}

export { getMuzzleFlashPosition }
