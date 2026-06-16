import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HostDirectory } from '../HostDirectory'
import { DirectoryServer } from '../DirectoryServer'
import { DirectoryClient } from '../DirectoryClient'
import { createLinkedChannels } from '../Channel'
import { HEARTBEAT_MS, type DirMessage, type DirectoryEntry } from '../directoryProtocol'

const entry: DirectoryEntry = { roomCode: 'ROOM1', hostName: 'Alice', players: 1, maxPlayers: 8, status: 'lobby' }

/** A shared server plus a factory that wires fresh clients to it over linked channels. */
function harness() {
  const server = new DirectoryServer()
  const connect = () => {
    const [srv, cli] = createLinkedChannels<DirMessage>()
    server.accept(srv)
    return new DirectoryClient(cli)
  }
  return { server, connect }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('HostDirectory', () => {
  it('registers the entry on start (non-elected path dials the directory)', async () => {
    const { connect } = harness()
    const elect = vi.fn().mockResolvedValue({ server: null, peer: null })
    const dial = vi.fn().mockResolvedValue({ client: connect(), peer: null })
    const hd = new HostDirectory(elect, dial)
    await hd.start(entry)
    expect(await connect().fetchList()).toEqual([entry])
  })

  it('heartbeats updated players/status on the interval', async () => {
    const { connect } = harness()
    const hd = new HostDirectory(
      vi.fn().mockResolvedValue({ server: null, peer: null }),
      vi.fn().mockResolvedValue({ client: connect(), peer: null }),
    )
    await hd.start({ ...entry })
    hd.setPlayers(3)
    hd.setStatus('in-progress')
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS)
    expect((await connect().fetchList())[0]).toMatchObject({ players: 3, status: 'in-progress' })
  })

  it('stop() unregisters the entry', async () => {
    const { connect } = harness()
    const hd = new HostDirectory(
      vi.fn().mockResolvedValue({ server: null, peer: null }),
      vi.fn().mockResolvedValue({ client: connect(), peer: null }),
    )
    await hd.start({ ...entry })
    hd.stop()
    expect(await connect().fetchList()).toEqual([])
  })
})
