import * as THREE from 'three'

export class Camera {
  camera: THREE.PerspectiveCamera

  constructor(container: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.set(0, 2, 0)
  }

  resize(container: HTMLElement) {
    this.camera.aspect = container.clientWidth / container.clientHeight
    this.camera.updateProjectionMatrix()
  }
}
