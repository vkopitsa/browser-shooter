import type { DirectoryEntry, ServerStatus } from './directoryProtocol'

interface RosterRecord extends DirectoryEntry { lastSeen: number }

/** In-memory roster of open games. Pure (no PeerJS); fully unit-tested. */
export class DirectoryRoster {
  private records = new Map<string, RosterRecord>()

  upsert(entry: DirectoryEntry, now: number): void {
    this.records.set(entry.roomCode, { ...entry, lastSeen: now })
  }

  heartbeat(roomCode: string, players: number, status: ServerStatus, now: number): void {
    const rec = this.records.get(roomCode)
    if (!rec) return
    rec.players = players
    rec.status = status
    rec.lastSeen = now
  }

  remove(roomCode: string): void {
    this.records.delete(roomCode)
  }

  expire(ttlMs: number, now: number): void {
    for (const [code, rec] of this.records) {
      if (now - rec.lastSeen > ttlMs) this.records.delete(code)
    }
  }

  list(): DirectoryEntry[] {
    return [...this.records.values()].map(({ lastSeen: _lastSeen, ...entry }) => entry)
  }
}
