import { describe, it, expect, vi } from 'vitest'
import { PeerConnection } from '../PeerConnection'
import type { NetMessage } from '../../session/protocol'

function fakeConn() {
  const handlers: Record<string, ((d: unknown) => void)[]> = {}
  return {
    send: vi.fn(),
    on: (event: string, cb: (d: unknown) => void) => {
      (handlers[event] ??= []).push(cb)
    },
    emit: (event: string, d?: unknown) => (handlers[event] ?? []).forEach(h => h(d)),
  }
}

describe('PeerConnection', () => {
  it('send() forwards to conn.send', () => {
    const conn = fakeConn()
    const t = new PeerConnection(conn as any)
    const msg: NetMessage = { type: 'join', name: 'Ann' }
    t.send(msg)
    expect(conn.send).toHaveBeenCalledWith(msg)
  })

  it('onMessage() receives conn "data" events', () => {
    const conn = fakeConn()
    const t = new PeerConnection(conn as any)
    const got: NetMessage[] = []
    t.onMessage(m => got.push(m))
    conn.emit('data', { type: 'welcome', playerId: 'player-2', mode: 'coop' })
    expect(got).toEqual([{ type: 'welcome', playerId: 'player-2', mode: 'coop' }])
  })

  it('onClose() fires when conn emits "close"', () => {
    const conn = fakeConn()
    const t = new PeerConnection(conn as any)
    const cb = vi.fn()
    t.onClose(cb)
    conn.emit('close')
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
