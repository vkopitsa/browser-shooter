import * as THREE from 'three'

export class SmokeCloud {
  position: THREE.Vector3
  radius: number
  maxRadius: number
  duration: number
  private elapsed: number = 0
  private mesh: THREE.Mesh
  private material: THREE.MeshBasicMaterial
  private growDuration: number = 0.5
  private fadeStart: number

  constructor(position: THREE.Vector3, radius: number = 6, duration: number = 15) {
    this.position = position.clone()
    this.radius = 0
    this.maxRadius = radius
    this.duration = duration
    this.fadeStart = duration - 3

    this.material = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      this.material
    )
    this.mesh.position.copy(this.position)
    this.mesh.scale.setScalar(0.01)
  }

  get meshRef(): THREE.Mesh {
    return this.mesh
  }

  update(dt: number): void {
    this.elapsed += dt

    if (this.elapsed < this.growDuration) {
      const t = this.elapsed / this.growDuration
      this.radius = this.maxRadius * t
      this.mesh.scale.setScalar(this.radius)
      this.material.opacity = 0.7 * t
    } else if (this.elapsed < this.fadeStart) {
      this.material.opacity = 0.7
    } else if (this.elapsed < this.duration) {
      const t = (this.elapsed - this.fadeStart) / (this.duration - this.fadeStart)
      this.material.opacity = 0.7 * (1 - t)
    }
  }

  isExpired(): boolean {
    return this.elapsed >= this.duration
  }

  containsPoint(point: THREE.Vector3): boolean {
    return this.position.distanceTo(point) <= this.radius
  }

  blocksRaycast(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const dir = to.clone().sub(from)
    const len = dir.length()
    dir.normalize()

    const oc = this.position.clone().sub(from)
    const proj = oc.dot(dir)
    if (proj < 0 || proj > len) return false

    const closest = from.clone().addScaledVector(dir, proj)
    return closest.distanceTo(this.position) <= this.radius
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
