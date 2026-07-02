import { describe, it, expect, vi } from 'vitest'
import { findMatch, findPlanetaryMatch } from '../Matchmaker'
import type { DirectoryClient } from '../DirectoryClient'

const clientWith = (list: unknown[]) =>
  ({ fetchList: vi.fn().mockResolvedValue(list) }) as unknown as DirectoryClient

describe('findMatch', () => {
  it('returns null when no servers available', async () => {
    expect(await findMatch(clientWith([]))).toBeNull()
  })

  it('skips full and in-progress servers', async () => {
    const result = await findMatch(clientWith([
      { roomCode: 'full', players: 8, maxPlayers: 8, status: 'lobby', mode: 'competitive' },
      { roomCode: 'playing', players: 4, maxPlayers: 8, status: 'in-progress', mode: 'competitive' },
      { roomCode: 'open', players: 2, maxPlayers: 8, status: 'lobby', mode: 'competitive' },
    ]))
    expect(result!.roomCode).toBe('open')
  })

  it('filters by mode and prefers fuller servers', async () => {
    const result = await findMatch(clientWith([
      { roomCode: 'coop', players: 6, maxPlayers: 8, status: 'lobby', mode: 'coop' },
      { roomCode: 'empty', players: 1, maxPlayers: 8, status: 'lobby', mode: 'competitive' },
      { roomCode: 'fuller', players: 5, maxPlayers: 8, status: 'lobby', mode: 'competitive' },
    ]), 'competitive')
    expect(result!.roomCode).toBe('fuller')
  })
})

describe('findPlanetaryMatch', () => {
  const paris: [number, number] = [2.3522, 48.8566]
  const room = (roomCode: string, over: Record<string, unknown> = {}) => ({
    roomCode, players: 1, maxPlayers: 8, status: 'in-progress', joinPolicy: 'free',
    planetaryCenter: paris, ...over,
  })

  it('returns the closest open drop-in room at the same spot', async () => {
    const result = await findPlanetaryMatch(clientWith([
      room('far', { planetaryCenter: [2.40, 48.86] }),      // ~3.5 km away — different world
      room('close', { planetaryCenter: [2.353, 48.857] }),  // ~70 m away — same spot
    ]), paris)
    expect(result!.roomCode).toBe('close')
  })

  it('skips full, protected, lobby-policy, and non-planetary rooms', async () => {
    const result = await findPlanetaryMatch(clientWith([
      room('full', { players: 8 }),
      room('locked', { protected: true }),
      room('lobbyPolicy', { joinPolicy: 'lobby' }),
      { roomCode: 'arena', players: 1, maxPlayers: 8, status: 'lobby', joinPolicy: 'free' },
    ]), paris)
    expect(result).toBeNull()
  })
})
