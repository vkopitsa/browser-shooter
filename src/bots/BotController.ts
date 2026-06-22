import * as THREE from 'three'
import type { PlayerInput } from '../session/protocol'
import { emptyInput } from '../session/protocol'
import type { PlayerEntity } from '../session/GameSession'
import type { CollisionWorld } from '../engine/CollisionWorld'

const STANDOFF = 8          // preferred distance (m) to hold from the target
const REACTION_TIME = 0.35  // seconds of continuous sight before opening fire
const AIM_ERROR = 0.04      // radians of random aim jitter while firing
const LOOKAHEAD = 2.5       // (m) how far ahead to probe for walls before committing to a heading
// Yaw offsets (radians) tried in order when the straight path is blocked — small deflections
// first, then sharper, then sidesteps. ponytail: fixed fan beats A* for a flat arena.
const DEFLECTIONS = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]

/** Drives one bot: reads the world, returns the PlayerInput for this tick. */
export class BotController {
  private aimTimer = 0

  constructor(readonly id: string) {}

  computeInput(self: PlayerEntity, others: PlayerEntity[], world: CollisionWorld | null, dt: number): PlayerInput {
    const input = emptyInput()
    if (self.player.isDead) { this.aimTimer = 0; return input }

    const target = this.pickTarget(self, others)
    if (!target) { this.aimTimer = 0; return input }

    const delta = new THREE.Vector3().subVectors(target.player.position, self.player.position)
    const dist = delta.length()
    const dir = dist > 1e-4 ? delta.clone().multiplyScalar(1 / dist) : new THREE.Vector3(0, 0, -1)

    // Face the target (same convention the session uses to derive the forward ray).
    input.yaw = Math.atan2(-dir.x, -dir.z)
    input.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1))

    // Choose a horizontal travel heading: approach the target, hold, or back off — then
    // steer that heading around any wall in the way so the bot doesn't grind into geometry.
    const flat = new THREE.Vector3(dir.x, 0, dir.z)
    if (flat.lengthSq() > 1e-6) flat.normalize()
    let move: THREE.Vector3 | null = null
    if (dist > STANDOFF) move = this.steer(self.player.position, flat, world)
    else if (dist < STANDOFF * 0.6) move = flat.clone().multiplyScalar(-1)
    if (move) this.applyMove(input, move)

    const hasLOS = !world || world.segmentBlocked(self.player.position, target.player.position) === null
    const range = self.weapons.current.def.range

    if (hasLOS && dist <= range) {
      this.aimTimer += dt
      if (this.aimTimer >= REACTION_TIME) {
        input.shoot = true
        input.yaw += (Math.random() - 0.5) * AIM_ERROR
        input.pitch += (Math.random() - 0.5) * AIM_ERROR
      }
    } else {
      this.aimTimer = 0
    }
    return input
  }

  /** Pick the first deflected heading whose short look-ahead is wall-free; falls back to
   *  the most-deflected option so a cornered bot still tries to slide along the wall. */
  private steer(pos: THREE.Vector3, desired: THREE.Vector3, world: CollisionWorld | null): THREE.Vector3 {
    if (!world) return desired
    const base = Math.atan2(desired.x, desired.z)
    let last = desired
    for (const off of DEFLECTIONS) {
      const a = base + off
      const cand = new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
      last = cand
      const ahead = pos.clone().addScaledVector(cand, LOOKAHEAD)
      if (world.segmentBlocked(pos, ahead) === null) return cand
    }
    return last
  }

  /** Translate a world-space heading into forward/back/strafe inputs relative to the bot's
   *  facing (which is locked onto the target), so it can circle obstacles while still aiming. */
  private applyMove(input: PlayerInput, move: THREE.Vector3): void {
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, input.yaw, 0))
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, input.yaw, 0))
    const f = move.dot(forward)
    const r = move.dot(right)
    if (f > 0.3) input.forward = true
    else if (f < -0.3) input.backward = true
    if (r > 0.3) input.right = true
    else if (r < -0.3) input.left = true
  }

  /** Nearest living, enemy-team player. */
  private pickTarget(self: PlayerEntity, others: PlayerEntity[]): PlayerEntity | null {
    let best: PlayerEntity | null = null
    let bestDist = Infinity
    for (const o of others) {
      if (o.id === self.id || o.player.isDead || o.team === self.team) continue
      const d = o.player.position.distanceToSquared(self.player.position)
      if (d < bestDist) { bestDist = d; best = o }
    }
    return best
  }
}
