import { describe, it, expect } from 'vitest'
import { buildPeerOptions } from '../peerConfig'

describe('buildPeerOptions', () => {
  it('returns undefined when no host is configured (use default public broker)', () => {
    expect(buildPeerOptions({})).toBeUndefined()
  })

  it('builds options for a self-hosted broker', () => {
    const opts = buildPeerOptions({
      VITE_PEER_HOST: 'localhost',
      VITE_PEER_PORT: '9000',
      VITE_PEER_PATH: '/',
      VITE_PEER_SECURE: 'false',
    })
    expect(opts).toEqual({ host: 'localhost', port: 9000, path: '/', secure: false })
  })

  it('marks the broker secure only when VITE_PEER_SECURE is exactly "true"', () => {
    expect(buildPeerOptions({ VITE_PEER_HOST: 'peer.example.com' })?.secure).toBe(false)
    expect(buildPeerOptions({ VITE_PEER_HOST: 'peer.example.com', VITE_PEER_SECURE: 'true' })?.secure).toBe(true)
  })

  it('passes through a custom key and omits unset fields', () => {
    const opts = buildPeerOptions({ VITE_PEER_HOST: 'peer.example.com', VITE_PEER_KEY: 'mykey' })
    expect(opts).toEqual({ host: 'peer.example.com', secure: false, key: 'mykey' })
  })

  it('parses VITE_PEER_ICE into config.iceServers', () => {
    const ice = '[{"urls":"stun:of-it.pp.ua:3478"},{"urls":"turn:of-it.pp.ua:3478","username":"u","credential":"p"}]'
    const opts = buildPeerOptions({ VITE_PEER_HOST: 'peerjs.of-it.pp.ua', VITE_PEER_SECURE: 'true', VITE_PEER_ICE: ice })
    expect(opts?.config?.iceServers).toEqual([
      { urls: 'stun:of-it.pp.ua:3478' },
      { urls: 'turn:of-it.pp.ua:3478', username: 'u', credential: 'p' },
    ])
  })

  it('returns ICE config even when no broker host is set', () => {
    const opts = buildPeerOptions({ VITE_PEER_ICE: '[{"urls":"stun:of-it.pp.ua:3478"}]' })
    expect(opts).toEqual({ config: { iceServers: [{ urls: 'stun:of-it.pp.ua:3478' }] } })
  })

  it('ignores invalid VITE_PEER_ICE JSON and falls back to defaults', () => {
    expect(buildPeerOptions({ VITE_PEER_ICE: 'not json' })).toBeUndefined()
    expect(buildPeerOptions({ VITE_PEER_ICE: '[]' })).toBeUndefined()
  })
})
