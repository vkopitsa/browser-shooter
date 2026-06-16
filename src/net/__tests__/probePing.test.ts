import { describe, it, expect, vi, beforeEach } from 'vitest'

const peerHandlers: Record<string, ((arg: unknown) => void)[]> = {}
const connHandlers: Record<string, ((arg: unknown) => void)[]> = {}
const fakeConn = {
  on: (e: string, cb: (a: unknown) => void) => { (connHandlers[e] ??= []).push(cb) },
  send: vi.fn(),
  close: vi.fn(),
}
const fakePeer = {
  on: (e: string, cb: (a: unknown) => void) => { (peerHandlers[e] ??= []).push(cb) },
  connect: vi.fn(() => fakeConn),
  destroy: vi.fn(),
}
vi.mock('peerjs', () => ({ default: vi.fn(() => fakePeer) }))

import { measurePing } from '../probePing'

beforeEach(() => {
  for (const k of Object.keys(peerHandlers)) delete peerHandlers[k]
  for (const k of Object.keys(connHandlers)) delete connHandlers[k]
  fakeConn.send.mockClear()
})

describe('measurePing', () => {
  it('sends a probe and resolves a non-negative RTT on probeAck', async () => {
    const p = measurePing('ROOM1')
    peerHandlers['open']?.forEach(h => h(undefined))
    connHandlers['open']?.forEach(h => h(undefined))
    expect(fakeConn.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'probe' }))
    const sent = fakeConn.send.mock.calls[0][0] as { t: number }
    connHandlers['data']?.forEach(h => h({ type: 'probeAck', t: sent.t }))
    await expect(p).resolves.toBeGreaterThanOrEqual(0)
  })

  it('resolves null when the timeout elapses with no reply', async () => {
    const p = measurePing('ROOM1', 5)
    peerHandlers['open']?.forEach(h => h(undefined))
    await expect(p).resolves.toBeNull()
  })
})
