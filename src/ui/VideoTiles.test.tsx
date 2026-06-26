import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { VideoTiles } from './VideoTiles'

afterEach(cleanup)

// jsdom doesn't support srcObject; silence the assignment
Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
  set: vi.fn(),
  get: vi.fn(() => null),
})

function fakeStream(): MediaStream {
  return {} as MediaStream
}

describe('VideoTiles', () => {
  it('renders nothing when no streams and no selfStream', () => {
    const { container } = render(<VideoTiles streams={new Map()} selfStream={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one video for selfStream', () => {
    const { container } = render(<VideoTiles streams={new Map()} selfStream={fakeStream()} />)
    const videos = container.querySelectorAll('video')
    expect(videos).toHaveLength(1)
    expect(videos[0].muted).toBe(true)
  })

  it('renders one video per remote stream', () => {
    const streams = new Map([['p1', fakeStream()], ['p2', fakeStream()]])
    const { container } = render(<VideoTiles streams={streams} selfStream={null} />)
    const videos = container.querySelectorAll('video')
    expect(videos).toHaveLength(2)
  })

  it('renders self + remote streams together', () => {
    const streams = new Map([['p1', fakeStream()]])
    const { container } = render(<VideoTiles streams={streams} selfStream={fakeStream()} />)
    const videos = container.querySelectorAll('video')
    expect(videos).toHaveLength(2)
    expect(videos[0].muted).toBe(true) // self-preview is first and muted
  })
})
