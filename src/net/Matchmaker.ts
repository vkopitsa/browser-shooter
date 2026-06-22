import type { DirectoryClient } from './DirectoryClient'
import type { DirectoryEntry } from './directoryProtocol'

/** Pick the best joinable server: an open lobby (optionally matching mode), fullest first. */
export async function findMatch(
  client: DirectoryClient,
  mode?: string,
): Promise<DirectoryEntry | null> {
  const servers = await client.fetchList()
  const available = servers
    .filter((s) => s.status === 'lobby' && s.players < s.maxPlayers && (!mode || s.mode === mode))
    .sort((a, b) => b.players - a.players)
  return available[0] ?? null
}
