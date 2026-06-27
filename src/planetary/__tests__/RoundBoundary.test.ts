import { describe, it, expect } from 'vitest'
import { RoundBoundary } from '../RoundBoundary'

describe('RoundBoundary', () => {
  it('center defaults to first update median', () => {
    const rb = new RoundBoundary()
    rb.update([[0, 0], [0.002, 0]])
    const [lng] = rb.center
    expect(lng).toBeCloseTo(0.001, 3)
  })

  it('returns safe when inside warn radius', () => {
    const rb = new RoundBoundary(600, 700)
    rb.update([[0, 0]])
    expect(rb.check(0, 0)).toBe('safe')
  })

  it('returns warn between 600m and 700m', () => {
    const rb = new RoundBoundary(600, 700)
    rb.update([[0, 0]])
    // ~0.0054 degrees lat ≈ 600m
    expect(rb.check(0, 0.006)).toBe('warn')
  })

  it('returns out beyond 700m', () => {
    const rb = new RoundBoundary(600, 700)
    rb.update([[0, 0]])
    expect(rb.check(0, 0.01)).toBe('out')
  })
})
