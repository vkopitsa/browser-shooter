import type maplibregl from 'maplibre-gl'
import { emptyInput, type PlayerInput } from '../session/protocol'

const MOUSE_SENSITIVITY = 0.3  // degrees per pixel
const PITCH_MIN = 0
const PITCH_MAX = 85

export class GeoControls {
  private keys = new Set<string>()
  private bearing: number
  private pitch: number
  private attached = false

  constructor(
    private map: Pick<maplibregl.Map, 'getCenter' | 'setCenter' | 'setBearing' | 'setPitch' | 'getBearing' | 'getPitch'>,
    private container: HTMLElement,
  ) {
    this.bearing = (map.getBearing as () => number)()
    this.pitch = (map.getPitch as () => number)()
  }

  attach() {
    if (this.attached) return
    this.attached = true
    this.container.addEventListener('keydown', this.onKeyDown)
    this.container.addEventListener('keyup', this.onKeyUp)
    this.container.addEventListener('mousemove', this.onMouseMove)
  }

  detach() {
    if (!this.attached) return
    this.attached = false
    this.container.removeEventListener('keydown', this.onKeyDown)
    this.container.removeEventListener('keyup', this.onKeyUp)
    this.container.removeEventListener('mousemove', this.onMouseMove)
    this.keys.clear()
  }

  getBearing(): number { return this.bearing }
  getPitch(): number { return this.pitch }

  getInput(): PlayerInput {
    return {
      ...emptyInput(),
      forward: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      backward: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
    }
  }

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code)
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code)

  private onMouseMove = (e: MouseEvent) => {
    const movementX = e.movementX ?? 0
    const movementY = e.movementY ?? 0
    this.bearing = ((this.bearing + movementX * MOUSE_SENSITIVITY) + 360) % 360
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch - movementY * MOUSE_SENSITIVITY))
    this.map.setBearing(this.bearing)
    this.map.setPitch(this.pitch)
  }


}
