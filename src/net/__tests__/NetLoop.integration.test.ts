import { describe, it, expect } from 'vitest'
import { GameSession } from '../../session/GameSession'
import { createLinkedTransports } from '../../session/Transport'
import { emptyInput } from '../../session/protocol'
import { NetHost } from '../NetHost'
import { NetClient } from '../NetClient'

describe('NetHost + NetClient integration (M2)', () => {
  it("client's movement appears in snapshot with ack field", () => {
    const session = new GameSession()
    const host = new NetHost(session, { mode: 'coop', damagePolicy: 'team', fragLimit: 0 })
    const [hostSide, clientSide] = createLinkedTransports()

    const client = new NetClient(clientSide)
    client.join('Bob')
    host.addClient('player-2', 'Bob', hostSide)

    for (let i = 0; i < 10; i++) {
      client.sendInput({ ...emptyInput(), forward: true })
      host.tick(1 / 30)
    }

    const snap = client.latestSnapshot!
    const me = snap.players.find(p => p.id === 'player-2')!
    expect(me.position.z).toBeLessThan(0)
    expect(snap.ack['player-2']).toBeGreaterThan(0)
    expect(snap.seq).toBeGreaterThan(0)
  })

  it('client receives events from snapshot', () => {
    const session = new GameSession()
    const host = new NetHost(session, { mode: 'coop', damagePolicy: 'team', fragLimit: 0 })
    const [hostSide, clientSide] = createLinkedTransports()

    const client = new NetClient(clientSide)
    client.join('Bob')
    host.addClient('player-2', 'Bob', hostSide)

    const events: any[] = []
    client.onEvent(ev => events.push(ev))

    host.tick(1 / 30)

    // Snapshot should have events array (may be empty if nothing happened)
    expect(client.latestSnapshot).not.toBeNull()
    expect(client.latestSnapshot!.events).toBeDefined()
  })
})
