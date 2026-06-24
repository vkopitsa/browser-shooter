import { describe, it, expect } from 'vitest'
import { createSeed } from './generator'

describe('createSeed', () => {
  it('creates a seed with deterministic output', () => {
    const seed1 = createSeed(12345)
    const seed2 = createSeed(12345)
    expect(seed1.next()).toBe(seed2.next())
    expect(seed1.nextInt(0, 100)).toBe(seed2.nextInt(0, 100))
  })

  it('produces different output for different seeds', () => {
    const seed1 = createSeed(11111)
    const seed2 = createSeed(99999)
    const results1 = Array.from({ length: 10 }, () => seed1.next())
    const seed1b = createSeed(11111)
    const results1b = Array.from({ length: 10 }, () => seed1b.next())
    const results2 = Array.from({ length: 10 }, () => seed2.next())
    expect(results1).toEqual(results1b)
    expect(results1).not.toEqual(results2)
  })

  it('next() returns values between 0 and 1', () => {
    const seed = createSeed(Date.now())
    for (let i = 0; i < 100; i++) {
      const val = seed.next()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  it('nextInt() returns integers within range', () => {
    const seed = createSeed(Date.now())
    for (let i = 0; i < 100; i++) {
      const val = seed.nextInt(5, 15)
      expect(val).toBeGreaterThanOrEqual(5)
      expect(val).toBeLessThanOrEqual(15)
      expect(Number.isInteger(val)).toBe(true)
    }
  })
})
