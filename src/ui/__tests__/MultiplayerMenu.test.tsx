import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MultiplayerMenu } from '../MultiplayerMenu'

describe('MultiplayerMenu', () => {
  it('host flow calls onHost and shows the room code + player list', () => {
    const onHost = vi.fn(); const onJoin = vi.fn(); const onStart = vi.fn()
    render(<MultiplayerMenu roomCode="ROOM42" players={['You', 'Bob']} isHost
      onHost={onHost} onJoin={onJoin} onStart={onStart} onBack={vi.fn()} />)
    expect(screen.getByText('ROOM42')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/start/i))
    expect(onStart).toHaveBeenCalled()
  })

  it('join flow submits an entered code', () => {
    const onJoin = vi.fn()
    render(<MultiplayerMenu roomCode={null} players={[]} isHost={false}
      onHost={vi.fn()} onJoin={onJoin} onStart={vi.fn()} onBack={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/room code/i), { target: { value: 'ABC123' } })
    fireEvent.click(screen.getByText(/^join$/i))
    expect(onJoin).toHaveBeenCalledWith('ABC123')
  })
})
