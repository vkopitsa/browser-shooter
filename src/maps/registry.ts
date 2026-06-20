import type { MapDef } from './MapDef'
import { DUST2 } from './dust2'
import { MIRAGE } from './mirage'
import { INFERNO } from './inferno'
import { NUKE } from './nuke'
import { OVERPASS } from './overpass'

/** All selectable maps, in menu order. Dust2 first (the default). */
export const MAPS: MapDef[] = [DUST2, MIRAGE, INFERNO, NUKE, OVERPASS]

export const DEFAULT_MAP_ID = DUST2.id

/** Look up a map by id, falling back to the default (Dust2) for unknown/undefined ids. */
export function getMap(id?: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? DUST2
}
