import { describe, it, expect } from 'vitest'
import { decodeTerrarium } from '../Elevation'

describe('decodeTerrarium', () => {
  it('decodes terrarium RGB to meters', () => {
    // 100 m → 32868 = 128*256 + 100 → R=128, G=100, B=0
    const px = new Uint8ClampedArray([128, 100, 0, 255])
    expect(decodeTerrarium(px)[0]).toBe(100)
  })

  it('decodes below-sea-level and fractional heights', () => {
    // -10.5 m → 32757.5 = 127*256 + 245 + 128/256
    const px = new Uint8ClampedArray([127, 245, 128, 255])
    expect(decodeTerrarium(px)[0]).toBeCloseTo(-10.5)
  })
})
