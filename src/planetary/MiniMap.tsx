import { useEffect, useRef } from 'react'

export interface MiniMapData {
  lng: number
  lat: number
  /** Radians, clockwise from north. */
  heading: number
  players: { lng: number; lat: number; team?: string }[]
}

const ZOOM = 16
const TILE = 256

// ponytail: unbounded module-level tile cache — one zoom level, ~a few dozen
// tiles per session; add an LRU if memory ever matters.
const tileCache = new Map<string, HTMLImageElement>()

function tileImage(x: number, y: number): HTMLImageElement | null {
  const key = `${x}/${y}`
  let img = tileCache.get(key)
  if (!img) {
    img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`
    tileCache.set(key, img)
  }
  return img.complete && img.naturalWidth > 0 ? img : null
}

/** Circular north-up OSM minimap: local player as a heading arrow at the
    center, other players as team-colored dots (clamped to the rim when far). */
export function MiniMap({ getData, size = 160 }: { getData: () => MiniMapData | null; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr

    const draw = () => {
      const data = getData()
      if (!data) return
      const scale = TILE * 2 ** ZOOM
      const toPx = (lng: number, lat: number): [number, number] => {
        const rad = (lat * Math.PI) / 180
        return [
          ((lng + 180) / 360) * scale,
          ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale,
        ]
      }
      const [cxRaw, cyRaw] = toPx(data.lng, data.lat)
      const cx = Math.round(cxRaw)
      const cy = Math.round(cyRaw)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      ctx.save()
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = '#1a2634'
      ctx.fillRect(0, 0, size, size)

      const x0 = Math.floor((cx - size / 2) / TILE)
      const x1 = Math.floor((cx + size / 2) / TILE)
      const y0 = Math.floor((cy - size / 2) / TILE)
      const y1 = Math.floor((cy + size / 2) / TILE)
      for (let tx = x0; tx <= x1; tx++) {
        for (let ty = y0; ty <= y1; ty++) {
          const img = tileImage(tx, ty)
          if (img) ctx.drawImage(img, tx * TILE - cx + size / 2, ty * TILE - cy + size / 2)
        }
      }

      // Other players — far ones stick to the rim so you always see a bearing.
      for (const p of data.players) {
        const [px, py] = toPx(p.lng, p.lat)
        const dx = px - cx
        const dy = py - cy
        const dist = Math.hypot(dx, dy)
        const max = size / 2 - 8
        const k = dist > max ? max / dist : 1
        ctx.beginPath()
        ctx.arc(size / 2 + dx * k, size / 2 + dy * k, 4, 0, Math.PI * 2)
        ctx.fillStyle = p.team === 't' ? '#a5703a' : '#3a6ea5'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Local player: arrow at the center, rotated to view heading.
      ctx.translate(size / 2, size / 2)
      ctx.rotate(data.heading)
      ctx.beginPath()
      ctx.moveTo(0, -9)
      ctx.lineTo(6, 7)
      ctx.lineTo(0, 3)
      ctx.lineTo(-6, 7)
      ctx.closePath()
      ctx.fillStyle = '#00ff88'
      ctx.fill()
      ctx.strokeStyle = '#003322'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()
    }

    draw()
    // ponytail: 150ms repaint instead of rAF — plenty smooth for a minimap and
    // keeps the (perf-sensitive) planetary render loop untouched.
    const id = setInterval(draw, 150)
    return () => clearInterval(id)
  }, [getData, size])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 12, right: 12, width: size, height: size,
        borderRadius: '50%', border: '2px solid rgba(255,255,255,0.55)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.55)', background: '#1a2634',
        zIndex: 60, pointerEvents: 'none',
      }}
    />
  )
}
