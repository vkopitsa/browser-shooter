import { describe, it, expect } from 'vitest'
import { GameSession } from '../../session/GameSession'
import { createLinkedTransports } from '../../session/Transport'
import { emptyInput, type NetMessage } from '../../session/protocol'
import { NetHost } from '../NetHost'

describe('NetHost', () => {
  it('registers a client, sends welcome, and applies its input', () => {
    const session = new GameSession()
    const host = new NetHost(session, { mode: 'coop', damagePolicy: 'team', fragLimit: 0 })
    const [hostSide, clientSide] = createLinkedTransports()
    const got: NetMessage[] = []
    clientSide.onMessage(m => got.push(m))

    host.addClient('player-2', 'Bob', hostSide)
    expect(got).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'welcome', playerId: 'player-2', mode: 'coop', config: expect.objectContaining({ mode: 'coop' }) })]))
    expect(session.playerIds()).toContain('player-2')

    clientSide.send({ type: 'input', playerId: 'player-2', input: { ...emptyInput(), forward: true } })
    const z0 = session.getPlayer('player-2')!.player.position.z
    host.tick(0.1)
    expect(session.getPlayer('player-2')!.player.position.z).toBeLessThan(z0)
  })

  it('tick broadcasts a snapshot to clients', () => {
    const session = new GameSession()
    const host = new NetHost(session, { mode: 'coop', damagePolicy: 'team', fragLimit: 0 })
    const [hostSide, clientSide] = createLinkedTransports()
    const got: NetMessage[] = []
    clientSide.onMessage(m => got.push(m))
    host.addClient('player-2', 'Bob', hostSide)

    host.tick(0.016)
    expect(got.some(m => m.type === 'snapshot')).toBe(true)
    const snap = got.find(m => m.type === 'snapshot')
    if (snap?.type === 'snapshot') {
      expect(snap.snapshot.ack).toBeDefined()
      expect(typeof snap.snapshot.ack).toBe('object')
    }
  })

  it('stamps ack on snapshots showing last processed input seq per player', () => {
    const session = new GameSession()
    const host = new NetHost(session, { mode: 'coop', damagePolicy: 'team', fragLimit: 0 })
    const [hostSide, clientSide] = createLinkedTransports()
    const got: NetMessage[] = []
    clientSide.onMessage(m => got.push(m))

    host.addClient('player-2', 'Bob', hostSide)
    clientSide.send({
      type: 'input', playerId: 'player-2',
      input: { ...emptyInput(), forward: true, seq: 5, renderTime: 100 }
    })
    host.tick(0.016)

    const snap = got.find(m => m.type === 'snapshot')
    expect(snap?.type).toBe('snapshot')
    if (snap?.type === 'snapshot') {
      expect(snap.snapshot.ack['player-2']).toBe(5)
    }
  })

  it('handles buy messages by applying item to the client player', () => {
    const session = new GameSession()
    const host = new NetHost(session, { mode: 'coop', damagePolicy: 'team', fragLimit: 0 })
    const [hostSide, clientSide] = createLinkedTransports()

    host.addClient('player-2', 'Bob', hostSide)
    const before = session.getPlayer('player-2')!.player.armor
    clientSide.send({ type: 'buy', playerId: 'player-2', item: 'kevlar' })
    const after = session.getPlayer('player-2')!.player.armor
    expect(after).toBeGreaterThan(before)
  })

  it('measures client ping from a pong and stamps it onto broadcast snapshots', () => {
    const session = new GameSession()
    const host = new NetHost(session, { mode: 'coop', damagePolicy: 'team', fragLimit: 0 })
    const [hostSide, clientSide] = createLinkedTransports()
    const got: NetMessage[] = []
    clientSide.onMessage(m => got.push(m))
    host.addClient('player-2', 'Bob', hostSide)

    // Host probes, client replies with a slightly-old timestamp → non-negative ping.
    host.pingClients()
    clientSide.send({ type: 'pong', t: performance.now() - 30 })

    host.tick(0.016)
    const snap = got.reverse().find(m => m.type === 'snapshot')
    expect(snap?.type).toBe('snapshot')
    if (snap?.type === 'snapshot') {
      const remote = snap.snapshot.players.find(p => p.id === 'player-2')
      expect(remote?.ping).toBeGreaterThanOrEqual(30)
      // The host itself is the authority, so its own latency is 0.
      const local = snap.snapshot.players.find(p => p.id === session.localId)
      expect(local?.ping).toBe(0)
    }
  })
})

describe('NetHost join policy', () => {
  it('passwordOk: open game accepts any password', () => {
    const host = new NetHost(new GameSession(), { mode: 'pvp', damagePolicy: 'team', fragLimit: 0, joinPolicy: 'free' })
    expect(host.passwordOk(undefined)).toBe(true)
    expect(host.passwordOk('whatever')).toBe(true)
  })

  it('passwordOk: protected game accepts only the matching password', () => {
    const host = new NetHost(new GameSession(), { mode: 'pvp', damagePolicy: 'team', fragLimit: 0, joinPolicy: 'free', password: 'hunter2' })
    expect(host.passwordOk('hunter2')).toBe(true)
    expect(host.passwordOk('nope')).toBe(false)
    expect(host.passwordOk(undefined)).toBe(false)
  })

  it('welcome reports started=false before startMatch', () => {
    const host = new NetHost(new GameSession(), { mode: 'pvp', damagePolicy: 'team', fragLimit: 0, joinPolicy: 'lobby' })
    const [h, c] = createLinkedTransports()
    const got: NetMessage[] = []; c.onMessage(m => got.push(m))
    host.addClient('player-2', 'Bob', h)
    const w = got.find(m => m.type === 'welcome')
    expect(w && w.type === 'welcome' && w.started).toBe(false)
  })

  it('free game already started sends a targeted start to a late joiner', () => {
    const host = new NetHost(new GameSession(), { mode: 'pvp', damagePolicy: 'team', fragLimit: 0, joinPolicy: 'free' })
    host.startMatch()
    const [h, c] = createLinkedTransports()
    const got: NetMessage[] = []; c.onMessage(m => got.push(m))
    host.addClient('player-3', 'Cara', h)
    expect(got.some(m => m.type === 'start')).toBe(true)
    const w = got.find(m => m.type === 'welcome')
    expect(w && w.type === 'welcome' && w.started).toBe(true)
  })

  it('lobby game already started does NOT auto-start a late joiner', () => {
    const host = new NetHost(new GameSession(), { mode: 'pvp', damagePolicy: 'team', fragLimit: 0, joinPolicy: 'lobby' })
    host.startMatch()
    const [h, c] = createLinkedTransports()
    const got: NetMessage[] = []; c.onMessage(m => got.push(m))
    got.length = 0 // ignore the broadcast start from startMatch (no client linked yet anyway)
    host.addClient('player-4', 'Dee', h)
    expect(got.some(m => m.type === 'start')).toBe(false)
  })
})
