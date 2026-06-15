import * as THREE from 'three'

export interface ExplosionOptions {
  position: THREE.Vector3
  scale?: number
  particleCount?: number
  color?: number
  secondaryColor?: number
  speed?: number
  life?: number
  lightIntensity?: number
  lightDistance?: number
}

const DEFAULTS: Required<Omit<ExplosionOptions, 'position'>> = {
  scale: 1,
  particleCount: 25,
  color: 0xff4400,
  secondaryColor: 0xffaa00,
  speed: 6,
  life: 0.5,
  lightIntensity: 5,
  lightDistance: 15,
}

/**
 * Creates an explosion effect with particle burst and point light flash.
 * Bigger enemies get larger explosions - use scale to control.
 */
export function createExplosion(
  scene: THREE.Scene,
  options: ExplosionOptions
): ExplosionHandle {
  const opts = { ...DEFAULTS, ...options }
  const { position, scale } = opts

  const debris = emitBurst(scene, position, Math.floor(opts.particleCount * scale), opts.color, opts.speed * scale, opts.life, 2.5 * scale)
  const sparks = emitBurst(scene, position, Math.floor(opts.particleCount * 0.6 * scale), opts.secondaryColor, (opts.speed * 0.8) * scale, opts.life * 1.3, 2 * scale)

  const flash = new THREE.PointLight(opts.color, opts.lightIntensity * scale, opts.lightDistance * scale)
  flash.position.copy(position)
  scene.add(flash)

  const startTime = Date.now()
  const duration = opts.life * 1000

  return {
    debris,
    sparks,
    flash,
    scene,
    startTime,
    duration,
  }
}

function emitBurst(
  scene: THREE.Scene,
  position: THREE.Vector3,
  count: number,
  color: number,
  speed: number,
  life: number,
  spread: number
): { particles: THREE.Mesh[]; velocities: THREE.Vector3[]; life: number; maxLife: number; scene: THREE.Scene } {
  const particles: THREE.Mesh[] = []
  const velocities: THREE.Vector3[] = []
  const geo = new THREE.SphereGeometry(0.06, 4, 4)

  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(position)
    scene.add(mesh)
    particles.push(mesh)

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * spread,
      Math.random() * spread * 0.6,
      (Math.random() - 0.5) * spread
    ).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5))
    velocities.push(vel)
  }

  return { particles, velocities, life, maxLife: life, scene }
}

export interface ExplosionHandle {
  debris: ReturnType<typeof emitBurst>
  sparks: ReturnType<typeof emitBurst>
  flash: THREE.PointLight
  scene: THREE.Scene
  startTime: number
  duration: number
}

/**
 * Updates all parts of an explosion. Returns false when explosion is done.
 */
export function updateExplosion(handle: ExplosionHandle, dt: number): boolean {
  const elapsed = Date.now() - handle.startTime
  if (elapsed > handle.duration) {
    return false
  }

  const fade = 1 - elapsed / handle.duration
  handle.flash.intensity = fade * 5

  for (const burst of [handle.debris, handle.sparks]) {
    burst.life -= dt
    const scale = Math.max(0, burst.life / burst.maxLife)
    for (let i = 0; i < burst.particles.length; i++) {
      burst.velocities[i].y -= 9.8 * dt * 0.2
      burst.particles[i].position.addScaledVector(burst.velocities[i], dt)
      burst.particles[i].scale.setScalar(scale)
    }
  }

  return true
}

/**
 * Removes all explosion resources from the scene.
 */
export function disposeExplosion(handle: ExplosionHandle) {
  const { scene } = handle
  scene.remove(handle.flash)
  handle.flash.dispose()

  for (const burst of [handle.debris, handle.sparks]) {
    for (const mesh of burst.particles) {
      scene.remove(mesh)
      mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose()
      }
    }
  }
}

/**
 * Returns a scale factor based on enemy type.
 */
export function getExplosionScale(enemyType: string): number {
  switch (enemyType) {
    case 'tank': return 1.8
    case 'runner': return 0.8
    case 'grunt':
    default: return 1.0
  }
}
