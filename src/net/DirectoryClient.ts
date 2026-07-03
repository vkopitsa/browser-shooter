import type { Channel } from './Channel'
import type { DirMessage, DirectoryEntry, ServerStatus } from './directoryProtocol'

/**
 * Client side of the directory channel: a host announcing, or a browser listing.
 * One channel listener dispatches to the pending fetchList, so a client can be
 * kept open and polled repeatedly (the menu picker does this).
 */
export class DirectoryClient {
  private pendingList: ((entries: DirectoryEntry[]) => void) | null = null

  constructor(private channel: Channel<DirMessage>) {
    channel.onMessage((msg) => {
      if (msg.type === 'listResponse') {
        const pending = this.pendingList
        this.pendingList = null
        pending?.(msg.entries)
      }
    })
  }

  register(entry: DirectoryEntry): void {
    this.channel.send({ type: 'register', entry })
  }

  heartbeat(roomCode: string, players: number, status: ServerStatus, mode?: string): void {
    this.channel.send({ type: 'heartbeat', roomCode, players, status, mode })
  }

  unregister(roomCode: string): void {
    this.channel.send({ type: 'unregister', roomCode })
  }

  /** Request the roster; resolves [] if no response arrives within timeoutMs. */
  fetchList(timeoutMs = 3000): Promise<DirectoryEntry[]> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pendingList === done) this.pendingList = null
        resolve([])
      }, timeoutMs)
      const done = (entries: DirectoryEntry[]) => { clearTimeout(timer); resolve(entries) }
      this.pendingList = done
      this.channel.send({ type: 'listRequest' })
    })
  }

  onClose(cb: () => void): void { this.channel.onClose(cb) }
}
