import * as THREE from 'three'
import { buildCharacter } from '../entities/CharacterModel'
import type { EntityState } from '../session/protocol'

const INTERP_DELAY = 100

interface InterpEntry {
  position: THREE.Vector3
  rotationY: number
  time: number
}

export class RemotePlayer {
  readonly group: THREE.Group
  private buffer: InterpEntry[] = []
  isDead = false

  constructor(readonly id: string, name: string, tint = 0x3399ff) {
    this.group = buildCharacter({ tint, name })
  }

  pushState(s: EntityState, time?: number): void {
    this.isDead = s.isDead
    this.buffer.push({
      position: new THREE.Vector3(s.position.x, s.position.y, s.position.z),
      rotationY: s.rotationY,
      time: time ?? performance.now(),
    })
    while (this.buffer.length > 10) this.buffer.shift()
    if (this.buffer.length === 1) {
      this.group.position.copy(this.buffer[0].position)
      this.group.rotation.y = this.buffer[0].rotationY
    }
  }

  getInterpolatedPosition(renderTime: number): THREE.Vector3 | null {
    const t = renderTime - INTERP_DELAY
    if (this.buffer.length < 2) return this.buffer.length === 1 ? this.buffer[0].position.clone() : null

    let a: InterpEntry | null = null
    let b: InterpEntry | null = null
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].time <= t && this.buffer[i + 1].time >= t) {
        a = this.buffer[i]
        b = this.buffer[i + 1]
        break
      }
    }
    if (!a || !b) return this.buffer[this.buffer.length - 1].position.clone()

    const frac = (t - a.time) / (b.time - a.time)
    return new THREE.Vector3().lerpVectors(a.position, b.position, frac)
  }

  getInterpolatedRotation(renderTime: number): number {
    const t = renderTime - INTERP_DELAY
    if (this.buffer.length < 2) return this.buffer.length === 1 ? this.buffer[0].rotationY : 0

    let a: InterpEntry | null = null
    let b: InterpEntry | null = null
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].time <= t && this.buffer[i + 1].time >= t) {
        a = this.buffer[i]
        b = this.buffer[i + 1]
        break
      }
    }
    if (!a || !b) return this.buffer[this.buffer.length - 1].rotationY

    const frac = (t - a.time) / (b.time - a.time)
    return a.rotationY + (b.rotationY - a.rotationY) * frac
  }

  update(dt: number): void {
    const pos = this.getInterpolatedPosition(performance.now())
    if (pos) this.group.position.copy(pos)
    this.group.rotation.y = this.getInterpolatedRotation(performance.now())
    this.group.visible = !this.isDead
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() }
    })
  }
}
