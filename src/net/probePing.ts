import { type DataConnection } from 'peerjs'
import { createPeer } from './peerConfig'
import type { NetMessage } from '../session/protocol'

/**
 * Open a throwaway connection to a host's game peer, time one probe round-trip,
 * then tear down. Resolves the RTT in ms, or null on timeout/error.
 */
export function measurePing(roomCode: string, timeoutMs = 3000): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false
    const peer = createPeer()
    const finish = (v: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      peer.destroy()
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    peer.on('open', () => {
      const conn = peer.connect(roomCode, { reliable: true }) as DataConnection
      conn.on('open', () => {
        const t = performance.now()
        conn.send({ type: 'probe', t } satisfies NetMessage)
      })
      conn.on('data', (d: unknown) => {
        const msg = d as NetMessage
        if (msg.type === 'probeAck') finish(Math.round(performance.now() - msg.t))
      })
      conn.on('error', () => finish(null))
    })
    peer.on('error', () => finish(null))
  })
}
