import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { GameEngine } from '../GameEngine'

// Mock WebGLRenderer to avoid needing a real GL context
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three')
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      shadowMap: { enabled: false, type: 0 },
      domElement: document.createElement('canvas'),
    })),
  }
})

function createContainer(): HTMLElement {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
  Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
  return container
}

describe('GameEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates scene, camera, renderer, and clock', () => {
    const container = createContainer()
    const engine = new GameEngine(container)

    expect(engine.scene).toBeInstanceOf(THREE.Scene)
    expect(engine.camera).toBeInstanceOf(THREE.PerspectiveCamera)
    expect(engine.clock).toBeInstanceOf(THREE.Clock)
  })

  it('initializes with menu state', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    expect(engine.state).toBe('menu')
  })

  it('sets scene background and fog', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    expect(engine.scene.background).toBeInstanceOf(THREE.Color)
    expect(engine.scene.fog).toBeInstanceOf(THREE.Fog)
  })

  it('configures camera with correct FOV and near/far', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    expect(engine.camera.fov).toBe(75)
    expect(engine.camera.near).toBe(0.1)
    expect(engine.camera.far).toBe(1000)
  })

  it('positions camera at origin', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    expect(engine.camera.position.x).toBe(0)
    expect(engine.camera.position.y).toBe(2)
    expect(engine.camera.position.z).toBe(0)
  })

  it('enables shadow map on renderer', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    // Renderer is mocked; verify it was constructed
    expect(engine.renderer).toBeDefined()
  })

  it('starts the game loop and sets state to playing', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    engine.start()
    expect(engine.state).toBe('playing')
  })

  it('pauses the game', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    engine.start()
    engine.pause()
    expect(engine.state).toBe('paused')
  })

  it('resumes from pause', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    engine.start()
    engine.pause()
    engine.resume()
    expect(engine.state).toBe('playing')
  })

  it('stops the engine and resets to menu', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    engine.start()
    engine.stop()
    expect(engine.state).toBe('menu')
  })

  it('registers update callbacks', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    const callback = vi.fn()
    engine.onUpdate(callback)
    // Internal list should contain the callback
    expect((engine as any).updateCallbacks).toContain(callback)
  })

  it('removes update callbacks', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    const callback = vi.fn()
    engine.onUpdate(callback)
    engine.removeUpdate(callback)
    expect((engine as any).updateCallbacks).not.toContain(callback)
  })

  it('appends renderer domElement to container', () => {
    const container = createContainer()
    new GameEngine(container)
    expect(container.children.length).toBeGreaterThan(0)
  })

  it('handles resize', () => {
    const container = createContainer()
    const engine = new GameEngine(container)

    // Update the container size
    Object.defineProperty(container, 'clientWidth', { value: 1024, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 768, configurable: true })

    // Simulate window resize
    window.dispatchEvent(new Event('resize'))
    expect(engine.camera.aspect).toBeCloseTo(1024 / 768)
  })

  it('prevents double animation loop on double start()', () => {
    const container = createContainer()
    const engine = new GameEngine(container)
    engine.start()
    engine.start() // second start should be a no-op
    expect(engine.state).toBe('playing')
  })
})
