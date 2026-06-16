import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamSelect } from '../TeamSelect'

describe('TeamSelect', () => {
  it('calls onSelect with ct or t', () => {
    const onSelect = vi.fn()
    render(<TeamSelect onSelect={onSelect} />)
    fireEvent.click(screen.getByText(/Counter-Terrorist/i))
    expect(onSelect).toHaveBeenCalledWith('ct')
    fireEvent.click(screen.getByText(/^Terrorist/i))
    expect(onSelect).toHaveBeenCalledWith('t')
  })
})
