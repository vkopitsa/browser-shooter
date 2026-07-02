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

/** Two planetary drop-ins within this radius count as "the same place". */
const PLANETARY_MATCH_RADIUS_M = 2000

/** Meters between two [lng, lat] points (equirectangular — fine at this radius). */
function distanceM(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLng = (b[0] - a[0]) * rad * Math.cos(((a[1] + b[1]) / 2) * rad)
  return Math.sqrt(dLat * dLat + dLng * dLng) * 6371000
}

/** Find an open drop-in planetary match near `center`, closest first, so players who pick the
 * same spot land in the same world instead of each hosting their own. */
export async function findPlanetaryMatch(
  client: DirectoryClient,
  center: [number, number],
): Promise<DirectoryEntry | null> {
  const servers = await client.fetchList()
  const nearby = servers
    .filter((s) => s.planetaryCenter && s.joinPolicy === 'free' && !s.protected
      && s.players < s.maxPlayers
      && distanceM(s.planetaryCenter, center) <= PLANETARY_MATCH_RADIUS_M)
    .sort((a, b) => distanceM(a.planetaryCenter!, center) - distanceM(b.planetaryCenter!, center))
  return nearby[0] ?? null
}
