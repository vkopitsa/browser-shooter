import { describe, it, expect, vi } from 'vitest'
import { NetHost } from './NetHost'
import { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { NetMessage, VoiceRosterEntry } from '../session/protocol'

function fakeTransport() {
  let handler: ((m: NetMessage) => void) | null = null
  const sent: NetMessage[] = []
  const t: Transport = {
    send: (m: NetMessage) => { sent.push(m) },
    onMessage: (cb: (m: NetMessage) => void) => { handler = cb },
  } as unknown as Transport
  return { t, sent, deliver: (m: NetMessage) => handler?.(m) }
}

// Host 'host' on ct (peer 'peerHost'), client p1 on ct (peer 'peer1'), client p2 on t (peer 'peer2').
function threeWay() {
  const session = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
  const host = new NetHost(session, session.config)
  host.setHostVoice(session.localId, 'peerHost')
  const c1 = fakeTransport()
  const c2 = fakeTransport()
  host.addClient('p1', 'Ann', c1.t, 'ct', 'peer1')
  host.addClient('p2', 'Bob', c2.t, 't', 'peer2')
  return { session, host, c1, c2 }
}

// Helper: two clients on opposite teams, host on 'ct'.
// Positions: host at (0,0,0), p1 at (3,0,0) = within 7, p2 at (15,0,0) = outside 7.
function proximitySetup() {
  const session = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
  const host = new NetHost(session, { ...session.config, voiceMode: 'proximity' })
  host.setHostVoice(session.localId, 'peerHost')
  const c1 = fakeTransport()
  const c2 = fakeTransport()
  host.addClient('p1', 'Ann', c1.t, 't', 'peer1')   // opposite team, close
  host.addClient('p2', 'Bob', c2.t, 't', 'peer2')   // opposite team, far

  // Set authoritative positions
  session.getPlayer(session.localId)!.player.position.set(0, 0, 0)
  session.getPlayer('p1')!.player.position.set(3, 0, 0)   // distance 3 < 7
  session.getPlayer('p2')!.player.position.set(15, 0, 0)  // distance 15 > 7
  return { session, host, c1, c2 }
}

describe('NetHost proximity voice mode', () => {
  it('includes nearby cross-team players in roster', () => {
    const { host, c1 } = proximitySetup()
    c1.sent.length = 0
    host.refreshVoiceRoster()
    const r = c1.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    // p1 (t) is at dist 3 from host (ct) — should appear in host's roster
    // Note: we check c1 (p1's transport) — p1 should see the host as nearby
    expect(r.teammates.map(e => e.peerId)).toContain('peerHost')
  })

  it('excludes out-of-range players from roster', () => {
    const { host, c2 } = proximitySetup()
    c2.sent.length = 0
    host.refreshVoiceRoster()
    const r = c2.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    // p2 is at dist 15 > 7 — should have empty roster
    expect(r.teammates).toEqual([])
  })

  it('relays voiceStart to nearby cross-team players', () => {
    const { host, c1, c2 } = proximitySetup()
    c1.sent.length = 0; c2.sent.length = 0
    // host starts talking — p1 (dist 3) should receive, p2 (dist 15) should not
    host.localVoiceStart()
    expect(c1.sent.find(m => m.type === 'voiceStart')).toBeDefined()
    expect(c2.sent.find(m => m.type === 'voiceStart')).toBeUndefined()
  })

  it('does not relay to same-team players outside range', () => {
    const session = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    const host = new NetHost(session, { ...session.config, voiceMode: 'proximity' })
    host.setHostVoice(session.localId, 'peerHost')
    const c1 = fakeTransport()
    host.addClient('p1', 'Ann', c1.t, 'ct', 'peer1')  // same team as host, but far
    session.getPlayer(session.localId)!.player.position.set(0, 0, 0)
    session.getPlayer('p1')!.player.position.set(20, 0, 0)
    c1.sent.length = 0
    host.localVoiceStart()
    expect(c1.sent.find(m => m.type === 'voiceStart')).toBeUndefined()
  })

  it('refreshVoiceRoster fires after 200 ms accumulation in tick', () => {
    const { host, c1 } = proximitySetup()
    c1.sent.length = 0
    host.tick(0.1)   // 100 ms — no refresh yet
    const before = c1.sent.filter(m => m.type === 'voiceRoster').length
    host.tick(0.11)  // 110 ms more = 210 ms total — triggers refresh
    const after = c1.sent.filter(m => m.type === 'voiceRoster').length
    expect(after).toBeGreaterThan(before)
  })
})

describe('NetHost voice', () => {
  it('sends each client a team-scoped roster', () => {
    const { host, c1, c2 } = threeWay()
    c1.sent.length = 0; c2.sent.length = 0
    host.refreshVoiceRoster()
    const r1 = c1.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    // p1 (ct) sees only the host (ct), not p2 (t)
    expect(r1.teammates.map(e => e.peerId)).toEqual(['peerHost'])
    const r2 = c2.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    expect(r2.teammates).toEqual([]) // p2 (t) has no teammates
  })

  it('gives the host its own team-scoped roster via onHostRoster', () => {
    const { host } = threeWay()
    const rosters: VoiceRosterEntry[][] = []
    host.onHostRoster((r) => rosters.push(r))
    host.refreshVoiceRoster()
    const last = rosters[rosters.length - 1]
    expect(last.map(e => e.peerId)).toEqual(['peer1']) // host (ct) sees p1 (ct)
  })

  it('relays a client voiceStart only to same-team links', () => {
    const { c1, c2 } = threeWay()
    c1.sent.length = 0; c2.sent.length = 0
    // p1 (ct) talks → no other ct *client* exists, so no client receives it
    c1.deliver({ type: 'voiceStart', playerId: 'p1', name: 'Ann' })
    expect(c2.sent.find(m => m.type === 'voiceStart')).toBeUndefined()
  })

  it('invokes onRemoteVoiceStart when a same-team client talks', () => {
    const { host, c1 } = threeWay()
    const start = vi.fn()
    host.onRemoteVoiceStart(start)
    c1.deliver({ type: 'voiceStart', playerId: 'p1', name: 'Ann' }) // p1 ct, host ct
    expect(start).toHaveBeenCalledWith('p1', 'Ann')
  })

  it('relays host localVoiceStart to same-team client links', () => {
    const { host, c1, c2 } = threeWay()
    c1.sent.length = 0; c2.sent.length = 0
    host.localVoiceStart()
    expect(c1.sent.find(m => m.type === 'voiceStart')).toBeDefined() // p1 ct
    expect(c2.sent.find(m => m.type === 'voiceStart')).toBeUndefined() // p2 t
  })
})
