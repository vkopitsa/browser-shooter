import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import type { BoxCollider } from '../engine/CollisionWorld'
import type { RoadStrip } from './PlanetaryScenery'
import type { SunState } from './SunSystem'
import { AtmosphereConfig } from './AtmosphereConfig'
import { BuildingGeometry } from './BuildingGeometry'
import type { BuildingSpec } from './BuildingGeometry'
import { CascadedShadows } from './CascadedShadows'
import { PostProcessing } from './PostProcessing'
import type { PostQuality } from './PostProcessing'
import { TerrainElevation } from './TerrainElevation'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const METERS_PER_DEG_LAT = 111320

function lngLatToMercator(lng: number, lat: number): [number, number] {
  const x = lng * METERS_PER_DEG_LAT * Math.cos((Math.min(Math.abs(lat), 89) * Math.PI) / 180)
  const y = lat * METERS_PER_DEG_LAT
  return [x, y]
}

function mercatorToLngLat(x: number, y: number): [number, number] {
  const lat = y / METERS_PER_DEG_LAT
  const lng = x / (METERS_PER_DEG_LAT * Math.cos((Math.min(Math.abs(lat), 89) * Math.PI) / 180))
  return [lng, lat]
}

export class PlanetaryEngine {
  map: maplibregl.Map
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  sun: THREE.DirectionalLight
  private sky: Sky
  private renderer: THREE.WebGLRenderer | null = null
  private buildings = new THREE.Group()
  private roads = new THREE.Group()
  private trees: THREE.InstancedMesh | null = null
  private greenAreas: THREE.Mesh | null = null
  private buildingMat: THREE.MeshStandardMaterial
  private atmosphere = new AtmosphereConfig()
  private csm = new CascadedShadows()
  private postProcess: PostProcessing | null = null
  private terrainElevation: TerrainElevation | null = null
  private roadMat: THREE.MeshStandardMaterial
  private treeMat: THREE.MeshBasicMaterial
  private greenMat: THREE.MeshStandardMaterial
  private loader = new THREE.TextureLoader()
  private readyCbs: (() => void)[] = []
  private originMercator: [number, number] = [0, 0]
  private billboardDummy = new THREE.Object3D()
  private billboardMat = new THREE.Matrix4()

  constructor(private container: HTMLElement, center: [number, number] = [0, 0]) {
    this.originMercator = lngLatToMercator(center[0], center[1])

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0x9ec7e8, 120, 600)

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000)

    // Ambient light (soft fill)
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6))

    // Directional sun with shadows
    this.sun = new THREE.DirectionalLight(0xffffff, 1.2)
    this.sun.position.set(100, 100, 50)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 400
    this.sun.shadow.camera.left = -125
    this.sun.shadow.camera.right = 125
    this.sun.shadow.camera.top = 125
    this.sun.shadow.camera.bottom = -125
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    // Sky
    this.sky = new Sky()
    this.sky.scale.setScalar(10000)
    this.scene.add(this.sky)
    this.sky.material.uniforms['turbidity'].value = 10
    this.sky.material.uniforms['rayleigh'].value = 2
    this.sky.material.uniforms['mieCoefficient'].value = 0.005
    this.sky.material.uniforms['mieDirectionalG'].value = 0.8

    // Materials (textures loaded lazily; won't crash in jsdom because TextureLoader defers WebGL)
    const facadeTex = this.loadTex('./assets/building-facade.png')
    if (facadeTex) {
      facadeTex.wrapS = facadeTex.wrapT = THREE.RepeatWrapping
    }
    this.buildingMat = new THREE.MeshStandardMaterial({ map: facadeTex ?? undefined, roughness: 0.9, metalness: 0 })

    const roadTex = this.loadTex('./assets/road-asphalt.png')
    if (roadTex) {
      roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping
    }
    this.roadMat = new THREE.MeshStandardMaterial({ map: roadTex ?? undefined, roughness: 1, metalness: 0 })

    const treeTex = this.loadTex('./assets/tree-sprite.png')
    this.treeMat = new THREE.MeshBasicMaterial({ map: treeTex ?? undefined, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })

    this.greenMat = new THREE.MeshStandardMaterial({ color: 0x4a6b38, roughness: 1, metalness: 0 })

    // Ground (fallback for areas without OSM green data)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ color: 0x3a5228, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    this.scene.add(this.buildings)
    this.scene.add(this.roads)

    // Replace single sun DirectionalLight with CSM system
    if (this.scene.children.includes(this.sun)) {
      this.scene.remove(this.sun)
      this.scene.remove(this.sun.target)
    }
    this.csm.addToScene(this.scene)

    this.map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center,
      zoom: 17,
      pitch: 0,
    })
    this.map.on('load', () => {
      this.readyCbs.forEach(cb => cb())
    })
  }

  private loadTex(relPath: string): THREE.Texture {
    const fallback = new THREE.DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)
    fallback.needsUpdate = true
    try {
      const url = new URL(relPath, import.meta.url).href
      return this.loader.load(url, undefined, undefined, () => { /* silent on missing asset */ })
    } catch {
      return fallback
    }
  }

  onReady(cb: () => void) {
    this.readyCbs.push(cb)
  }

  setSunAngle(state: SunState): void {
    // Use atmosphere to drive sky/fog colors from sun elevation
    const atm = this.atmosphere.update(state.elevation)
    this.sky.material.uniforms['turbidity'].value = atm.turbidity
    this.sky.material.uniforms['rayleigh'].value = atm.rayleigh
    this.sky.material.uniforms['mieCoefficient'].value = atm.mieCoefficient
    this.sky.material.uniforms['mieDirectionalG'].value = atm.mieDirectionalG
    this.sky.material.uniforms['sunPosition'].value.copy(state.direction)
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(atm.fogColor)
    }
    // Update CSM shadow cascade lights
    this.csm.setIntensity(atm.sunIntensity)
    this.csm.setColor(atm.sunColor)
    this.csm.update(state.direction, this.camera)
  }

  setViewFromPlayer(playerPos: THREE.Vector3, yaw: number, pitch: number) {
    this.camera.position.copy(playerPos)
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ')
  }

  setBuildings(boxes: BoxCollider[]) {
    this.disposeGroup(this.buildings)
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.buildingMat.map ?? undefined,
      roughness: 0.85,
      metalness: 0.05,
    })
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x8b7d6b,
      roughness: 0.6,
      metalness: 0.1,
    })
    for (const b of boxes) {
      const sx = b.max.x - b.min.x
      const sy = b.max.y - b.min.y
      const sz = b.max.z - b.min.z
      const cx = (b.min.x + b.max.x) / 2
      const cz = (b.min.z + b.max.z) / 2
      // Create a square footprint centered at origin (mesh positioned at cx, min.y, cz)
      const half = Math.max(sx, sz) / 2
      const footprint: [number, number][] = [
        [-half, -half],
        [+half, -half],
        [+half, +half],
        [-half, +half],
      ]
      const spec: BuildingSpec = {
        footprint,
        height: sy,
        roofShape: 'flat',
      }
      const fullGeo = BuildingGeometry.generate(spec)
      // BuildingGeometry produces walls first (6 vertices per edge), then roof
      const ringLen = spec.footprint.length >= 2 &&
        spec.footprint[0][0] === spec.footprint[spec.footprint.length - 1][0] &&
        spec.footprint[0][1] === spec.footprint[spec.footprint.length - 1][1]
          ? spec.footprint.length - 1
          : spec.footprint.length
      const wallVertCount = 6 * ringLen
      const posAttr = fullGeo.getAttribute('position') as THREE.BufferAttribute
      const normAttr = fullGeo.getAttribute('normal') as THREE.BufferAttribute
      const uvAttr = fullGeo.getAttribute('uv') as THREE.BufferAttribute
      const totalVerts = posAttr.count
      // Walls mesh
      if (wallVertCount > 0) {
        const wallGeo = new THREE.BufferGeometry()
        wallGeo.setAttribute('position',
          new THREE.Float32BufferAttribute(posAttr.array.slice(0, wallVertCount * 3), 3))
        wallGeo.setAttribute('normal',
          new THREE.Float32BufferAttribute(normAttr.array.slice(0, wallVertCount * 3), 3))
        wallGeo.setAttribute('uv',
          new THREE.Float32BufferAttribute(uvAttr.array.slice(0, wallVertCount * 2), 2))
        const wallMesh = new THREE.Mesh(wallGeo, wallMat)
        wallMesh.position.set(cx, b.min.y, cz)
        wallMesh.castShadow = true
        wallMesh.receiveShadow = true
        this.buildings.add(wallMesh)
      }
      // Roof mesh
      const roofVertCount = totalVerts - wallVertCount
      if (roofVertCount > 0) {
        const roofGeo = new THREE.BufferGeometry()
        roofGeo.setAttribute('position',
          new THREE.Float32BufferAttribute(posAttr.array.slice(wallVertCount * 3), 3))
        roofGeo.setAttribute('normal',
          new THREE.Float32BufferAttribute(normAttr.array.slice(wallVertCount * 3), 3))
        roofGeo.setAttribute('uv',
          new THREE.Float32BufferAttribute(uvAttr.array.slice(wallVertCount * 2), 2))
        const roofMesh = new THREE.Mesh(roofGeo, roofMat)
        roofMesh.position.set(cx, b.min.y, cz)
        roofMesh.castShadow = true
        roofMesh.receiveShadow = true
        this.buildings.add(roofMesh)
      }
    }
  }

  setRoads(roads: RoadStrip[]): void {
    this.disposeGroup(this.roads)
    for (const strip of roads) {
      const [a, b, c, d] = strip.corners
      const geo = new THREE.BufferGeometry()
      // Two triangles: ABD and BCD
      const positions = new Float32Array([
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        d.x, d.y, d.z,
        b.x, b.y, b.z,
        c.x, c.y, c.z,
        d.x, d.y, d.z,
      ])
      // UV: tile along length, road width = 1 UV unit
      const uvLen = strip.uvLength / 4  // tile every 4 m
      const uvs = new Float32Array([
        0, 0,  1, 0,  0, uvLen,
        1, 0,  1, uvLen,  0, uvLen,
      ])
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      geo.computeVertexNormals()
      const mesh = new THREE.Mesh(geo, this.roadMat)
      mesh.receiveShadow = true
      this.roads.add(mesh)
    }
  }

  setTrees(positions: THREE.Vector3[]): void {
    if (this.trees) {
      this.trees.geometry.dispose()
      this.scene.remove(this.trees)
      this.trees = null
    }
    if (positions.length === 0) return
    const geo = new THREE.PlaneGeometry(6, 10)
    const mesh = new THREE.InstancedMesh(geo, this.treeMat, positions.length)
    mesh.castShadow = true
    const dummy = new THREE.Object3D()
    for (let i = 0; i < positions.length; i++) {
      dummy.position.copy(positions[i])
      dummy.position.y = 5  // center of 10 m tall plane
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    this.trees = mesh
    this.scene.add(this.trees)
  }

  setGreenAreas(triangles: Float32Array): void {
    if (this.greenAreas) {
      this.greenAreas.geometry.dispose()
      this.scene.remove(this.greenAreas)
      this.greenAreas = null
    }
    if (triangles.length === 0) return
    const vertCount = triangles.length / 2
    const pos = new Float32Array(vertCount * 3)
    const uvArr = new Float32Array(vertCount * 2)
    for (let i = 0; i < vertCount; i++) {
      const x = triangles[i * 2]
      const z = triangles[i * 2 + 1]
      pos[i * 3] = x
      pos[i * 3 + 1] = 0.01
      pos[i * 3 + 2] = z
      uvArr[i * 2] = x / 4
      uvArr[i * 2 + 1] = z / 4
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2))
    geo.computeVertexNormals()
    this.greenAreas = new THREE.Mesh(geo, this.greenMat)
    this.greenAreas.receiveShadow = true
    this.scene.add(this.greenAreas)
  }

  render() {
    if (!this.renderer) {
      const r = new THREE.WebGLRenderer({ antialias: true })
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      r.shadowMap.enabled = true
      r.shadowMap.type = THREE.PCFSoftShadowMap
      const canvas = r.domElement
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      this.container.appendChild(canvas)
      this.renderer = r
      // Create post-processing pipeline
      if (!this.postProcess) {
        this.postProcess = new PostProcessing(r, this.scene, this.camera)
      }
    }
    // Billboard trees: rotate each instance to face camera each frame
    if (this.trees) {
      const camPos = this.camera.position
      const dummy = this.billboardDummy
      const mat = this.billboardMat
      for (let i = 0; i < this.trees.count; i++) {
        this.trees.getMatrixAt(i, mat)
        dummy.matrix.copy(mat)
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
        dummy.lookAt(camPos.x, dummy.position.y, camPos.z)
        dummy.updateMatrix()
        this.trees.setMatrixAt(i, dummy.matrix)
      }
      this.trees.instanceMatrix.needsUpdate = true
    }
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    const size = this.renderer.getSize(new THREE.Vector2())
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
    if (this.postProcess && this.postProcess.composer) {
      this.postProcess.render(0)
    } else {
      this.renderer.render(this.scene, this.camera)
    }
  }

  localToMercator(localX: number, localZ: number, height = 0): THREE.Vector3 {
    return new THREE.Vector3(this.originMercator[0] + localX, height, this.originMercator[1] - localZ)
  }

  mercatorToLocal(mx: number, my: number): [number, number] {
    return [mx - this.originMercator[0], this.originMercator[1] - my]
  }

  lngLatToLocal(lng: number, lat: number): [number, number] {
    const [mx, my] = lngLatToMercator(lng, lat)
    return this.mercatorToLocal(mx, my)
  }

  localToLngLat(localX: number, localZ: number): [number, number] {
    const mx = this.originMercator[0] + localX
    const my = this.originMercator[1] - localZ
    return mercatorToLngLat(mx, my)
  }

  private disposeGroup(group: THREE.Group) {
    for (const m of group.children) {
      if (m instanceof THREE.Mesh) m.geometry.dispose()
    }
    group.clear()
  }

  dispose() {
    this.postProcess?.dispose()
    this.csm.dispose()
    this.disposeGroup(this.buildings)
    this.disposeGroup(this.roads)
    if (this.trees) { this.trees.geometry.dispose(); this.scene.remove(this.trees) }
    if (this.greenAreas) { this.greenAreas.geometry.dispose(); this.scene.remove(this.greenAreas) }
    this.renderer?.domElement.remove()
    this.renderer?.dispose()
    this.map.remove()
  }

  setPostProcessingPreset(preset: PostQuality): void {
    this.postProcess?.setQuality(preset)
  }

  getTerrainHeight(x: number, z: number): number {
    return this.terrainElevation?.getHeight(x, z) ?? 0
  }
}
