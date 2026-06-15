import * as THREE from 'three'

/**
 * Creates a brief muzzle flash light at the weapon barrel position.
 * Returns the PointLight so the caller can manage it (or let it auto-clean).
 */
export function createMuzzleFlash(
  scene: THREE.Scene,
  position: THREE.Vector3,
  color: number = 0xffff00,
  intensity: number = 2,
  distance: number = 5,
  durationMs: number = 50
): THREE.PointLight {
  const flash = new THREE.PointLight(color, intensity, distance)
  flash.position.copy(position)
  scene.add(flash)

  setTimeout(() => {
    scene.remove(flash)
    flash.dispose()
  }, durationMs)

  return flash
}

/**
 * Computes the world-space position of a muzzle flash relative to camera.
 */
export function getMuzzleFlashPosition(
  cameraPosition: THREE.Vector3,
  cameraQuaternion: THREE.Quaternion,
  forwardOffset: number = 1.0,
  rightOffset: number = 0.3,
  downOffset: number = 0.2
): THREE.Vector3 {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternion)
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuaternion)

  return cameraPosition.clone()
    .add(forward.multiplyScalar(forwardOffset))
    .add(right.multiplyScalar(rightOffset))
    .sub(new THREE.Vector3(0, downOffset, 0))
}
