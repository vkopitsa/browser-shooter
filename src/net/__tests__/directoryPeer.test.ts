import { describe, it, expect, vi, beforeEach } from 'vitest'

const handlers: Record<string, ((arg: unknown) => void)[]> = {}
const connHandlers: Record<string, ((arg: unknown) => void)[]> = {}
const fakeConn = {
  on: (event: string, cb: (arg: unknown) => void) => { (connHandlers[event] ??= []).push(cb) },
  send: vi.fn(),
  close: vi.fn(),
}
const fakePeer = {
  id: 'browser-shooter-directory-v1',
  on: (event: string, cb: (arg: unknown) => void) => { (handlers[event] ??= []).push(cb) },
  destroy: vi.fn(),
  connect: vi.fn(() => fakeConn),
}
vi.mock('peerjs', () => ({ default: vi.fn(() => fakePeer) }))

import { tryBecomeDirectory, dialDirectory } from '../directoryPeer'

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k]
  for (const k of Object.keys(connHandlers)) delete connHandlers[k]
})

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

describe('dialDirectory', () => {
  it('resolves a client + peer once the connection opens', async () => {
    const p = dialDirectory()
    handlers['open']?.forEach(h => h(undefined))
    connHandlers['open']?.forEach(h => h(undefined))
    const result = await p
    expect(result).not.toBeNull()
    expect(result?.client).toBeDefined()
    expect(result?.peer).toBeDefined()
  })

  it('resolves null when the connection errors', async () => {
    const p = dialDirectory()
    handlers['open']?.forEach(h => h(undefined))
    connHandlers['error']?.forEach(h => h(new Error('refused')))
    expect(await p).toBeNull()
  })

  it('resolves null when the peer errors before connecting', async () => {
    const p = dialDirectory()
    handlers['error']?.forEach(h => h(new Error('broker down')))
    expect(await p).toBeNull()
  })
})
