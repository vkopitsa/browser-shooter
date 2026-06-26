import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { KeybindsScreen } from '../KeybindsScreen'
import { DEFAULT_SETTINGS } from '../../settings/Settings'

afterEach(cleanup)

describe('KeybindsScreen', () => {
  const base = { settings: DEFAULT_SETTINGS, onChange: () => {}, onBack: () => {} }

  it('renders the Chat & Console section with all three bindings', () => {
    render(<KeybindsScreen {...base} />)
    expect(screen.getByText('CHAT & CONSOLE')).toBeInTheDocument()
    expect(screen.getByText('All-chat')).toBeInTheDocument()
    expect(screen.getByText('Team-chat')).toBeInTheDocument()
    expect(screen.getByText('Console')).toBeInTheDocument()
  })
})
