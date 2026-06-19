import { type DataConnection } from 'peerjs'
import type Peer from 'peerjs'
import { PeerConnection } from './PeerConnection'
import { createPeer } from './peerConfig'
import type { Transport } from '../session/Transport'

/** Client peer: dials a room code and resolves a Transport once the channel opens. */
export class PeerClient {
  private _peer: Peer | null = null

  connect(roomCode: string): Promise<Transport> {
    this._peer = createPeer()
    return new Promise((resolve, reject) => {
      this._peer!.on('open', () => {
        const conn = this._peer!.connect(roomCode, { reliable: true })
        conn.on('open', () => resolve(new PeerConnection(conn as DataConnection)))
        conn.on('error', (err: unknown) => reject(err))
      })
      this._peer!.on('error', (err: unknown) => reject(err))
    })
  }

  get peer(): Peer | null { return this._peer }

  stop(): void { this._peer?.destroy(); this._peer = null }
}
