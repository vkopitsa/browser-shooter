import * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

export interface BuildingSpec {
  footprint: [number, number][]
  height: number
  minHeight?: number
  roofShape: string
  roofHeight?: number
  roofAngle?: number
}

function addVertex(
  positions: number[],
  normals: number[],
  uvs: number[],
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  u: number, v: number,
): void {
  positions.push(x, y, z)
  normals.push(nx, ny, nz)
  uvs.push(u, v)
}

function addTriangle3D(
  positions: number[],
  normals: number[],
  uvs: number[],
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): void {
  // Compute face normal from cross product (b-a) × (c-a)
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2]
  const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2]
  let nx = aby * acz - abz * acy
  let ny = abz * acx - abx * acz
  let nz = abx * acy - aby * acx
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
  if (len > 0) {
    nx /= len
    ny /= len
    nz /= len
  }
  addVertex(positions, normals, uvs, a[0], a[1], a[2], nx, ny, nz, 0, 0)
  addVertex(positions, normals, uvs, b[0], b[1], b[2], nx, ny, nz, 1, 0)
  addVertex(positions, normals, uvs, c[0], c[1], c[2], nx, ny, nz, 0, 1)
}

function centroid2D(ring: [number, number][], n: number): [number, number] {
  let cx = 0, cz = 0
  for (let i = 0; i < n; i++) {
    cx += ring[i][0]
    cz += ring[i][1]
  }
  return [cx / n, cz / n]
}

function addGableRoof(
  positions: number[],
  normals: number[],
  uvs: number[],
  ring: [number, number][],
  n: number,
  topY: number,
  ridgeY: number,
  ridgeDir: [number, number],
): void {
  // Project all vertices onto ridge direction to find extremes
  let minProj = Infinity
  let maxProj = -Infinity
  const projs: number[] = []
  for (let i = 0; i < n; i++) {
    const proj = ring[i][0] * ridgeDir[0] + ring[i][1] * ridgeDir[1]
    projs.push(proj)
    if (proj < minProj) minProj = proj
    if (proj > maxProj) maxProj = proj
  }

  // Ridge endpoints in 3D
  const ridgeStart: [number, number, number] = [
    minProj * ridgeDir[0], ridgeY, minProj * ridgeDir[1],
  ]
  const ridgeEnd: [number, number, number] = [
    maxProj * ridgeDir[0], ridgeY, maxProj * ridgeDir[1],
  ]
  const midProj = (minProj + maxProj) / 2

  for (let i = 0; i < n; i++) {
    const v1 = ring[i]
    const v2 = ring[(i + 1) % n]
    const proj1 = projs[i]
    const proj2 = projs[(i + 1) % n]

    const v1Top: [number, number, number] = [v1[0], topY, v1[1]]
    const v2Top: [number, number, number] = [v2[0], topY, v2[1]]

    // Both vertices on same side of the ridge midpoint -> triangle to nearest endpoint
    // Vertices span the ridge -> quadrilateral connecting to ridge line
    const side1 = proj1 < midProj ? -1 : 1
    const side2 = proj2 < midProj ? -1 : 1

    if (side1 === side2) {
      // Triangle to nearest ridge endpoint
      const ridgePt = side1 < 0 ? ridgeStart : ridgeEnd
      addTriangle3D(positions, normals, uvs, v1Top, v2Top, ridgePt)
    } else {
      // Edge crosses the ridge — two triangles forming a quad
      // Find the intersection point along the edge at the ridge line
      const t = (midProj - proj1) / (proj2 - proj1)
      const ix = v1[0] + t * (v2[0] - v1[0])
      const iz = v1[1] + t * (v2[1] - v1[1])
      const intersect: [number, number, number] = [ix, topY, iz]
      const ridgeIntersect: [number, number, number] = [ix, ridgeY, iz]

      // Triangle 1: v1Top → intersect → ridgeStart/End
      const rp1 = side1 < 0 ? ridgeStart : ridgeEnd
      addTriangle3D(positions, normals, uvs, v1Top, intersect, rp1)
      // Triangle 2: v1Top → rp1 → ridgeIntersect
      addTriangle3D(positions, normals, uvs, v1Top, rp1, ridgeIntersect)
      // Triangle 3: intersect → v2Top → ridgeEnd/Start
      const rp2 = side2 < 0 ? ridgeStart : ridgeEnd
      addTriangle3D(positions, normals, uvs, intersect, v2Top, rp2)
      // Triangle 4: intersect → rp2 → ridgeIntersect  (redundant, keep simple)
      // Actually let me simplify: just split the edge at the ridge
      addTriangle3D(positions, normals, uvs, intersect, v2Top, rp2)
      addTriangle3D(positions, normals, uvs, intersect, rp2, ridgeIntersect)
    }
  }
}

function addHippedRoof(
  positions: number[],
  normals: number[],
  uvs: number[],
  ring: [number, number][],
  n: number,
  topY: number,
  ridgeY: number,
): void {
  const [cx, cz] = centroid2D(ring, n)

  // Inset vertices toward centroid by factor 0.7
  const inset: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    const ix = cx + 0.7 * (ring[i][0] - cx)
    const iz = cz + 0.7 * (ring[i][1] - cz)
    inset.push([ix, ridgeY, iz])
  }

  // For each edge, create a quad (2 triangles) from edge(topY) to inset edge(ridgeY)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const v1Top: [number, number, number] = [ring[i][0], topY, ring[i][1]]
    const v2Top: [number, number, number] = [ring[j][0], topY, ring[j][1]]
    const v1Inset = inset[i]
    const v2Inset = inset[j]

    // Triangle 1: v1Top → v2Top → v1Inset
    addTriangle3D(positions, normals, uvs, v1Top, v2Top, v1Inset)
    // Triangle 2: v2Top → v2Inset → v1Inset
    addTriangle3D(positions, normals, uvs, v2Top, v2Inset, v1Inset)
  }

  // Flat top cap: fan triangulation of inset polygon
  for (let i = 1; i < n - 1; i++) {
    addTriangle3D(positions, normals, uvs, inset[0], inset[i], inset[i + 1])
  }
}

function addPyramidalRoof(
  positions: number[],
  normals: number[],
  uvs: number[],
  ring: [number, number][],
  n: number,
  topY: number,
  ridgeY: number,
): void {
  const [cx, cz] = centroid2D(ring, n)
  const apex: [number, number, number] = [cx, ridgeY, cz]

  // For each edge, create a triangle from edge(topY) to apex(ridgeY)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const v1Top: [number, number, number] = [ring[i][0], topY, ring[i][1]]
    const v2Top: [number, number, number] = [ring[j][0], topY, ring[j][1]]
    addTriangle3D(positions, normals, uvs, v1Top, v2Top, apex)
  }
}

export class BuildingGeometry {
  static generate(spec: BuildingSpec): THREE.BufferGeometry {
    // 1. Process footprint: strip duplicate-first ring closure
    let ring = spec.footprint
    if (ring.length >= 2) {
      const first = ring[0]
      const last = ring[ring.length - 1]
      if (first[0] === last[0] && first[1] === last[1]) {
        ring = ring.slice(0, -1)
      }
    }

    // 2. Validate: at least 3 vertices
    if (ring.length < 3) {
      throw new Error('Footprint must have at least 3 unique vertices')
    }

    const minHeight = spec.minHeight ?? PLANETARY_CONFIG.building.minHeight
    if (spec.height < minHeight) {
      throw new Error(`Building height must be at least ${minHeight}`)
    }

    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    const groundY = 0
    const topY = spec.height
    const n = ring.length

    // 3. Build wall quads for each edge
    for (let i = 0; i < n; i++) {
      const p1 = ring[i]
      const p2 = ring[(i + 1) % n]
      const dx = p2[0] - p1[0]
      const dz = p2[1] - p1[1]
      const edgeLen = Math.sqrt(dx * dx + dz * dz)

      // Normal perpendicular to edge in XZ plane
      const nx = dz / edgeLen
      const nz = -dx / edgeLen
      const ny = 0

      const uLen = edgeLen / 4
      const vH = topY / 4

      // Triangle 1: bottom-left, bottom-right, top-left
      addVertex(positions, normals, uvs, p1[0], groundY, p1[1], nx, ny, nz, 0, 0)
      addVertex(positions, normals, uvs, p2[0], groundY, p2[1], nx, ny, nz, uLen, 0)
      addVertex(positions, normals, uvs, p1[0], topY, p1[1], nx, ny, nz, 0, vH)

      // Triangle 2: bottom-right, top-right, top-left
      addVertex(positions, normals, uvs, p2[0], groundY, p2[1], nx, ny, nz, uLen, 0)
      addVertex(positions, normals, uvs, p2[0], topY, p2[1], nx, ny, nz, uLen, vH)
      addVertex(positions, normals, uvs, p1[0], topY, p1[1], nx, ny, nz, 0, vH)
    }

    // 4. Roof
    const roofHeight = spec.roofHeight ?? 0
    const hasRoof = spec.roofShape !== 'flat' && roofHeight > 0

    if (hasRoof) {
      // Cap roof height to 50% of building height
      const actualRoofH = Math.min(roofHeight, spec.height * 0.5)
      const ridgeY = topY - actualRoofH

      // Find longest edge direction for ridge
      let maxLen = 0
      let ridgeDir: [number, number] = [1, 0]
      for (let i = 0; i < n; i++) {
        const p1 = ring[i]
        const p2 = ring[(i + 1) % n]
        const dx = p2[0] - p1[0]
        const dz = p2[1] - p1[1]
        const len = Math.sqrt(dx * dx + dz * dz)
        if (len > maxLen) {
          maxLen = len
          ridgeDir = [dx / len, dz / len]
        }
      }

      switch (spec.roofShape) {
        case 'gabled':
          addGableRoof(positions, normals, uvs, ring, n, topY, ridgeY, ridgeDir)
          break
        case 'hipped':
          addHippedRoof(positions, normals, uvs, ring, n, topY, ridgeY)
          break
        case 'pyramidal':
          addPyramidalRoof(positions, normals, uvs, ring, n, topY, ridgeY)
          break
        default:
          // Unknown shape — fall back to flat roof
          addFlatRoof(positions, normals, uvs, ring, n, topY)
          break
      }
    } else {
      // Flat roof
      addFlatRoof(positions, normals, uvs, ring, n, topY)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    return geo
  }
}

function addFlatRoof(
  positions: number[],
  normals: number[],
  uvs: number[],
  ring: [number, number][],
  n: number,
  topY: number,
): void {
  const roofNormalNx = 0
  const roofNormalNy = 1
  const roofNormalNz = 0

  // Fan triangulation from vertex 0
  for (let i = 1; i < n - 1; i++) {
    const p0 = ring[0]
    const pa = ring[i]
    const pb = ring[i + 1]

    addVertex(positions, normals, uvs, p0[0], topY, p0[1], roofNormalNx, roofNormalNy, roofNormalNz, p0[0] / 4, p0[1] / 4)
    addVertex(positions, normals, uvs, pa[0], topY, pa[1], roofNormalNx, roofNormalNy, roofNormalNz, pa[0] / 4, pa[1] / 4)
    addVertex(positions, normals, uvs, pb[0], topY, pb[1], roofNormalNx, roofNormalNy, roofNormalNz, pb[0] / 4, pb[1] / 4)
  }
}
