import { describe, it, expect, vi, beforeEach } from 'vitest'

const handlers: Record<string, ((arg: unknown) => void)[]> = {}
const fakePeer = {
  id: 'browser-shooter-directory-v1',
  on: (event: string, cb: (arg: unknown) => void) => { (handlers[event] ??= []).push(cb) },
  destroy: vi.fn(),
  connect: vi.fn(),
}
vi.mock('peerjs', () => ({ default: vi.fn(() => fakePeer) }))

import { tryBecomeDirectory } from '../directoryPeer'

beforeEach(() => { for (const k of Object.keys(handlers)) delete handlers[k] })

describe('tryBecomeDirectory', () => {
  it('resolves a server + peer when the peer opens (we own the id)', async () => {
    const p = tryBecomeDirectory()
    handlers['open']?.forEach(h => h('browser-shooter-directory-v1'))
    const result = await p
    expect(result.server).not.toBeNull()
    expect(result.peer).not.toBeNull()
  })

  it('resolves null server when the id is unavailable (someone else owns it)', async () => {
    const p = tryBecomeDirectory()
    handlers['error']?.forEach(h => h({ type: 'unavailable-id' }))
    const result = await p
    expect(result.server).toBeNull()
    expect(result.peer).toBeNull()
  })
})
