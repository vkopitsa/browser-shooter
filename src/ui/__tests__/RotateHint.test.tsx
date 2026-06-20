import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RotateHint } from '../RotateHint'

describe('RotateHint', () => {
  it('renders nothing', () => {
    render(<RotateHint enabled />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
