import { medianLngLat, lngLatDistance } from './geoUtils'

export class RoundBoundary {
  private _center: [number, number] = [0, 0]

  constructor(
    private warnMeters = 600,
    private killMeters = 700,
  ) {}

  update(playerPositions: [number, number][]) {
    if (playerPositions.length > 0) this._center = medianLngLat(playerPositions)
  }

  check(lng: number, lat: number): 'safe' | 'warn' | 'out' {
    const d = lngLatDistance(lng, lat, this._center[0], this._center[1])
    if (d >= this.killMeters) return 'out'
    if (d >= this.warnMeters) return 'warn'
    return 'safe'
  }

  get center(): [number, number] { return this._center }
}
