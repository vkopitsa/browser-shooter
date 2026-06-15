import * as THREE from 'three'

export interface DamageIndicatorState {
  flashOpacity: number
  directionalAngle: number | null
  active: boolean
}

/**
 * Creates a fresh damage indicator state.
 */
export function createDamageIndicatorState(): DamageIndicatorState {
  return {
    flashOpacity: 0,
    directionalAngle: null,
    active: false,
  }
}

/**
 * Triggers a damage indicator - red screen flash + directional info.
 * sourceDirection: direction FROM the damage source TO the player (world space, will be converted to screen-relative)
 */
export function triggerDamage(
  damageSourcePosition: THREE.Vector3,
  playerPosition: THREE.Vector3,
  playerRotationY: number,
  flashIntensity: number = 0.4
): DamageIndicatorState {
  const dirToSource = new THREE.Vector3()
    .subVectors(damageSourcePosition, playerPosition)
    .setY(0)
    .normalize()

  const forward = new THREE.Vector3(
    -Math.sin(playerRotationY),
    0,
    -Math.cos(playerRotationY)
  )

  const angle = Math.atan2(
    forward.x * dirToSource.z - forward.z * dirToSource.x,
    forward.x * dirToSource.x + forward.z * dirToSource.z
  )

  return {
    flashOpacity: flashIntensity,
    directionalAngle: angle,
    active: true,
  }
}

/**
 * Updates the damage indicator state (fades out the flash).
 * Returns updated state - set active to false when fully faded.
 */
export function updateDamageIndicator(state: DamageIndicatorState, dt: number): DamageIndicatorState {
  if (!state.active) return state

  const fadeSpeed = 2.5
  const newOpacity = Math.max(0, state.flashOpacity - fadeSpeed * dt)

  return {
    flashOpacity: newOpacity,
    directionalAngle: newOpacity > 0 ? state.directionalAngle : null,
    active: newOpacity > 0,
  }
}
