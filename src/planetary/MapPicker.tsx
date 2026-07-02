import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Team } from '../types'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const TEAM_COLOR = { ct: '#3a6ea5', t: '#a5703a' } as const

export interface PlayerDot {
  id: string
  name: string
  lng: number
  lat: number
  team: Team
}

interface MapPickerProps {
  playerPositions: PlayerDot[]
  onTeleport: (lng: number, lat: number) => void
  onJumpToPlayer?: (playerId: string) => void
  onClose: () => void
}

const PLAYER_LAYERS = ['player-clusters', 'player-cluster-count', 'player-points']

function playersToGeoJSON(dots: PlayerDot[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: dots.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, name: p.name, team: p.team },
    })),
  }
}

export function MapPicker({ playerPositions, onTeleport, onJumpToPlayer, onClose }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const playersRef = useRef(playerPositions)
  playersRef.current = playerPositions
  const onJumpRef = useRef(onJumpToPlayer)
  onJumpRef.current = onJumpToPlayer
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      zoom: 2,
      center: [0, 20],
    })
    map.addControl(new maplibregl.NavigationControl())

    map.on('load', () => {
      map.addSource('players', {
        type: 'geojson',
        data: playersToGeoJSON(playersRef.current),
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 16,
      })
      map.addLayer({
        id: 'player-clusters', type: 'circle', source: 'players',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#00a35f',
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 25, 24],
          'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
        },
      })
      map.addLayer({
        id: 'player-cluster-count', type: 'symbol', source: 'players',
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12, 'text-font': ['Noto Sans Regular'] },
        paint: { 'text-color': '#fff' },
      })
      map.addLayer({
        id: 'player-points', type: 'circle', source: 'players',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['match', ['get', 'team'], 'ct', TEAM_COLOR.ct, TEAM_COLOR.t],
          'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
        },
      })

      // Cluster click: zoom in until it breaks apart
      map.on('click', 'player-clusters', e => {
        const f = e.features?.[0]
        if (!f) return
        const src = map.getSource('players') as maplibregl.GeoJSONSource
        src.getClusterExpansionZoom(f.properties.cluster_id as number).then(zoom => {
          map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom })
        })
      })

      // Player click: info popup with a Jump button
      map.on('click', 'player-points', e => {
        const f = e.features?.[0]
        if (!f) return
        const { id, name, team } = f.properties as { id: string; name: string; team: Team }
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number]
        const popup = new maplibregl.Popup({ closeButton: false, offset: 14 })

        const div = document.createElement('div')
        div.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center;font-family:monospace'
        const label = document.createElement('div')
        label.textContent = name
        label.style.cssText = `font-weight:bold;font-size:13px;color:${TEAM_COLOR[team] ?? '#333'}`
        const teamLine = document.createElement('div')
        teamLine.textContent = team === 'ct' ? 'Counter-Terrorist' : 'Terrorist'
        teamLine.style.cssText = 'font-size:11px;color:#666'
        div.append(label, teamLine)
        if (onJumpRef.current) {
          const btn = document.createElement('button')
          btn.textContent = 'Jump'
          btn.style.cssText = 'padding:4px 16px;background:#00a35f;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px'
          btn.onclick = () => { popup.remove(); onJumpRef.current?.(id) }
          div.append(btn)
        }
        popup.setLngLat(coords).setDOMContent(div).addTo(map)
      })

      for (const layer of ['player-points', 'player-clusters']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }
    })

    map.on('click', e => {
      // Clicks on player dots/clusters are handled by their own layers
      const layers = PLAYER_LAYERS.filter(l => map.getLayer(l))
      if (layers.length && map.queryRenderedFeatures(e.point, { layers }).length) return
      setSelectedLocation([e.lngLat.lng, e.lngLat.lat])
      onTeleport(e.lngLat.lng, e.lngLat.lat)
    })
    mapRef.current = map
    // Debug handle for headless drive scripts (same precedent as window.__eng)
    ;(window as unknown as { __pickerMap?: maplibregl.Map }).__pickerMap = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Keep player dots in sync while the picker is open
  useEffect(() => {
    const src = mapRef.current?.getSource?.('players') as maplibregl.GeoJSONSource | undefined
    src?.setData(playersToGeoJSON(playerPositions))
  }, [playerPositions])

  // Green dot showing where the user will drop in
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedLocation) return
    const el = document.createElement('div')
    el.style.cssText = 'width:14px;height:14px;border-radius:50%;background:#00ff88;border:3px solid white;box-shadow:0 0 8px rgba(0,255,136,0.6)'
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(selectedLocation)
      .addTo(map)
    return () => { marker.remove() }
  }, [selectedLocation])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <button
        aria-label="Close map picker"
        onClick={() => { setSelectedLocation(null); onClose() }}
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 101,
          padding: '8px 16px', background: '#222', color: 'white',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
        }}
      >
        Close
      </button>
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px 16px',
        borderRadius: 6, fontSize: 13, pointerEvents: 'none',
      }}>
        Click anywhere to drop in — click a player dot to jump to them
      </div>
    </div>
  )
}
