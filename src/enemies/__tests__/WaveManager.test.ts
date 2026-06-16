import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WaveManager } from '../WaveManager'

describe('WaveManager', () => {
  let manager: WaveManager

  beforeEach(() => {
    manager = new WaveManager()
  })

  it('starts at wave 0 with no active wave', () => {
    expect(manager.currentWave).toBe(0)
    expect(manager.waveActive).toBe(false)
    expect(manager.enemiesRemaining).toBe(0)
  })

  it('starts wave 1 with correct enemy count', () => {
    manager.startWave()
    expect(manager.currentWave).toBe(1)
    expect(manager.waveActive).toBe(true)
    expect(manager.enemiesRemaining).toBe(5)
  })

  it('starts wave 2 with more enemies', () => {
    manager.startWave()
    manager.startWave()
    expect(manager.currentWave).toBe(2)
    expect(manager.enemiesRemaining).toBe(8)
  })

  it('populates spawn queue on start', () => {
    manager.startWave()
    expect(manager.spawnQueue.length).toBe(5)
    // All should be grunts for wave 1
    for (const type of manager.spawnQueue) {
      expect(type).toBe('grunt')
    }
  })

  it('decrements enemies remaining on kill', () => {
    manager.startWave()
    manager.onEnemyKilled()
    expect(manager.enemiesRemaining).toBe(4)
  })

  it('does not go below 0 enemies remaining', () => {
    manager.startWave()
    for (let i = 0; i < 10; i++) {
      manager.onEnemyKilled()
    }
    expect(manager.enemiesRemaining).toBe(0)
  })

  it('completes wave when all enemies killed and queue empty', () => {
    const onComplete = vi.fn()
    manager.onWaveComplete = onComplete
    manager.startWave()

    // Kill all enemies and empty the spawn queue
    manager.spawnQueue = []
    for (let i = 0; i < 5; i++) {
      manager.onEnemyKilled()
    }

    expect(onComplete).toHaveBeenCalled()
    expect(manager.waveActive).toBe(false)
  })

  it('does not complete wave if spawn queue still has enemies', () => {
    const onComplete = vi.fn()
    manager.onWaveComplete = onComplete
    manager.startWave()

    // Kill all remaining but queue still has items
    for (let i = 0; i < 5; i++) {
      manager.onEnemyKilled()
    }

    // Wave should NOT complete because spawnQueue still has entries
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('calls onEnemySpawned when enemy spawns', () => {
    const onSpawned = vi.fn()
    manager.onEnemySpawned = onSpawned
    manager.startWave()

    // Advance past spawn delay
    manager.update(1.1, 28)

    expect(onSpawned).toHaveBeenCalled()
  })

  it('returns spawned enemy from update', () => {
    manager.startWave()
    manager.update(1.1, 28)

    const result = manager.update(1.1, 28)
    // Should return an enemy or null depending on timing
    // At minimum, the first call after delay should spawn
    expect(result).toBeDefined()
    expect(manager.spawnQueue.length).toBeLessThan(5)
  })

  it('does not spawn when wave is not active', () => {
    const result = manager.update(1.1, 28)
    expect(result).toBeNull()
  })

  it('scales waves beyond defined waves', () => {
    // Start wave 6 (beyond the 5 defined waves)
    for (let i = 0; i < 6; i++) {
      manager.startWave()
      manager.spawnQueue = []
      for (let j = 0; j < manager.enemiesRemaining; j++) {
        manager.onEnemyKilled()
      }
    }
    expect(manager.currentWave).toBe(6)
  })

  it('wave 3 includes runners', () => {
    manager.startWave() // wave 1
    manager.spawnQueue = []
    for (let i = 0; i < 5; i++) manager.onEnemyKilled()

    manager.startWave() // wave 2
    manager.spawnQueue = []
    for (let i = 0; i < 8; i++) manager.onEnemyKilled()

    manager.startWave() // wave 3
    const hasRunners = manager.spawnQueue.some(t => t === 'runner')
    const hasGrunts = manager.spawnQueue.some(t => t === 'grunt')
    expect(hasRunners).toBe(true)
    expect(hasGrunts).toBe(true)
  })

  it('wave pause timer is set after wave completion', () => {
    manager.startWave()
    manager.spawnQueue = []
    for (let i = 0; i < 5; i++) {
      manager.onEnemyKilled()
    }
    // wavePauseTimer should be set to 3
    expect((manager as any).wavePauseTimer).toBe(3)
  })

  it('auto-starts next wave after pause timer expires', () => {
    manager.startWave()
    manager.spawnQueue = []
    for (let i = 0; i < 5; i++) {
      manager.onEnemyKilled()
    }

    // Wave is inactive, advance time past pause
    manager.update(3.1, 28)
    expect(manager.currentWave).toBe(2)
    expect(manager.waveActive).toBe(true)
  })

  it('spawn timer increments during update', () => {
    manager.startWave()
    manager.update(0.3, 28)
    expect((manager as any).spawnTimer).toBeGreaterThan(0)
  })

  it('spawn positions are within arena bounds', () => {
    manager.startWave()
    const onSpawned = vi.fn()
    manager.onEnemySpawned = onSpawned

    // Spawn several enemies and check positions
    for (let i = 0; i < 5; i++) {
      manager.update(1.1, 28)
    }

    const calls = onSpawned.mock.calls
    for (const [enemy] of calls) {
      expect(Math.abs(enemy.mesh.position.x)).toBeLessThanOrEqual(28)
      expect(Math.abs(enemy.mesh.position.z)).toBeLessThanOrEqual(28)
    }
  })

  it('auto defaults to true and auto-starts wave 1 on update', () => {
    const m = new WaveManager()
    m.update(1, 30)
    expect(m.currentWave).toBe(1)
    expect(m.waveActive).toBe(true)
  })

  it('does not auto-start a wave when auto is false', () => {
    const m = new WaveManager()
    m.auto = false
    m.update(1, 30)
    expect(m.currentWave).toBe(0)
    expect(m.waveActive).toBe(false)
    expect(m.spawnQueue.length).toBe(0)
  })

  it('spawnNextWave enqueues the next wave on demand even when auto is false', () => {
    const m = new WaveManager()
    m.auto = false
    expect(m.currentWave).toBe(0)
    m.spawnNextWave()
    expect(m.currentWave).toBe(1)
    expect(m.waveActive).toBe(true)
    expect(m.spawnQueue.length).toBe(5) // wave 1 = 5 grunts

    m.spawnNextWave()
    expect(m.currentWave).toBe(2)
  })

  it('does not auto-advance after a manual wave is cleared when auto is false', () => {
    const m = new WaveManager()
    m.auto = false
    m.spawnNextWave()        // wave 1 active
    m.spawnQueue = []        // drain the spawn queue
    m.enemiesRemaining = 0
    m.onEnemyKilled()        // marks the wave complete (waveActive -> false)
    expect(m.waveActive).toBe(false)
    m.update(10, 30)         // long dt would auto-advance if auto were true
    expect(m.currentWave).toBe(1) // stayed on wave 1
  })
})
