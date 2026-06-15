import { describe, it, expect } from 'vitest'
import { GameSession } from '../GameSession'
import { emptyInput } from '../protocol'

describe('GameSession.step', () => {
  it('moves the player forward when input.forward is set', () => {
    const s = new GameSession()
    s.applyInput('local', { ...emptyInput(), forward: true })
    const z0 = s.player.position.z
    s.step(0.1)
    expect(s.player.position.z).toBeLessThan(z0) // -Z is forward
  })

  it('increments the tick each step', () => {
    const s = new GameSession()
    s.step(0.016)
    s.step(0.016)
    expect(s.tick).toBe(2)
  })

  it('is deterministic for identical inputs', () => {
    const run = () => {
      const s = new GameSession()
      s.applyInput('local', { ...emptyInput(), forward: true, right: true })
      for (let i = 0; i < 10; i++) s.step(0.016)
      return s.player.position.clone()
    }
    const a = run(); const b = run()
    expect(a.x).toBeCloseTo(b.x, 10)
    expect(a.z).toBeCloseTo(b.z, 10)
  })
})
