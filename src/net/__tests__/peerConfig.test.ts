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
})
