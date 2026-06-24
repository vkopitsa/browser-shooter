import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BattlefieldBackground } from '../BattlefieldBackground'

describe('BattlefieldBackground', () => {
  it('renders without crashing', () => {
    const { container } = render(<BattlefieldBackground />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders the root element with bf-root class', () => {
    const { container } = render(<BattlefieldBackground />)
    const root = container.firstChild as HTMLElement
    expect(root.classList.contains('bf-root')).toBe(true)
  })

  it('renders fog layers', () => {
    const { container } = render(<BattlefieldBackground />)
    expect(container.querySelectorAll('.bf-fog').length).toBe(3)
  })

  it('renders soldiers', () => {
    const { container } = render(<BattlefieldBackground />)
    expect(container.querySelectorAll('.bf-soldier').length).toBe(6)
  })

  it('renders helicopter', () => {
    const { container } = render(<BattlefieldBackground />)
    expect(container.querySelector('.bf-heli')).toBeTruthy()
  })
})
