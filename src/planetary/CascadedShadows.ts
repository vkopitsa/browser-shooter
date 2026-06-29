import * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

export class CascadedShadows {
  readonly lights: THREE.DirectionalLight[]
  private cascadeSplits: number[]
  private cascadeRes: number
  private disabled = false

  constructor() {
    this.cascadeSplits = PLANETARY_CONFIG.shadows.cascadeSplits
    this.cascadeRes = PLANETARY_CONFIG.shadows.cascadeResolution
    this.lights = []

    for (let i = 0; i < PLANETARY_CONFIG.shadows.cascadeCount; i++) {
      const light = new THREE.DirectionalLight(0xffffff, 0)
      light.castShadow = true
      light.shadow.mapSize.set(this.cascadeRes, this.cascadeRes)
      light.shadow.camera.near = 0.5
      light.shadow.camera.far = 1000
      light.shadow.bias = -0.0005
      light.shadow.normalBias = 0.02
      light.visible = false
      this.lights.push(light)
    }
  }

  update(sunDirection: THREE.Vector3, camera: THREE.Camera): void {
    if (this.disabled) return

    const sunDir = sunDirection.clone().normalize()
    const camPos = camera.position.clone()

    for (let i = 0; i < this.lights.length; i++) {
      const near = i === 0 ? 0.1 : this.cascadeSplits[i - 1]
      const far = this.cascadeSplits[i]

      const center = camPos.clone().add(
        camera.getWorldDirection(new THREE.Vector3()).multiplyScalar((near + far) / 2),
      )

      const light = this.lights[i]
      light.position.copy(center).add(sunDir.clone().multiplyScalar(150))
      light.target.position.copy(center)
      light.target.updateMatrixWorld()

      const halfSize = far * 0.8
      light.shadow.camera.left = -halfSize
      light.shadow.camera.right = halfSize
      light.shadow.camera.top = halfSize
      light.shadow.camera.bottom = -halfSize
      light.shadow.camera.updateProjectionMatrix()
    }
  }

  addToScene(scene: THREE.Scene): void {
    for (const light of this.lights) {
      scene.add(light)
      scene.add(light.target)
      light.visible = true
    }
  }

  removeFromScene(scene: THREE.Scene): void {
    for (const light of this.lights) {
      scene.remove(light.target)
      scene.remove(light)
    }
  }

  setIntensity(intensity: number): void {
    for (const light of this.lights) {
      light.intensity = intensity / this.lights.length
    }
  }

  setColor(color: THREE.Color): void {
    for (const light of this.lights) {
      light.color.copy(color)
    }
  }

  fallbackToSingle(shadowLight: THREE.DirectionalLight): void {
    this.disabled = true
    for (const l of this.lights) {
      l.visible = false
      l.intensity = 0
    }
    shadowLight.castShadow = true
    shadowLight.visible = true
  }

  dispose(): void {
    for (const l of this.lights) {
      l.dispose()
    }
    this.lights.length = 0
  }
}
