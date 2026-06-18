import * as THREE from 'three'

export interface BulletImpactOptions {
  position: THREE.Vector3
  normal?: THREE.Vector3
  isEnemy?: boolean
}

/**
 * Creates spark particles at a bullet impact point (wall/floor hit).
 */
export function createSparkBurst(
  scene: THREE.Scene,
  position: THREE.Vector3,
  particleCount: number = 8,
  color: number = 0xffaa00,
  speed: number = 3,
  life: number = 0.3
): ParticleHandle {
  const particles: THREE.Mesh[] = []
  const geo = new THREE.SphereGeometry(0.04, 4, 4)
  const directions: THREE.Vector3[] = []

  for (let i = 0; i < particleCount; i++) {
    const mat = new THREE.MeshBasicMaterial({ color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(position)
    scene.add(mesh)
    particles.push(mesh)

    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 0.5 + 0.5,
      (Math.random() - 0.5) * 2
    ).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5))
    directions.push(dir)
  }

  return { particles, directions, life, maxLife: life }
}

/**
 * Creates blood particles at a hit point on an enemy.
 */
export function createBloodSplatter(
  scene: THREE.Scene,
  position: THREE.Vector3,
  particleCount: number = 12,
  color: number = 0xcc0000,
  speed: number = 4,
  life: number = 0.4
): ParticleHandle {
  const particles: THREE.Mesh[] = []
  const geo = new THREE.SphereGeometry(0.05, 4, 4)
  const directions: THREE.Vector3[] = []

  for (let i = 0; i < particleCount; i++) {
    const mat = new THREE.MeshBasicMaterial({ color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(position)
    scene.add(mesh)
    particles.push(mesh)

    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 0.3,
      (Math.random() - 0.5) * 2
    ).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5))
    directions.push(dir)
  }

  return { particles, directions, life, maxLife: life }
}

export interface ParticleHandle {
  particles: THREE.Mesh[]
  directions: THREE.Vector3[]
  life: number
  maxLife: number
}

/**
 * Updates a particle handle by dt. Returns false when all particles are dead.
 */
export function updateParticleHandle(handle: ParticleHandle, dt: number): boolean {
  handle.life -= dt
  if (handle.life <= 0) {
    for (const mesh of handle.particles) {
      mesh.parent?.remove(mesh)
      mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose()
      }
    }
    return false
  }

  const scale = Math.max(0, handle.life / handle.maxLife)
  for (let i = 0; i < handle.particles.length; i++) {
    handle.particles[i].position.addScaledVector(handle.directions[i], dt)
    handle.directions[i].y -= 9.8 * dt * 0.3
    handle.particles[i].scale.setScalar(scale)
  }

  return true
}
