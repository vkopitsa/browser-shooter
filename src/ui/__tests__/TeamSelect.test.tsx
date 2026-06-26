import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamSelect } from '../TeamSelect'
import { DEFAULT_ZONE_ID, ZONES } from '../../zones/registry'
import type { SavedMap } from '../../zones/mapStore'
import { DAYLIGHT } from '../../zones/ZoneDef'

describe('TeamSelect', () => {
  it('calls onSelect with the team and the default zone id', () => {
    const onSelect = vi.fn()
    render(<TeamSelect onSelect={onSelect} />)
    fireEvent.click(screen.getByText(/Counter-Terrorist/i))
    expect(onSelect).toHaveBeenCalledWith('ct', DEFAULT_ZONE_ID, undefined)
    fireEvent.click(screen.getByText(/^Terrorist/i))
    expect(onSelect).toHaveBeenCalledWith('t', DEFAULT_ZONE_ID, undefined)
  })

  it('lets the player choose a zone before picking a side', () => {
    const onSelect = vi.fn()
    render(<TeamSelect onSelect={onSelect} />)
    const haze = ZONES.find((z) => z.id === 'haze')!
    fireEvent.click(screen.getByText(haze.name))
    fireEvent.click(screen.getByText(/Counter-Terrorist/i))
    expect(onSelect).toHaveBeenCalledWith('ct', 'haze', undefined)
  })

  it('renders every selectable zone', () => {
    render(<TeamSelect onSelect={vi.fn()} />)
    for (const z of ZONES) expect(screen.getByText(z.name)).toBeTruthy()
  })
})

describe('TeamSelect custom maps', () => {
  const mockMap: SavedMap = {
    id: 'test1', name: 'My Map', createdAt: 0,
    zone: {
      id: 'z1', name: 'My Map', description: '', arenaSize: 20,
      floorColor: 0x444444, lighting: DAYLIGHT,
      structures: [], ctSpawns: [[0, -10]], tSpawns: [[0, 10]],
      bombsites: [{ id: 'A', center: [10, 0] }, { id: 'B', center: [-10, 0] }],
    },
  }

  it('shows empty state when no custom maps exist', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    render(<TeamSelect onSelect={vi.fn()} onCreateMap={vi.fn()} onEditMap={vi.fn()} />)
    expect(screen.getByText(/No custom maps yet/i)).toBeTruthy()
    vi.restoreAllMocks()
  })

  it('calls onCreateMap when + Create is clicked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    const onCreateMap = vi.fn()
    render(<TeamSelect onSelect={vi.fn()} onCreateMap={onCreateMap} onEditMap={vi.fn()} />)
    fireEvent.click(screen.getByText('+ Create'))
    expect(onCreateMap).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('calls onEditMap with the map when Edit is clicked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify([mockMap]))
    const onEditMap = vi.fn()
    render(<TeamSelect onSelect={vi.fn()} onCreateMap={vi.fn()} onEditMap={onEditMap} />)
    fireEvent.click(screen.getByText('Edit'))
    expect(onEditMap).toHaveBeenCalledWith(mockMap)
    vi.restoreAllMocks()
  })

  it('passes customZone to onSelect when a custom map is selected then team picked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify([mockMap]))
    const onSelect = vi.fn()
    render(<TeamSelect onSelect={onSelect} onCreateMap={vi.fn()} onEditMap={vi.fn()} />)
    fireEvent.click(screen.getByText('My Map'))
    fireEvent.click(screen.getByText(/Counter-Terrorist/i))
    expect(onSelect).toHaveBeenCalledWith('ct', 'custom', mockMap.zone)
    vi.restoreAllMocks()
  })
})
