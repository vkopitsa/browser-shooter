import { describe, it, expect, beforeEach } from 'vitest'
import { HealthSystem } from '../HealthSystem'

describe('HealthSystem', () => {
  let health: HealthSystem

  beforeEach(() => {
    health = new HealthSystem()
  })

  it('initializes with default max health of 100', () => {
    expect(health.health).toBe(100)
    expect(health.maxHealth).toBe(100)
  })

  it('initializes with custom max health', () => {
    const h = new HealthSystem(200)
    expect(h.health).toBe(200)
    expect(h.maxHealth).toBe(200)
  })

  it('starts not dead', () => {
    expect(health.isDead).toBe(false)
  })

  it('starts with no invincibility', () => {
    expect(health.invincibleTimer).toBe(0)
  })

  it('takes damage and returns true', () => {
    const result = health.takeDamage(30)
    expect(result).toBe(true)
    expect(health.health).toBe(70)
  })

  it('sets invincibility timer on damage', () => {
    health.takeDamage(10)
    expect(health.invincibleTimer).toBe(0.5)
  })

  it('blocks damage during invincibility', () => {
    health.takeDamage(10)
    const result = health.takeDamage(10)
    expect(result).toBe(false)
    expect(health.health).toBe(90)
  })

  it('pierced damage ignores invincibility and grants none (PvP)', () => {
    health.takeDamage(10, true)
    expect(health.invincibleTimer).toBe(0)
    expect(health.takeDamage(10, true)).toBe(true)
    expect(health.health).toBe(80)
    // pierces spawn protection too
    health.revive()
    expect(health.takeDamage(10, true)).toBe(true)
    expect(health.health).toBe(90)
  })

  it('invincibility expires after update', () => {
    health.takeDamage(10)
    health.update(0.5)
    expect(health.invincibleTimer).toBe(0)
    // Now damage should go through
    health.takeDamage(10)
    expect(health.health).toBe(80)
  })

  it('dies when health reaches 0', () => {
    health.takeDamage(100)
    expect(health.isDead).toBe(true)
    expect(health.health).toBe(0)
  })

  it('dies when overkilled', () => {
    health.takeDamage(150)
    expect(health.isDead).toBe(true)
    expect(health.health).toBe(0)
  })

  it('cannot take damage when dead', () => {
    health.takeDamage(100)
    const result = health.takeDamage(10)
    expect(result).toBe(false)
    expect(health.health).toBe(0)
  })

  it('heals correctly', () => {
    health.takeDamage(50)
    health.heal(30)
    expect(health.health).toBe(80)
  })

  it('cannot heal past max health', () => {
    health.takeDamage(10)
    health.heal(50)
    expect(health.health).toBe(100)
  })

  it('cannot heal when dead', () => {
    health.takeDamage(100)
    health.heal(50)
    expect(health.health).toBe(0)
    expect(health.isDead).toBe(true)
  })

  it('resets to full health', () => {
    health.takeDamage(50)
    health.reset()
    expect(health.health).toBe(100)
    expect(health.isDead).toBe(false)
    expect(health.invincibleTimer).toBe(0)
  })

  it('resets from dead state', () => {
    health.takeDamage(100)
    health.reset()
    expect(health.isDead).toBe(false)
    expect(health.health).toBe(100)
  })

  it('invincibility timer decays over multiple updates', () => {
    health.takeDamage(10)
    health.update(0.2)
    expect(health.invincibleTimer).toBeCloseTo(0.3)
    health.update(0.2)
    expect(health.invincibleTimer).toBeCloseTo(0.1)
    health.update(0.2)
    expect(health.invincibleTimer).toBe(0)
  })

  it('handles zero damage', () => {
    const result = health.takeDamage(0)
    expect(result).toBe(false)
    expect(health.health).toBe(100)
  })

  it('handles zero heal', () => {
    health.takeDamage(50)
    health.heal(0)
    expect(health.health).toBe(50)
  })

  it('defaults armor to 0', () => {
    expect(health.armor).toBe(0)
  })

  it('splits damage between armor and health when armored', () => {
    health.armor = 100
    health.takeDamage(50)
    expect(health.health).toBe(75) // half of 50 to health
    expect(health.armor).toBe(75)  // half of 50 to armor
  })

  it('armor absorbs only what it has, rest hits health', () => {
    health.armor = 10
    health.takeDamage(50) // armor can take min(10, 25)=10, health takes 40
    expect(health.armor).toBe(0)
    expect(health.health).toBe(60)
  })

  it('addMaxHealth raises the cap and tops up', () => {
    health.takeDamage(40) // health 60
    health.addMaxHealth(25)
    expect(health.maxHealth).toBe(125)
    expect(health.health).toBe(125)
  })

  it('reset clears armor and restores base max health', () => {
    health.armor = 50
    health.addMaxHealth(25)
    health.reset()
    expect(health.armor).toBe(0)
    expect(health.maxHealth).toBe(100)
    expect(health.health).toBe(100)
  })
})
