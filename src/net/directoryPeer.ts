import Peer, { type DataConnection } from 'peerjs'
import { DIRECTORY_PEER_ID, type DirMessage } from './directoryProtocol'
import { DirectoryServer } from './DirectoryServer'
import { DirectoryClient } from './DirectoryClient'
import { PeerChannel } from './Channel'

export interface ElectResult { server: DirectoryServer | null; peer: Peer | null }
export interface DialResult { client: DirectoryClient; peer: Peer }

/** Try to claim the fixed directory id. Win => run a DirectoryServer; lose/err => null. */
export function tryBecomeDirectory(): Promise<ElectResult> {
  return new Promise((resolve) => {
    let settled = false
    const done = (r: ElectResult) => {
      if (settled) return
      settled = true
      resolve(r)
    }
    const peer = new Peer(DIRECTORY_PEER_ID)
    peer.on('open', () => {
      const server = new DirectoryServer()
      peer.on('connection', (conn: unknown) => {
        const dc = conn as DataConnection
        dc.on('open', () => server.accept(new PeerChannel<DirMessage>(dc)))
      })
      done({ server, peer })
    })
    peer.on('error', () => {
      peer.destroy()
      done({ server: null, peer: null })
    })
  })
}

/** Dial the existing directory as a plain peer. Resolves null if it cannot be reached. */
export function dialDirectory(): Promise<DialResult | null> {
  return new Promise((resolve) => {
    let settled = false
    const done = (r: DialResult | null) => {
      if (settled) return
      settled = true
      resolve(r)
    }
    const peer = new Peer()
    peer.on('open', () => {
      const conn = peer.connect(DIRECTORY_PEER_ID, { reliable: true })
      conn.on('open', () => done({ client: new DirectoryClient(new PeerChannel<DirMessage>(conn)), peer }))
      conn.on('error', () => {
        peer.destroy()
        done(null)
      })
    })
    peer.on('error', () => {
      peer.destroy()
      done(null)
    })
  })
}
