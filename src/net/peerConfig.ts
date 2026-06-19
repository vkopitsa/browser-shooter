import Peer, { type PeerOptions } from 'peerjs'

/**
 * Where PeerJS connects to broker/signal. By default (no env set) we use the
 * public `0.peerjs.com` cloud broker, which is rate-limited and can temporarily
 * IP-ban heavy users (Cloudflare 1015). Set VITE_PEER_* to point at a broker you
 * control (see `npm run peerserver`) and the rate limit goes away.
 */
export interface PeerEnv {
  VITE_PEER_HOST?: string
  VITE_PEER_PORT?: string
  VITE_PEER_PATH?: string
  VITE_PEER_SECURE?: string
  VITE_PEER_KEY?: string
}

/**
 * Build PeerJS connection options from env vars. Returns undefined when no custom
 * host is configured, so callers fall back to PeerJS's default public broker.
 */
export function buildPeerOptions(env: PeerEnv): PeerOptions | undefined {
  if (!env.VITE_PEER_HOST) return undefined
  const opts: PeerOptions = { host: env.VITE_PEER_HOST, secure: env.VITE_PEER_SECURE === 'true' }
  if (env.VITE_PEER_PORT) opts.port = Number(env.VITE_PEER_PORT)
  if (env.VITE_PEER_PATH) opts.path = env.VITE_PEER_PATH
  if (env.VITE_PEER_KEY) opts.key = env.VITE_PEER_KEY
  return opts
}

/** Options resolved once from the build-time env; undefined => default public broker. */
export const PEER_OPTIONS = buildPeerOptions(import.meta.env as unknown as PeerEnv)

/** Construct a Peer wired to the configured broker. Pass an id to claim a fixed id. */
export function createPeer(id?: string): Peer {
  return new Peer(id as string, PEER_OPTIONS)
}
