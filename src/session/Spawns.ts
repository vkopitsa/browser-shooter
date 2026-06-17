import * as THREE from 'three'
import type { Team } from '../types'

const EYE = 2 // matches Player EYE_HEIGHT
const CT_SPAWNS: [number, number][] = [[-20, -20], [-24, -16], [-16, -24], [-20, -12]]
const T_SPAWNS: [number, number][] = [[20, 20], [24, 16], [16, 24], [20, 12]]

/** A spawn position for `team`. Falls back to a small random offset if no points are defined. */
export function pickSpawn(team: Team, index?: number): THREE.Vector3 {
  const list = team === 'ct' ? CT_SPAWNS : T_SPAWNS
  if (list.length === 0) {
    return new THREE.Vector3((Math.random() - 0.5) * 10, EYE, (Math.random() - 0.5) * 10)
  }
  const i = index != null ? index % list.length : Math.floor(Math.random() * list.length)
  const [x, z] = list[i]
  return new THREE.Vector3(x, EYE, z)
}
