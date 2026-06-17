import type { Team } from '../types'
import type { GameMode } from './protocol'

export type DamagePolicy = 'team' | 'friendly' | 'ffa'

export interface MatchConfig {
  mode: GameMode
  damagePolicy: DamagePolicy
  fragLimit: number // team score to win; 0 = endless
}

export function defaultMatchConfig(): MatchConfig {
  return { mode: 'coop', damagePolicy: 'team', fragLimit: 30 }
}

/** Can `attacker`'s team damage `target`'s team under `policy`? Pure. */
export function canDamage(attacker: Team, target: Team, policy: DamagePolicy): boolean {
  if (policy === 'ffa') return true
  if (policy === 'friendly') return true
  return attacker !== target // 'team': opposite only
}
