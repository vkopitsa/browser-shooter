import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreSystem } from '../ScoreSystem'

describe('ScoreSystem', () => {
  beforeEach(() => {
    localStorage.removeItem('browser-shooter-highscore')
  })

  it('starts at score 0 and wave 0', () => {
    const score = new ScoreSystem()
    expect(score.score).toBe(0)
    expect(score.wave).toBe(0)
  })

  it('loads high score from localStorage', () => {
    localStorage.setItem('browser-shooter-highscore', '5000')
    const score = new ScoreSystem()
    expect(score.highScore).toBe(5000)
  })

  it('starts with high score 0 when no localStorage entry', () => {
    const score = new ScoreSystem()
    expect(score.highScore).toBe(0)
  })

  it('adds kill points', () => {
    const score = new ScoreSystem()
    score.addKill(100)
    expect(score.score).toBe(100)
  })

  it('accumulates multiple kills', () => {
    const score = new ScoreSystem()
    score.addKill(100)
    score.addKill(150)
    score.addKill(300)
    expect(score.score).toBe(550)
  })

  it('completes wave and increments wave counter', () => {
    const score = new ScoreSystem()
    score.completeWave()
    expect(score.wave).toBe(1)
  })

  it('wave 1 gives 500 bonus', () => {
    const score = new ScoreSystem()
    score.completeWave()
    expect(score.score).toBe(500)
  })

  it('wave 2 gives 1000 bonus', () => {
    const score = new ScoreSystem()
    score.completeWave()
    score.completeWave()
    expect(score.score).toBe(1500) // 500 + 1000
  })

  it('wave bonus scales linearly with wave number', () => {
    const score = new ScoreSystem()
    for (let i = 0; i < 5; i++) {
      score.completeWave()
    }
    // 500 + 1000 + 1500 + 2000 + 2500 = 7500
    expect(score.score).toBe(7500)
    expect(score.wave).toBe(5)
  })

  it('combines kills and wave bonuses', () => {
    const score = new ScoreSystem()
    score.addKill(100)
    score.addKill(200)
    score.completeWave()
    expect(score.score).toBe(800) // 300 + 500
  })

  it('saves high score to localStorage', () => {
    const score = new ScoreSystem()
    score.addKill(1000)
    score.saveHighScore()
    expect(score.highScore).toBe(1000)
    expect(localStorage.getItem('browser-shooter-highscore')).toBe('1000')
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

  it('updates high score when beaten', () => {
    localStorage.setItem('browser-shooter-highscore', '1000')
    const score = new ScoreSystem()
    score.addKill(2000)
    score.saveHighScore()
    expect(score.highScore).toBe(2000)
  })

  it('resets score and wave but keeps high score', () => {
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

  it('handles zero kill points', () => {
    const score = new ScoreSystem()
    score.addKill(0)
    expect(score.score).toBe(0)
  })

  it('handles many kills', () => {
    const score = new ScoreSystem()
    for (let i = 0; i < 100; i++) {
      score.addKill(100)
    }
    expect(score.score).toBe(10000)
  })

  it('handles NaN high score in localStorage', () => {
    localStorage.setItem('browser-shooter-highscore', 'not-a-number')
    const score = new ScoreSystem()
    expect(score.highScore).toBe(0)
  })
})
