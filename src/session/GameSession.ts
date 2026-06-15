import * as THREE from 'three'
import { Player } from '../player/Player'
import { WeaponManager } from '../weapons/WeaponManager'
import { Enemy } from '../enemies/Enemy'
import { WaveManager } from '../enemies/WaveManager'
import { Pickup } from '../systems/Pickup'
import { ScoreSystem } from '../systems/ScoreSystem'
import type { CollisionWorld } from '../engine/CollisionWorld'
import { emptyInput, type PlayerInput, type Snapshot, type SessionEvent, type EntityState } from './protocol'
import type { Vec3 } from '../types'
import { zonedDamage, resolveZone } from '../systems/DamageZones'

export const ARENA_SIZE = 30
const LOCAL_ID = 'local'

function toVec3(v: THREE.Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z }
}

export class GameSession {
  readonly localId = LOCAL_ID
  player = new Player()
  weaponManager = new WeaponManager()
  enemies: Enemy[] = []
  waveManager = new WaveManager()
  scoreSystem = new ScoreSystem()
  pickups: Pickup[] = []
  collisionWorld: CollisionWorld | null = null
  tick = 0

  private shootRaycaster = new THREE.Raycaster()
  private cameraQuat = new THREE.Quaternion()
  private inputs = new Map<string, PlayerInput>([[LOCAL_ID, emptyInput()]])

  applyInput(playerId: string, input: PlayerInput): void {
    this.inputs.set(playerId, input)
  }

  getInput(playerId: string): PlayerInput {
    return this.inputs.get(playerId) ?? emptyInput()
  }

  getSnapshot(): Snapshot {
    const players: EntityState[] = [{
      id: LOCAL_ID,
      kind: 'player',
      type: 'player',
      position: toVec3(this.player.position),
      rotationY: this.player.rotation.y,
      health: this.player.health,
      isDead: this.player.isDead,
    }]
    const enemies: EntityState[] = this.enemies.map((e, i) => ({
      id: `enemy-${i}`,
      kind: 'enemy',
      type: e.type,
      position: toVec3(e.mesh.position),
      rotationY: e.mesh.rotation.y,
      health: e.health,
      isDead: e.isDead,
    }))
    return { tick: this.tick, players, enemies }
  }

  step(dt: number): SessionEvent[] {
    const events: SessionEvent[] = []
    this.tick++
    const input = this.getInput(LOCAL_ID)
    const player = this.player

    // Look (yaw/pitch are absolute, set by the input producer).
    player.rotation.y = input.yaw
    player.rotation.x = THREE.MathUtils.clamp(input.pitch, -Math.PI / 2, Math.PI / 2)

    // Movement + collision.
    player.update(dt, input, ARENA_SIZE)
    if (this.collisionWorld) this.collisionWorld.resolve(player.position, 0.5)

    // Weapons.
    this.weaponManager.update(dt)
    if (input.shoot && this.weaponManager.current.canShoot()) {
      this.weaponManager.current.shoot()
      this.fireLocalWeapon(events)
    }

    // Waves + enemies.
    this.waveManager.update(dt, ARENA_SIZE)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      const action = enemy.update(dt, player.position, this.collisionWorld ?? undefined)

      if (enemy.isDead) {
        if (enemy.deathTimer <= 0) this.enemies.splice(i, 1) // App removes/disposes the mesh
        continue
      }

      if (enemy.telegraphCue) {
        events.push({
          type: 'enemyTelegraph',
          enemyPos: toVec3(enemy.mesh.position),
          facing: toVec3(new THREE.Vector3(0, 0, -1).applyQuaternion(enemy.mesh.quaternion)),
        })
      }

      if (action) {
        if (action.type === 'shoot') {
          if (action.hit) player.takeDamage(action.damage)
          events.push({
            type: 'enemyShoot',
            from: toVec3(action.from),
            to: action.hit ? toVec3(player.position) : toVec3(action.to),
            hit: action.hit,
            damage: action.damage,
          })
        } else {
          player.takeDamage(action.damage)
          events.push({ type: 'enemyMelee', damage: action.damage, enemyPos: toVec3(enemy.mesh.position) })
        }
        if (player.isDead) {
          events.push({ type: 'playerDied' })
          return events
        }
      }
    }

    // Pickups.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i]
      pickup.update(dt, this.tick * dt)
      if (pickup.checkCollision(player.position)) {
        if (pickup.type === 'health') player.heal(pickup.value)
        else this.weaponManager.addAmmo(this.weaponManager.current.type, pickup.value)
        events.push({ type: 'pickup', pickupType: pickup.type, value: pickup.value })
        this.pickups.splice(i, 1) // App removes/disposes the mesh
      }
    }

    return events
  }

  private fireLocalWeapon(events: SessionEvent[]): void {
    const weapon = this.weaponManager.current
    // Forward from the player's full orientation (yaw + pitch), matching the camera.
    this.cameraQuat.setFromEuler(this.player.rotation)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cameraQuat)
    const pellets = weapon.type === 'shotgun' ? 6 : 1
    for (let p = 0; p < pellets; p++) {
      const dir = weapon.getSpreadDirection(forward)
      this.resolveShot(this.player.position, dir, weapon.def.range, weapon.def.damage, events)
    }
  }

  private resolveShot(origin: THREE.Vector3, direction: THREE.Vector3, range: number, baseDamage: number, events: SessionEvent[]): void {
    this.shootRaycaster.set(origin, direction)
    this.shootRaycaster.far = range

    let nearest: Enemy | null = null
    let nearestDist = Infinity
    let hitObject: THREE.Object3D | null = null
    let hitPoint: THREE.Vector3 | null = null

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      enemy.mesh.updateMatrixWorld(true)
      const hits = this.shootRaycaster.intersectObject(enemy.mesh, true)
      if (hits.length > 0 && hits[0].distance < nearestDist) {
        nearestDist = hits[0].distance
        nearest = enemy
        hitObject = hits[0].object
        hitPoint = hits[0].point
      }
    }

    const wallDist = this.collisionWorld
      ? this.collisionWorld.segmentBlocked(origin, origin.clone().addScaledVector(direction, range))
      : null

    if (nearest && hitPoint && (wallDist === null || nearestDist < wallDist)) {
      const zone = resolveZone(hitObject)
      const damage = zonedDamage(baseDamage, zone)
      const killed = nearest.takeDamage(damage)
      events.push({
        type: 'playerHitEnemy',
        enemyType: nearest.type,
        hit: { targetId: nearest.type, zone, damage, killed, point: toVec3(hitPoint) },
      })
      if (killed) {
        this.scoreSystem.addKill(nearest.def.scoreValue)
        this.waveManager.onEnemyKilled()
        events.push({ type: 'enemyKilled', enemyType: nearest.type, pos: toVec3(nearest.mesh.position), scoreValue: nearest.def.scoreValue })
      }
      return
    }

    if (wallDist !== null) {
      events.push({ type: 'wallImpact', point: toVec3(origin.clone().addScaledVector(direction, wallDist)) })
    }
  }
}
