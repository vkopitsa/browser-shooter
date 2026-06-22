import { describe, it, expect, vi } from 'vitest'
import { findMatch } from '../Matchmaker'
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
