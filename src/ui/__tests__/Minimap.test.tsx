import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import * as THREE from 'three'
import { Minimap } from '../Minimap'

const defaultProps = {
  playerPosition: new THREE.Vector3(0, 0, 0),
  playerRotation: 0,
  enemies: [],
  arenaSize: 50,
}

describe('Minimap', () => {
  it('renders a canvas element', () => {
    const { container } = render(<Minimap {...defaultProps} />)
    expect(container.querySelector('canvas')).toBeTruthy()
  })
})

describe('bombsite markers', () => {
  it('renders with bombsites prop without errors', () => {
    const bombsites = [
      { id: 'A', position: { x: 0, z: -25 } },
      { id: 'B', position: { x: 0, z: 25 } },
    ]
    const { container } = render(
      <Minimap {...defaultProps} bombsites={bombsites} />
    )
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('renders with bombPosition prop without errors', () => {
    const bombsites = [
      { id: 'A', position: { x: 0, z: -25 } },
      { id: 'B', position: { x: 0, z: 25 } },
    ]
    const bombPosition = { x: 5, z: 10 }
    const { container } = render(
      <Minimap {...defaultProps} bombsites={bombsites} bombPosition={bombPosition} />
    )
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('renders with bombCarrier prop without errors', () => {
    const bombsites = [
      { id: 'A', position: { x: 0, z: -25 } },
      { id: 'B', position: { x: 0, z: 25 } },
    ]
    const { container } = render(
      <Minimap {...defaultProps} bombsites={bombsites} bombCarrier="player1" />
    )
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('renders without bombsites or bombPosition', () => {
    const { container } = render(<Minimap {...defaultProps} />)
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('accepts bombsites with different ids', () => {
    const bombsites = [
      { id: 'A', position: { x: -10, z: -20 } },
      { id: 'B', position: { x: 10, z: 20 } },
    ]
    const { container } = render(
      <Minimap {...defaultProps} bombsites={bombsites} />
    )
    expect(container.querySelector('canvas')).toBeTruthy()
  })
})
