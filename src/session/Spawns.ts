import * as THREE from 'three'
import type { Team } from '../types'
import type { MapDef } from '../maps/MapDef'
import { getMap } from '../maps/registry'

const EYE = 2 // matches Player EYE_HEIGHT

/** A spawn position for `team` on `map`. Falls back to a small random offset if none are defined. */
export function pickSpawn(team: Team, map: MapDef = getMap(), index?: number): THREE.Vector3 {
  const list = team === 'ct' ? map.ctSpawns : map.tSpawns
  if (list.length === 0) {
    return new THREE.Vector3((Math.random() - 0.5) * 10, EYE, (Math.random() - 0.5) * 10)
  }
  const i = index != null ? index % list.length : Math.floor(Math.random() * list.length)
  const [x, z] = list[i]
  return new THREE.Vector3(x, EYE, z)
}
