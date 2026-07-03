import { describe, it, expect } from 'vitest'
import { createLinkedChannels } from '../Channel'
import { DirectoryServer } from '../DirectoryServer'
import { DirectoryClient } from '../DirectoryClient'
import type { DirMessage, DirectoryEntry } from '../directoryProtocol'

const entry = (roomCode: string): DirectoryEntry => ({
  roomCode, hostName: 'Alice', players: 1, maxPlayers: 8, status: 'lobby',
})

/** Wire a fresh client to the given server over a linked channel pair. */
function connect(server: DirectoryServer): DirectoryClient {
  const [srv, cli] = createLinkedChannels<DirMessage>()
  server.accept(srv)
  return new DirectoryClient(cli)
}

describe('DirectoryServer + DirectoryClient', () => {
  it('a registered host appears in another client fetchList', async () => {
    const server = new DirectoryServer()
    connect(server).register(entry('ROOM1'))
    const entries = await connect(server).fetchList()
    expect(entries).toEqual([entry('ROOM1')])
  })

  it('heartbeat updates players/status seen by a fetch', async () => {
    const server = new DirectoryServer()
    const host = connect(server)
    host.register(entry('ROOM1'))
    host.heartbeat('ROOM1', 4, 'in-progress')
    const entries = await connect(server).fetchList()
    expect(entries[0]).toMatchObject({ players: 4, status: 'in-progress' })
  })

  it('unregister removes the entry', async () => {
    const server = new DirectoryServer()
    const host = connect(server)
    host.register(entry('ROOM1'))
    host.unregister('ROOM1')
    expect(await connect(server).fetchList()).toEqual([])
  })

  it('entries older than the TTL are expired on list', async () => {
    let clock = 0
    const server = new DirectoryServer(() => clock)
    connect(server).register(entry('ROOM1'))
    clock = 20_000 // past ENTRY_TTL_MS (15s)
    expect(await connect(server).fetchList()).toEqual([])
  })

  it('fetchList resolves [] if no response arrives before timeout', async () => {
    const dead = createLinkedChannels<DirMessage>()[1] // nothing accepts the other end
    const entries = await new DirectoryClient(dead).fetchList(10)
    expect(entries).toEqual([])
  })

  it('one client can poll fetchList repeatedly (menu picker keeps its dial open)', async () => {
    const server = new DirectoryServer()
    const host = connect(server)
    const browser = connect(server)
    expect(await browser.fetchList()).toEqual([])
    host.register(entry('ROOM1'))
    expect(await browser.fetchList()).toEqual([entry('ROOM1')])
    host.unregister('ROOM1')
    expect(await browser.fetchList()).toEqual([])
  })
})
