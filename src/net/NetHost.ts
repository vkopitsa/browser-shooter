import type { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { GameMode, NetMessage, SessionEvent } from '../session/protocol'

interface ClientLink { playerId: string; transport: Transport }

/** Host-authoritative driver: owns the session, ingests client input, broadcasts snapshots. */
export class NetHost {
  private links: ClientLink[] = []

  constructor(private session: GameSession, private mode: GameMode) {}

  addClient(playerId: string, name: string, transport: Transport): void {
    this.session.addPlayer(playerId, name)
    transport.onMessage((msg) => {
      if (msg.type === 'input' && msg.playerId === playerId) {
        this.session.applyInput(playerId, msg.input)
      }
    })
    transport.send({ type: 'welcome', playerId, mode: this.mode })
    this.links.push({ playerId, transport })
    this.broadcast({ type: 'playerJoined', playerId, name })
  }

  removeClient(playerId: string): void {
    this.links = this.links.filter(l => l.playerId !== playerId)
    this.session.removePlayer(playerId)
    this.broadcast({ type: 'playerLeft', playerId })
  }

  /** Advance the authoritative sim one step and broadcast the resulting snapshot. */
  tick(dt: number): SessionEvent[] {
    const events = this.session.step(dt)
    const snapshot = this.session.getSnapshot()
    this.broadcast({ type: 'snapshot', snapshot })
    return events
  }

  private broadcast(msg: NetMessage): void {
    for (const link of this.links) link.transport.send(msg)
  }
}
