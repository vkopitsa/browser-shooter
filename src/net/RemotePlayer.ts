import * as THREE from 'three'
import { buildCharacter } from '../entities/CharacterModel'
import type { EntityState } from '../session/protocol'

const LERP_RATE = 12 // higher = snappier; tuned for ~100ms snapshot spacing

/** A networked player's visual body, smoothed toward the latest snapshot. */
export class RemotePlayer {
  readonly group: THREE.Group
  private target = new THREE.Vector3()
  private targetYaw = 0
  isDead = false

  constructor(readonly id: string, name: string, tint = 0x3399ff) {
    this.group = buildCharacter({ tint, name })
  }

  pushState(s: EntityState): void {
    this.target.set(s.position.x, s.position.y, s.position.z)
    this.targetYaw = s.rotationY
    this.isDead = s.isDead
    if (this.group.position.lengthSq() === 0) this.group.position.copy(this.target) // snap on first state
  }

  update(dt: number): void {
    const t = 1 - Math.exp(-LERP_RATE * dt) // frame-rate-independent lerp
    this.group.position.lerp(this.target, t)
    this.group.rotation.y += (this.targetYaw - this.group.rotation.y) * t
    this.group.visible = !this.isDead
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() }
    })
  }
}
