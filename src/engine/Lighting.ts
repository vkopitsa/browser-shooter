import * as THREE from 'three'

export function setupLighting(scene: THREE.Scene) {
  const ambientLight = new THREE.AmbientLight(0x404060, 0.5)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 1)
  dirLight.position.set(10, 20, 10)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 2048
  dirLight.shadow.mapSize.height = 2048
  dirLight.shadow.camera.near = 0.5
  dirLight.shadow.camera.far = 100
  dirLight.shadow.camera.left = -40
  dirLight.shadow.camera.right = 40
  dirLight.shadow.camera.top = 40
  dirLight.shadow.camera.bottom = -40
  scene.add(dirLight)

  const pointLight = new THREE.PointLight(0xff6600, 0.8, 50)
  pointLight.position.set(0, 8, 0)
  scene.add(pointLight)
}
