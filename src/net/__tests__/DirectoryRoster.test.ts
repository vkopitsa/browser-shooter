import { describe, it, expect } from 'vitest'
import { DirectoryRoster } from '../DirectoryRoster'
import type { DirectoryEntry } from '../directoryProtocol'

const entry = (roomCode: string): DirectoryEntry => ({
  roomCode, hostName: 'Alice', players: 1, maxPlayers: 8, status: 'lobby',
})

describe('DirectoryRoster', () => {
  it('upsert adds an entry that list() returns without lastSeen', () => {
    const r = new DirectoryRoster()
    r.upsert(entry('ROOM1'), 1000)
    expect(r.list()).toEqual([entry('ROOM1')])
  })

  it('heartbeat refreshes lastSeen, players and status', () => {
    const r = new DirectoryRoster()
    r.upsert(entry('ROOM1'), 1000)
    r.heartbeat('ROOM1', 3, 'in-progress', 2000)
    expect(r.list()[0]).toMatchObject({ players: 3, status: 'in-progress' })
  })

  it('expire drops entries older than ttl, keeps fresh ones', () => {
    const r = new DirectoryRoster()
    r.upsert(entry('OLD'), 0)
    r.upsert(entry('NEW'), 9000)
    r.expire(15_000, 16_000) // OLD lastSeen 0 is 16s stale (>15s); NEW is 7s
    expect(r.list().map(e => e.roomCode)).toEqual(['NEW'])
  })

  it('remove deletes an entry', () => {
    const r = new DirectoryRoster()
    r.upsert(entry('ROOM1'), 1000)
    r.remove('ROOM1')
    expect(r.list()).toEqual([])
  })
})
