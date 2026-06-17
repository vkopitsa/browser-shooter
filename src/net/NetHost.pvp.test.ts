import { describe, it, expect, vi } from 'vitest'
import { NetHost } from './NetHost'
import { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { NetMessage } from '../session/protocol'

function fakeTransport() {
  let handler: ((m: NetMessage) => void) | null = null
  const sent: NetMessage[] = []
  const t: Transport = {
    send: (m: NetMessage) => { sent.push(m) },
    onMessage: (cb: (m: NetMessage) => void) => { handler = cb },
  } as unknown as Transport
  return { t, sent, deliver: (m: NetMessage) => handler?.(m) }
}

describe('NetHost PvP', () => {
  it('welcome carries the match config', () => {
    const session = new GameSession({ mode: 'pvp', damagePolicy: 'ffa', fragLimit: 10 })
    const host = new NetHost(session, session.config)
    const { t, sent } = fakeTransport()
    host.addClient('p1', 'Ann', t, 't')
    const welcome = sent.find(m => m.type === 'welcome')
    expect(welcome).toMatchObject({ type: 'welcome', playerId: 'p1', config: { mode: 'pvp', damagePolicy: 'ffa', fragLimit: 10 } })
    expect(session.getPlayer('p1')!.team).toBe('t')
  })

  it('setTeam updates the player team', () => {
    const session = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    const host = new NetHost(session, session.config)
    const { t, deliver } = fakeTransport()
    host.addClient('p1', 'Ann', t, 'ct')
    deliver({ type: 'setTeam', playerId: 'p1', team: 't' })
    expect(session.getPlayer('p1')!.team).toBe('t')
  })

  it('startWave is ignored in pvp mode', () => {
    const session = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    const spy = vi.spyOn(session.waveManager, 'spawnNextWave')
    const host = new NetHost(session, session.config)
    const { t, deliver } = fakeTransport()
    host.addClient('p1', 'Ann', t, 'ct')
    deliver({ type: 'startWave', playerId: 'p1' })
    expect(spy).not.toHaveBeenCalled()
  })
})
