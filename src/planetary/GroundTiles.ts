import * as THREE from 'three'

// OSM raster ground underlay (streets-gl style): standard z/x/y tiles textured
// onto quads whose corners go through the engine's own projection, so they
// line up with buildings/roads by construction.
const ZOOM = 17
const RADIUS = 3 // 7x7 grid ≈ ±600 m at z17 mid-latitudes, matches fogFar

export function lngLatToTile(lng: number, lat: number, z = ZOOM): [number, number] {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return [x, y]
}

export function tileToLngLat(x: number, y: number, z = ZOOM): [number, number] {
  const n = 2 ** z
  const lng = (x / n) * 360 - 180
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI
  return [lng, lat]
}

export class GroundTiles {
  group = new THREE.Group()
  private tiles = new Map<string, THREE.Mesh>()
  private loader = new THREE.TextureLoader()
  private centerKey = ''

  constructor(
    private lngLatToLocal: (lng: number, lat: number) => [number, number],
    private heightAt: (lng: number, lat: number) => number = () => 0,
  ) {
    this.group.name = 'ground-tiles'
    this.loader.setCrossOrigin('anonymous')
  }

  /** Drop all tiles so the next update() rebuilds them (new elevation data arrived). */
  refresh(): void {
    for (const mesh of this.tiles.values()) {
      this.group.remove(mesh)
      this.disposeMesh(mesh)
    }
    this.tiles.clear()
    this.centerKey = ''
  }

  /** Rebuilds the tile grid around the given position. No-op until the center tile changes. */
  update(lng: number, lat: number): void {
    const [cx, cy] = lngLatToTile(lng, lat)
    const key = `${cx}/${cy}`
    if (key === this.centerKey) return
    this.centerKey = key
    const wanted = new Set<string>()
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      for (let dy = -RADIUS; dy <= RADIUS; dy++) {
        const k = `${cx + dx}/${cy + dy}`
        wanted.add(k)
        if (!this.tiles.has(k)) this.addTile(cx + dx, cy + dy)
      }
    }
    for (const [k, mesh] of this.tiles) {
      if (!wanted.has(k)) {
        this.group.remove(mesh)
        this.disposeMesh(mesh)
        this.tiles.delete(k)
      }
    }
  }

  private addTile(x: number, y: number): void {
    // Grid vertices go through the engine projection — the local frame is not
    // true web mercator, so a tile is a warped patch, not a rectangle. Neighbors
    // share exact edge lng/lats, so edges stay seam-free. Y comes from the DEM.
    const N = 8 // ~19 m vertex spacing at z17 — matches terrarium z13 resolution
    const verts = new Float32Array((N + 1) * (N + 1) * 3)
    const uvs = new Float32Array((N + 1) * (N + 1) * 2)
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const [lng, lat] = tileToLngLat(x + i / N, y + j / N)
        const [lx, lz] = this.lngLatToLocal(lng, lat)
        const k = j * (N + 1) + i
        verts[k * 3] = lx
        verts[k * 3 + 1] = this.heightAt(lng, lat)
        verts[k * 3 + 2] = lz
        // flipY default: v=1 samples the image top row = tile north edge
        uvs[k * 2] = i / N
        uvs[k * 2 + 1] = 1 - j / N
      }
    }
    const indices: number[] = []
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i // nw
        const b = a + N + 1 // sw
        const c = b + 1 // se
        const d = a + 1 // ne
        // CCW from above (+y normal): nw→sw→se, nw→se→ne
        indices.push(a, b, c, a, c, d)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    // Dark green until the texture arrives — matches the old fallback ground
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a5228, roughness: 1, metalness: 0 })
    try {
      this.loader.load(`https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`, tex => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 8 // three.js clamps to GPU max on upload
        mat.map = tex
        mat.color.set(0xffffff)
        mat.needsUpdate = true
      }, undefined, () => { /* tile fetch failed — keep fallback color */ })
    } catch { /* no Image in this env (tests) — fallback color quad */ }
    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    this.tiles.set(`${x}/${y}`, mesh)
    this.group.add(mesh)
  }

  private disposeMesh(mesh: THREE.Mesh): void {
    mesh.geometry.dispose()
    const mat = mesh.material as THREE.MeshStandardMaterial
    mat.map?.dispose()
    mat.dispose()
  }

  dispose(): void {
    for (const mesh of this.tiles.values()) this.disposeMesh(mesh)
    this.tiles.clear()
    this.group.clear()
  }
}
