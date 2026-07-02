// Terrain relief from AWS terrarium raster DEM tiles (open data, no API key):
// height_m = R*256 + G + B/256 - 32768. Heights are returned relative to the
// elevation at the map center, so world Y=0 stays the spawn-area ground level
// and the flat-world logic elsewhere keeps working unmodified.
const ZOOM = 13 // ~19 m/px at z13 — matches the ~30 m SRTM source resolution
const SIZE = 256

export function decodeTerrarium(rgba: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(rgba.length / 4)
  for (let i = 0; i < out.length; i++) {
    out[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768
  }
  return out
}

/** Fractional web-mercator tile coordinates at {@link ZOOM}. */
function tileCoords(lng: number, lat: number): [number, number] {
  const n = 2 ** ZOOM
  const x = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return [x, y]
}

export class Elevation {
  /** Fired whenever a DEM tile finishes decoding — sampled heights may change. */
  onChange: (() => void) | null = null
  /** Lowest loaded elevation relative to base — the fallback ground plane sinks to this. */
  min = 0

  private tiles = new Map<string, Float32Array | null>() // null = in flight or failed
  private base = 0
  private baseSet = false
  private center: [number, number] | null = null

  setCenter(lng: number, lat: number): void {
    this.center = [lng, lat]
    this.heightAt(lng, lat) // kicks off the center tile fetch
  }

  /** Terrain height (m) relative to the center's elevation. 0 until data arrives. */
  heightAt(lng: number, lat: number): number {
    const [fx, fy] = tileCoords(lng, lat)
    const tx = Math.floor(fx)
    const ty = Math.floor(fy)
    const key = `${tx}/${ty}`
    if (!this.tiles.has(key)) {
      this.tiles.set(key, null)
      void this.fetchTile(tx, ty, key)
    }
    const data = this.tiles.get(key)
    if (!data || !this.baseSet) return 0
    return this.sample(data, fx - tx, fy - ty) - this.base
  }

  // ponytail: bilinear clamped within one tile — up to a half-pixel step at
  // terrarium tile borders (well under 1 m); cross-tile stitching if it ever shows.
  private sample(data: Float32Array, u: number, v: number): number {
    const px = Math.min(Math.max(u * SIZE - 0.5, 0), SIZE - 1)
    const py = Math.min(Math.max(v * SIZE - 0.5, 0), SIZE - 1)
    const x0 = Math.floor(px)
    const y0 = Math.floor(py)
    const x1 = Math.min(x0 + 1, SIZE - 1)
    const y1 = Math.min(y0 + 1, SIZE - 1)
    const ax = px - x0
    const ay = py - y0
    const top = data[y0 * SIZE + x0] * (1 - ax) + data[y0 * SIZE + x1] * ax
    const bot = data[y1 * SIZE + x0] * (1 - ax) + data[y1 * SIZE + x1] * ax
    return top * (1 - ay) + bot * ay
  }

  private async fetchTile(tx: number, ty: number, key: string): Promise<void> {
    try {
      const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${tx}/${ty}.png`)
      if (!res.ok) return // stays flat — same degradation as a missing OSM tile
      const bmp = await createImageBitmap(await res.blob())
      const canvas = new OffscreenCanvas(SIZE, SIZE)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bmp, 0, 0)
      const data = decodeTerrarium(ctx.getImageData(0, 0, SIZE, SIZE).data)
      this.tiles.set(key, data)
      if (!this.baseSet && this.center) {
        const [cx, cy] = tileCoords(this.center[0], this.center[1])
        if (Math.floor(cx) === tx && Math.floor(cy) === ty) {
          this.base = this.sample(data, cx - tx, cy - ty)
          this.baseSet = true
        }
      }
      if (this.baseSet) {
        let lo = Infinity
        for (const d of data) if (d < lo) lo = d
        this.min = Math.min(this.min, lo - this.base)
      }
      this.onChange?.()
    } catch { /* no fetch/canvas (tests) or network error — terrain stays flat */ }
  }
}
