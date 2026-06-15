import { describe, it, expect } from 'vitest'
import { GameSession } from '../GameSession'

describe('GameSession players map', () => {
  it('seeds exactly the local player', () => {
    const s = new GameSession()
    expect(s.playerIds()).toEqual([s.localId])
  })

  it('player/weaponManager getters point at the local entity', () => {
    const s = new GameSession()
    expect(s.player).toBe(s.getPlayer(s.localId)!.player)
    expect(s.weaponManager).toBe(s.getPlayer(s.localId)!.weapons)
  })
})
