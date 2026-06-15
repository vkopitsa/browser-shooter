import type { NetMessage } from './protocol'

export interface Transport {
  send(msg: NetMessage): void
  onMessage(cb: (msg: NetMessage) => void): void
}

/** Single-process transport: delivers messages synchronously to all handlers. */
export class LoopbackTransport implements Transport {
  private handlers: ((msg: NetMessage) => void)[] = []

  send(msg: NetMessage): void {
    for (const h of this.handlers) h(msg)
  }

  onMessage(cb: (msg: NetMessage) => void): void {
    this.handlers.push(cb)
  }
}

/** Two cross-wired endpoints: each one's send() reaches only the other's handlers. */
export function createLinkedTransports(): [Transport, Transport] {
  const aHandlers: ((msg: NetMessage) => void)[] = []
  const bHandlers: ((msg: NetMessage) => void)[] = []
  const a: Transport = {
    send: (msg) => bHandlers.forEach(h => h(msg)),
    onMessage: (cb) => { aHandlers.push(cb) },
  }
  const b: Transport = {
    send: (msg) => aHandlers.forEach(h => h(msg)),
    onMessage: (cb) => { bHandlers.push(cb) },
  }
  return [a, b]
}
