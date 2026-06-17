import { describe, it, expect } from 'vitest'
import { canDamage, defaultMatchConfig } from './MatchConfig'

describe('canDamage', () => {
  it('team policy: only opposite teams', () => {
    expect(canDamage('ct', 't', 'team')).toBe(true)
    expect(canDamage('ct', 'ct', 'team')).toBe(false)
  })
  it('friendly policy: anyone', () => {
    expect(canDamage('ct', 'ct', 'friendly')).toBe(true)
    expect(canDamage('ct', 't', 'friendly')).toBe(true)
  })
  it('ffa policy: anyone', () => {
    expect(canDamage('t', 't', 'ffa')).toBe(true)
    expect(canDamage('t', 'ct', 'ffa')).toBe(true)
  })
})

describe('defaultMatchConfig', () => {
  it('defaults to coop / team / 30', () => {
    expect(defaultMatchConfig()).toEqual({ mode: 'coop', damagePolicy: 'team', fragLimit: 30 })
  })
})
