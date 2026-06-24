import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchmakingButton } from '../MatchmakingButton'

describe('MatchmakingButton', () => {
  it('renders quick match button', () => {
    const onFind = vi.fn()
    render(<MatchmakingButton onFind={onFind} queuing={false} />)
    expect(screen.getByText('QUICK MATCH')).toBeDefined()
  })

  it('shows queuing state', () => {
    const onCancel = vi.fn()
    render(<MatchmakingButton onCancel={onCancel} queuing={true} />)
    expect(screen.getByText('SEARCHING...')).toBeDefined()
    expect(screen.getByText('CANCEL')).toBeDefined()
  })

  it('calls onFind when clicked while not queuing', () => {
    const onFind = vi.fn()
    render(<MatchmakingButton onFind={onFind} queuing={false} />)
    fireEvent.click(screen.getByText('QUICK MATCH'))
    expect(onFind).toHaveBeenCalled()
  })

  it('calls onCancel when clicked while queuing', () => {
    const onCancel = vi.fn()
    render(<MatchmakingButton onCancel={onCancel} queuing={true} />)
    fireEvent.click(screen.getByText('CANCEL'))
    expect(onCancel).toHaveBeenCalled()
  })
})
