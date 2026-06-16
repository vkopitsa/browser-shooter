import type { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { GameMode, NetMessage, SessionEvent, Snapshot } from '../session/protocol'
import { applyItem } from '../player/applyPurchase'
import { findItem } from '../weapons/StoreCatalog'

interface ClientLink { playerId: string; transport: Transport }

/** Host-authoritative driver: owns the session, ingests client input, broadcasts snapshots. */
export class NetHost {
  private links: ClientLink[] = []
  /** Last measured round-trip latency per client, in ms. */
  private pings = new Map<string, number>()
  /** Last processed input seq per client — stamped onto snapshots as `ack`. */
  private lastSeq = new Map<string, number>()

  constructor(private session: GameSession, private mode: GameMode) {}

  addClient(playerId: string, name: string, transport: Transport): void {
    this.session.addPlayer(playerId, name)
    this.lastSeq.set(playerId, 0)
    transport.onMessage((msg) => {
      if (msg.type === 'input' && msg.playerId === playerId) {
        this.session.applyInput(playerId, msg.input)
        this.lastSeq.set(playerId, msg.input.seq)
      } else if (msg.type === 'pong') {
        this.pings.set(playerId, Math.round(performance.now() - msg.t))
      } else if (msg.type === 'buy' && msg.playerId === playerId) {
        const entity = this.session.getPlayer(playerId)
        const item = findItem(msg.item)
        if (entity && item) applyItem(item, entity.player, entity.weapons)
      } else if (msg.type === 'startWave' && msg.playerId === playerId) {
        this.session.waveManager.spawnNextWave()
      }
    })
    transport.send({ type: 'welcome', playerId, mode: this.mode })
    this.links.push({ playerId, transport })
    this.broadcast({ type: 'playerJoined', playerId, name })
  }

  removeClient(playerId: string): void {
    this.links = this.links.filter(l => l.playerId !== playerId)
    this.pings.delete(playerId)
    this.lastSeq.delete(playerId)
    this.session.removePlayer(playerId)
    this.broadcast({ type: 'playerLeft', playerId })
  }

  /** Send a latency probe to every client; replies update the ping map. */
  pingClients(): void {
    const t = performance.now()
    for (const link of this.links) link.transport.send({ type: 'ping', t })
  }

  /** Advance the authoritative sim one step and broadcast the resulting snapshot. */
  tick(dt: number): SessionEvent[] {
    const events = this.session.step(dt)
    this.broadcastSnapshot(this.session.getSnapshot(), events)
    return events
  }

  /** Broadcast an already-computed snapshot without stepping the sim (host renders locally). */
  broadcastSnapshot(snapshot: Snapshot, events: SessionEvent[] = []): void {
    for (const p of snapshot.players) p.ping = this.pings.get(p.id) ?? 0
    snapshot.ack = Object.fromEntries(this.lastSeq)
    snapshot.events = events
    this.broadcast({ type: 'snapshot', snapshot })
  }

  private broadcast(msg: NetMessage): void {
    for (const link of this.links) link.transport.send(msg)
  }
}
