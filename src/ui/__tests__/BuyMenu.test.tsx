import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BuyMenu } from '../BuyMenu'

describe('BuyMenu', () => {
  it('shows the team catalog and hides the other team', () => {
    render(<BuyMenu team="ct" money={16000} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('M4')).toBeTruthy()       // CT weapon
    expect(screen.queryByText('AK-47')).toBeNull()    // T weapon hidden
    expect(screen.getByText('Kevlar')).toBeTruthy()   // shared gear
  })

  it('calls onBuy with the item id', () => {
    const onBuy = vi.fn()
    render(<BuyMenu team="t" money={16000} owned={[]} onBuy={onBuy} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('AK-47'))
    expect(onBuy).toHaveBeenCalledWith('ak')
  })

  it('disables items the player cannot afford', () => {
    render(<BuyMenu team="ct" money={100} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} />)
    const m4 = screen.getByText('M4').closest('button') as HTMLButtonElement
    expect(m4.disabled).toBe(true)
  })

  it('marks owned items and does not fire onBuy for them', () => {
    const onBuy = vi.fn()
    render(<BuyMenu team="ct" money={16000} owned={['m4']} onBuy={onBuy} onClose={vi.fn()} />)
    const m4 = screen.getByText('M4').closest('button') as HTMLButtonElement
    expect(m4.disabled).toBe(true)
    fireEvent.click(m4)
    expect(onBuy).not.toHaveBeenCalled()
  })
})
