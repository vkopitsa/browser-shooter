import * as THREE from 'three'
import type { ParticleSystem } from './ParticleSystem'
import type { SoundEffects } from '../audio/SoundEffects'
import type { Vec3 } from '../types'

/** Render another player's/bot's gunfire (audio + muzzle flash). No tracer: tracers are
 *  reserved for the local player's own shots so they can read their own fire. */
export function renderRemoteShot(particleSystem: ParticleSystem, audio: SoundEffects, ev: { from: Vec3; to: Vec3 }) {
  const from = new THREE.Vector3(ev.from.x, ev.from.y, ev.from.z)
  const to = new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z)
  const dir = to.clone().sub(from).normalize()
  audio.playWeaponShoot('rifle', from)
  particleSystem.muzzleFlash(from.clone().add(dir.clone().multiplyScalar(0.4)), dir)
}

/** Tracer for the local player's own shot — the only gunfire that draws a tracer. */
export function renderLocalTracer(particleSystem: ParticleSystem, ev: { from: Vec3; to: Vec3 }) {
  particleSystem.tracer(
    new THREE.Vector3(ev.from.x, ev.from.y, ev.from.z),
    new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z), 0xfff0a0, 0.2)
}
