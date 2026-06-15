import { describe, it, expect, beforeEach } from 'vitest'
import { HealthSystem } from '../HealthSystem'
import { AmmoSystem } from '../AmmoSystem'
import { ScoreSystem } from '../ScoreSystem'


describe('HealthSystem', () => {
  it('initializes with max health', () => {
    const health = new HealthSystem()
    expect(health.health).toBe(100)
    expect(health.isDead).toBe(false)
  })

  it('initializes with custom max health', () => {
    const health = new HealthSystem(200)
    expect(health.health).toBe(200)
    expect(health.maxHealth).toBe(200)
  })

  it('takes damage', () => {
    const health = new HealthSystem()
    const hit = health.takeDamage(30)
    expect(hit).toBe(true)
    expect(health.health).toBe(70)
  })

  it('dies at 0 health', () => {
    const health = new HealthSystem()
    health.takeDamage(100)
    expect(health.isDead).toBe(true)
  })

  it('is invincible after hit', () => {
    const health = new HealthSystem()
    health.takeDamage(10)
    health.takeDamage(10)
    expect(health.health).toBe(90)
  })

  it('invincibility expires after update', () => {
    const health = new HealthSystem()
    health.takeDamage(10)
    health.takeDamage(10)
    expect(health.health).toBe(90)

    health.update(0.6)
    health.takeDamage(10)
    expect(health.health).toBe(80)
  })

  it('heals', () => {
    const health = new HealthSystem()
    health.takeDamage(50)
    health.heal(30)
    expect(health.health).toBe(80)
  })

  it('cannot heal past max health', () => {
    const health = new HealthSystem()
    health.takeDamage(10)
    health.heal(50)
    expect(health.health).toBe(100)
  })

  it('cannot heal when dead', () => {
    const health = new HealthSystem()
    health.takeDamage(100)
    health.heal(50)
    expect(health.health).toBe(0)
    expect(health.isDead).toBe(true)
  })

  it('cannot take damage when dead', () => {
    const health = new HealthSystem()
    health.takeDamage(100)
    const hit = health.takeDamage(10)
    expect(hit).toBe(false)
    expect(health.health).toBe(0)
  })

  it('resets to full health', () => {
    const health = new HealthSystem()
    health.takeDamage(50)
    health.reset()
    expect(health.health).toBe(100)
    expect(health.isDead).toBe(false)
    expect(health.invincibleTimer).toBe(0)
  })

  it('tracks isDead correctly', () => {
    const health = new HealthSystem(50)
    expect(health.isDead).toBe(false)
    health.update(0.6)
    health.takeDamage(49)
    expect(health.isDead).toBe(false)
    health.update(0.6)
    health.takeDamage(1)
    expect(health.isDead).toBe(true)
  })
})

describe('AmmoSystem', () => {
  it('initializes with default ammo counts', () => {
    const ammo = new AmmoSystem()
    expect(ammo.getAmmo('pistol')).toBe(60)
    expect(ammo.getAmmo('shotgun')).toBe(30)
    expect(ammo.getAmmo('rifle')).toBe(90)
  })

  it('initializes with custom ammo counts', () => {
    const ammo = new AmmoSystem({ pistol: 30, shotgun: 15, rifle: 45 })
    expect(ammo.getAmmo('pistol')).toBe(30)
    expect(ammo.getAmmo('shotgun')).toBe(15)
    expect(ammo.getAmmo('rifle')).toBe(45)
  })

  it('reports max ammo', () => {
    const ammo = new AmmoSystem()
    expect(ammo.getMaxAmmo('pistol')).toBe(60)
    expect(ammo.getMaxAmmo('shotgun')).toBe(30)
    expect(ammo.getMaxAmmo('rifle')).toBe(90)
  })

  it('checks if has ammo', () => {
    const ammo = new AmmoSystem({ pistol: 1, shotgun: 0, rifle: 5 })
    expect(ammo.hasAmmo('pistol')).toBe(true)
    expect(ammo.hasAmmo('shotgun')).toBe(false)
    expect(ammo.hasAmmo('rifle')).toBe(true)
  })

  it('consumes ammo', () => {
    const ammo = new AmmoSystem()
    const success = ammo.consumeAmmo('pistol', 5)
    expect(success).toBe(true)
    expect(ammo.getAmmo('pistol')).toBe(55)
  })

  it('fails to consume when not enough ammo', () => {
    const ammo = new AmmoSystem({ pistol: 3 })
    const success = ammo.consumeAmmo('pistol', 5)
    expect(success).toBe(false)
    expect(ammo.getAmmo('pistol')).toBe(3)
  })

  it('adds ammo up to max', () => {
    const ammo = new AmmoSystem({ pistol: 50 })
    const added = ammo.addAmmo('pistol', 5)
    expect(added).toBe(5)
    expect(ammo.getAmmo('pistol')).toBe(55)
  })

  it('does not exceed max ammo when adding', () => {
    const ammo = new AmmoSystem({ pistol: 55 })
    const added = ammo.addAmmo('pistol', 10)
    expect(added).toBe(5)
    expect(ammo.getAmmo('pistol')).toBe(60)
  })

  it('reports actual amount added', () => {
    const ammo = new AmmoSystem({ pistol: 58 })
    const added = ammo.addAmmo('pistol', 10)
    expect(added).toBe(2)
  })

  it('sets max ammo', () => {
    const ammo = new AmmoSystem()
    ammo.setMaxAmmo('pistol', 100)
    expect(ammo.getMaxAmmo('pistol')).toBe(100)
  })

  it('clips current ammo when reducing max', () => {
    const ammo = new AmmoSystem({ pistol: 60 })
    ammo.setMaxAmmo('pistol', 30)
    expect(ammo.getAmmo('pistol')).toBe(30)
  })

  it('resets to max ammo', () => {
    const ammo = new AmmoSystem()
    ammo.consumeAmmo('pistol', 30)
    ammo.consumeAmmo('shotgun', 10)
    ammo.reset()
    expect(ammo.getAmmo('pistol')).toBe(60)
    expect(ammo.getAmmo('shotgun')).toBe(30)
    expect(ammo.getAmmo('rifle')).toBe(90)
  })

  it('checks if ammo type is empty', () => {
    const ammo = new AmmoSystem({ pistol: 0, shotgun: 5 })
    expect(ammo.isEmpty('pistol')).toBe(true)
    expect(ammo.isEmpty('shotgun')).toBe(false)
  })

  it('checks if all ammo is empty', () => {
    const ammo = new AmmoSystem({ pistol: 0, shotgun: 0, rifle: 0 })
    expect(ammo.allEmpty()).toBe(true)
    ammo.addAmmo('pistol', 1)
    expect(ammo.allEmpty()).toBe(false)
  })

  it('consumeAmmo defaults to 1', () => {
    const ammo = new AmmoSystem({ pistol: 10 })
    ammo.consumeAmmo('pistol')
    expect(ammo.getAmmo('pistol')).toBe(9)
  })
})

describe('ScoreSystem', () => {
  beforeEach(() => {
    localStorage.removeItem('browser-shooter-highscore')
  })

  it('starts at 0', () => {
    const score = new ScoreSystem()
    expect(score.score).toBe(0)
    expect(score.wave).toBe(0)
  })

  it('adds kill points', () => {
    const score = new ScoreSystem()
    score.addKill(100)
    expect(score.score).toBe(100)
  })

  it('adds multiple kills', () => {
    const score = new ScoreSystem()
    score.addKill(100)
    score.addKill(150)
    score.addKill(300)
    expect(score.score).toBe(550)
  })

  it('completes wave and adds bonus', () => {
    const score = new ScoreSystem()
    score.completeWave()
    expect(score.wave).toBe(1)
    expect(score.score).toBe(500)
  })

  it('wave bonus scales with wave number', () => {
    const score = new ScoreSystem()
    score.completeWave()
    score.completeWave()
    expect(score.wave).toBe(2)
    expect(score.score).toBe(1500)
  })

  it('saves high score to localStorage', () => {
    const score = new ScoreSystem()
    score.addKill(1000)
    score.saveHighScore()
    expect(score.highScore).toBe(1000)
  })

  it('does not overwrite high score with lower score', () => {
    const score = new ScoreSystem()
    score.addKill(2000)
    score.saveHighScore()
    score.reset()
    score.addKill(500)
    score.saveHighScore()
    expect(score.highScore).toBe(2000)
  })

  it('resets score but keeps high score', () => {
    const score = new ScoreSystem()
    score.addKill(500)
    score.completeWave()
    score.saveHighScore()
    expect(score.highScore).toBe(1000)
    score.reset()
    expect(score.score).toBe(0)
    expect(score.wave).toBe(0)
    expect(score.highScore).toBe(1000)
  })
})
