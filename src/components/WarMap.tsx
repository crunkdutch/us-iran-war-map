'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import attackData from '@/data/attacks.json'
import AttackMarker from './AttackMarker'
import IncidentPanel from './IncidentPanel'
import StatsSidebar from './StatsSidebar'

// ── Fix Leaflet default marker icon paths ──
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export interface AttackEvent {
  id: number
  type: string
  title: string
  location: string
  coordinates: [number, number]
  date: string
  time: string
  status: string
  sources: { name: string; url: string; type: string }[]
  casualties: { military: number; civilian: number }
  description: string
  satelliteImage: string | null
  videoUrl: string | null
}

const attacks = attackData as AttackEvent[]

// ── Dark military tile layer ──
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'

function MapBounds() {
  useMapEvents({
    moveend: () => {},
  })
  return null
}

export default function WarMap() {
  const [selectedAttack, setSelectedAttack] = useState<AttackEvent | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [showStats, setShowStats] = useState(true)

  const handleSelect = useCallback((attack: AttackEvent) => {
    setSelectedAttack(attack)
    setShowPanel(true)
  }, [])

  const handleClose = useCallback(() => {
    setShowPanel(false)
    setTimeout(() => setSelectedAttack(null), 300)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <MapContainer
        center={[32.5, 48.0]}
        zoom={5}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
        maxBounds={[[10, 20], [45, 70]]}
      >
        <ZoomControl position="bottomright" />
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        <MapBounds />

        {attacks.map(attack => (
          <AttackMarker
            key={attack.id}
            attack={attack}
            onSelect={handleSelect}
            isSelected={selectedAttack?.id === attack.id}
          />
        ))}
      </MapContainer>

      {/* ── Stats sidebar (stats + statements) ── */}
      <StatsSidebar
        attacks={attacks}
        visible={showStats}
        onToggle={() => setShowStats(s => !s)}
      />

      {/* ── Incident panel ── */}
      <IncidentPanel
        attack={selectedAttack}
        visible={showPanel}
        onClose={handleClose}
      />

      {/* ── Toggle stats button ── */}
      <button
        onClick={() => setShowStats(s => !s)}
        style={{
          position: 'fixed',
          top: 56,
          right: 16,
          zIndex: 1001,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          color: 'var(--accent-green)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          padding: '6px 12px',
          cursor: 'pointer',
          letterSpacing: 1,
        }}
      >
        {showStats ? '× STATS' : '≡ STATS'}
      </button>
    </div>
  )
}
