'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import attackData from '@/data/attacks.json'
import sitrepData from '@/data/sitreps.json'
import IncidentPanel from './IncidentPanel'
import StatsSidebar from './StatsSidebar'

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export interface AttackEvent {
  id: number; type: string; title: string; location: string
  coordinates: number[]; date: string; time: string; status: string
  sources: { name: string; url: string; type: string }[]
  casualties: {
    iranian_mil: number; iranian_civ: number;
    us_mil: number; us_civ: number;
    kurdish: number; other: number;
  }
  description: string; satelliteImage: string | null; videoUrl: string | null
  media: { url: string; type: string; thumbnail?: string | null }[]
}

export interface SitRep {
  id: number; type: string; location: string; coordinates: number[]
  date: string; source: string; sourceUrl: string
  description: string; media: { url: string; type: string; thumbnail?: string | null }[]; verified: boolean
}

const allAttacks = attackData as AttackEvent[]
const allSitreps = sitrepData as SitRep[]

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'

// ── Performance limits ──
const MAX_ATTACK_MARKERS = 5000
const MAX_SITREP_MARKERS = 2000

// ── DATE PRESETS ──
const DATE_PRESETS = [
  { label: '24H', days: 1 },
  { label: '3D', days: 3 },
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'ALL', days: Infinity },
] as const

function filterByDate<T extends { date: string }>(items: T[], days: number): T[] {
  if (days === Infinity) return items
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return items.filter(item => {
    const d = new Date(item.date)
    return d >= cutoff
  })
}

// ── Component that adds markers to cluster groups ──
function MarkerLayers({
  attacks,
  sitreps,
  onSelect,
  selectedId,
  onSitrepClick,
}: {
  attacks: AttackEvent[]
  sitreps: SitRep[]
  onSelect: (a: AttackEvent) => void
  selectedId: number | null
  onSitrepClick: (s: SitRep) => void
}) {
  const map = useMap()
  const attackClusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const sitrepClusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const attackDivMap = useRef<Map<number, L.Marker>>(new Map())
  const sitrepDivMap = useRef<Map<number, L.Marker>>(new Map())

  // ── Attack marker icon factory ──
  const attackIcon = useCallback((a: AttackEvent, selected: boolean) => {
    const color: Record<string, string> = {
      airstrike: '#e74c3c', missile: '#f39c12', naval: '#3498db',
      drone: '#2ecc71', cyber: '#9b59b6',
    }
    const c = color[a.type] || '#2ecc71'
    return L.divIcon({
      className: '',
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center">
          ${selected ? `<div style="position:absolute;width:40px;height:40px;transform:translate(-50%,-50%);border:2px solid ${c};border-radius:50%;animation:hudPulse 1.5s ease-in-out infinite;pointer-events:none"></div>` : ''}
          <div style="width:14px;height:14px;background:${c};border:2px solid ${selected ? '#fff' : '#0a0a0a'};border-radius:50%;box-shadow:0 0 ${selected ? 12 : 4}px ${c}40;cursor:pointer;transition:all 0.2s"></div>
          <div style="position:absolute;top:-22px;font-size:11px;color:${c};text-shadow:0 0 6px ${c}60;white-space:nowrap;font-family:'JetBrains Mono',monospace;${selected ? '' : 'display:none'}">${a.title.slice(0, 24)}${a.title.length > 24 ? '..' : ''}</div>
        </div>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })
  }, [])

  // ── Sitrep marker icon factory ──
  const sitrepIcon = useCallback((s: SitRep) => {
    const color: Record<string, string> = {
      launch: '#f39c12', strike: '#e74c3c', drone: '#2ecc71',
      intercept: '#3498db', casualty: '#e74c3c', naval: '#3498db',
      statement: '#9b59b6', report: '#666666',
    }
    const c = color[s.type] || '#666'
    return L.divIcon({
      className: '',
      html: `<div style="width:9px;height:9px;background:${c};border:1px solid rgba(255,255,255,0.5);border-radius:50%;opacity:0.7;cursor:pointer"></div>`,
      iconSize: [9, 9],
      iconAnchor: [4.5, 4.5],
    })
  }, [])

  // ── Setup cluster groups once ──
  useEffect(() => {
    const isHeavy = attacks.length > 3000
    const ac = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: isHeavy ? 200 : 100,
      maxClusterRadius: isHeavy ? 80 : 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: isHeavy ? 6 : 7,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        let color = '#2ecc71'
        if (count >= 20) color = '#e74c3c'
        else if (count >= 5) color = '#f39c12'
        return L.divIcon({
          className: '',
          html: `<div style="width:${count >= 20 ? 50 : 40}px;height:${count >= 20 ? 50 : 40}px;border-radius:50%;background:${color}30;display:flex;align-items:center;justify-content:center;border:2px solid ${color}"><span style="color:#fff;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:${count >= 100 ? 11 : 13}px">${count}</span></div>`,
          iconSize: [count >= 20 ? 50 : 40, count >= 20 ? 50 : 40],
          iconAnchor: [count >= 20 ? 25 : 20, count >= 20 ? 25 : 20],
        })
      },
    })
    map.addLayer(ac)
    attackClusterRef.current = ac

    const sc = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 8,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        return L.divIcon({
          className: '',
          html: `<div style="width:32px;height:32px;border-radius:50%;background:#66666630;display:flex;align-items:center;justify-content:center;border:2px solid #666"><span style="color:#aaa;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px">${count}</span></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })
      },
    })
    map.addLayer(sc)
    sitrepClusterRef.current = sc

    return () => {
      map.removeLayer(ac)
      map.removeLayer(sc)
    }
  }, [map])

  // ── Sync attack markers (capped at MAX_ATTACK_MARKERS for perf) ──
  useEffect(() => {
    const cluster = attackClusterRef.current
    if (!cluster) return
    const prevMap = attackDivMap.current

    // Cap markers for performance when dataset is huge
    const capped = attacks.length > MAX_ATTACK_MARKERS
      ? attacks.slice(attacks.length - MAX_ATTACK_MARKERS)
      : attacks
    const attackSet = new Set(capped.map(a => a.id))

    // Remove stale markers
    for (const [id, marker] of prevMap) {
      if (!attackSet.has(id)) {
        cluster.removeLayer(marker)
        prevMap.delete(id)
      }
    }

    // Add/update markers
    for (const a of capped) {
      if (prevMap.has(a.id)) {
        // Update icon if selection changed
        const m = prevMap.get(a.id)!
        m.setIcon(attackIcon(a, selectedId === a.id))
      } else {
        const m = L.marker(a.coordinates as [number, number], {
          icon: attackIcon(a, selectedId === a.id),
        })
        m.bindPopup(`<div style="font-family:'JetBrains Mono',monospace;background:#0a0a0a;color:#c0c0c0;font-size:11px;max-width:280px"><div style="color:${a.type === 'airstrike' ? '#e74c3c' : a.type === 'missile' ? '#f39c12' : '#2ecc71'};font-weight:600;letter-spacing:1px;margin-bottom:4px">${a.date}  •  ${a.type.toUpperCase()}</div><div style="color:#fff;font-weight:500;margin-bottom:4px">${a.title}</div><div style="margin-bottom:4px;line-height:1.5">${a.description.slice(0, 200)}${a.description.length > 200 ? '...' : ''}</div></div>`)
        m.on('click', () => onSelect(a))
        cluster.addLayer(m)
        prevMap.set(a.id, m)
      }
    }
  }, [attacks, attackIcon, onSelect, selectedId])

  // ── Sync sitrep markers (capped at MAX_SITREP_MARKERS for perf) ──
  useEffect(() => {
    const cluster = sitrepClusterRef.current
    if (!cluster) return
    const prevMap = sitrepDivMap.current

    const capped = sitreps.length > MAX_SITREP_MARKERS
      ? sitreps.slice(sitreps.length - MAX_SITREP_MARKERS)
      : sitreps
    const sitrepSet = new Set(capped.map(s => s.id))

    for (const [id, marker] of prevMap) {
      if (!sitrepSet.has(id)) {
        cluster.removeLayer(marker)
        prevMap.delete(id)
      }
    }

    for (const s of capped) {
      if (!prevMap.has(s.id)) {
        const m = L.marker(s.coordinates as [number, number], {
          icon: sitrepIcon(s),
        })
        const color: Record<string, string> = {
          launch: '#f39c12', strike: '#e74c3c', drone: '#2ecc71',
          intercept: '#3498db', casualty: '#e74c3c', naval: '#3498db',
          statement: '#9b59b6', report: '#666',
        }
        m.bindPopup(`<div style="font-family:'JetBrains Mono',monospace;background:#0a0a0a;color:#c0c0c0;font-size:11px;max-width:260px"><div style="color:${color[s.type] || '#666'};font-weight:600;letter-spacing:1px;margin-bottom:4px">${s.type.toUpperCase()}  —  ${s.date}</div><div style="color:#fff;font-weight:500;margin-bottom:4px">${s.location}</div><div style="margin-bottom:4px;line-height:1.5">${s.description.slice(0, 200)}${s.description.length > 200 ? '...' : ''}</div><div style="color:#666;font-size:10px">${s.source}</div></div>`)
        m.on('click', () => onSitrepClick(s))
        cluster.addLayer(m)
        prevMap.set(s.id, m)
      }
    }
  }, [sitreps, sitrepIcon, onSitrepClick])

  return null
}

export default function WarMap() {
  const [selectedAttack, setSelectedAttack] = useState<AttackEvent | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [showStats, setShowStats] = useState(true)
  const [selectedSitrep, setSelectedSitrep] = useState<SitRep | null>(null)
  const [dateRange, setDateRange] = useState<number>(7) // Default: 7 days

  const handleSelect = useCallback((attack: AttackEvent) => {
    setSelectedAttack(attack)
    setShowPanel(true)
  }, [])

  const handleClose = useCallback(() => {
    setShowPanel(false)
    setTimeout(() => setSelectedAttack(null), 300)
  }, [])

  const handleSitrepClick = useCallback((s: SitRep) => {
    setSelectedSitrep(s)
  }, [])

  // Filter data by date
  const filteredAttacks = useMemo(
    () => filterByDate(allAttacks, dateRange),
    [dateRange]
  )
  const filteredSitreps = useMemo(
    () => filterByDate(allSitreps, dateRange),
    [dateRange]
  )

  // Show date range from the earliest filtered attack
  const dateLabel = useMemo(() => {
    if (dateRange === Infinity) return 'ALL'
    return `${DATE_PRESETS.find(p => p.days === dateRange)?.label || '7D'}`
  }, [dateRange])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <MapContainer
        center={[32.5, 48.0]} zoom={5} zoomControl={false}
        style={{ width: '100%', height: '100%' }}
        maxBounds={[[10, 20], [45, 70]]}
      >
        <ZoomControl position="bottomright" />
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />

        <MarkerLayers
          attacks={filteredAttacks}
          sitreps={filteredSitreps}
          onSelect={handleSelect}
          selectedId={selectedAttack?.id ?? null}
          onSitrepClick={handleSitrepClick}
        />
      </MapContainer>

      <StatsSidebar
        attacks={filteredAttacks}
        sitreps={filteredSitreps}
        visible={showStats}
        selectedSitrep={selectedSitrep}
        onToggle={() => setShowStats(s => !s)}
        dateRange={dateRange}
      />

      <IncidentPanel attack={selectedAttack} visible={showPanel} onClose={handleClose} />

      {/* ── Date range selector ── */}
      <div style={{
        position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)',
        zIndex: 1001, display: 'flex', gap: 2,
        background: 'rgba(0,12,6,0.85)', border: '1px solid var(--border-color)',
        padding: 2,
      }}>
        {DATE_PRESETS.map(p => (
          <button key={p.label} onClick={() => setDateRange(p.days)} style={{
            padding: '4px 10px',
            background: dateRange === p.days ? 'rgba(46,204,113,0.15)' : 'transparent',
            border: dateRange === p.days ? '1px solid var(--accent-green)' : '1px solid transparent',
            color: dateRange === p.days ? 'var(--accent-green)' : 'var(--text-dim)',
            fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer',
            letterSpacing: 1, transition: 'all 0.15s',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Marker count badge + performance warning ── */}
      {(() => {
        const capped = filteredAttacks.length > MAX_ATTACK_MARKERS
        const sitrepCapped = filteredSitreps.length > MAX_SITREP_MARKERS
        const showWarning = capped || sitrepCapped
        const shownAttacks = capped ? filteredAttacks.slice(-MAX_ATTACK_MARKERS) : filteredAttacks
        const shownSitreps = sitrepCapped ? filteredSitreps.slice(-MAX_SITREP_MARKERS) : filteredSitreps
        return (
          <div style={{
            position: 'fixed', top: 92, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1001, fontSize: 9, color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)', letterSpacing: 1,
            background: showWarning ? 'rgba(231,76,60,0.12)' : 'rgba(0,12,6,0.7)',
            border: showWarning ? '1px solid rgba(231,76,60,0.3)' : '1px solid transparent',
            padding: '4px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
            maxWidth: 'calc(100vw - 200px)',
          }}>
            <span>
              {dateLabel} · {shownAttacks.length} strikes · {shownSitreps.length} reports
            </span>
            {showWarning && (
              <span style={{ color: '#e74c3c', fontSize: 8 }}>
                ⚠ {filteredAttacks.length.toLocaleString()} total — map shows newest {MAX_ATTACK_MARKERS.toLocaleString()}
              </span>
            )}
          </div>
        )
      })()}

      <button className="stats-toggle" onClick={() => setShowStats(s => !s)} style={{
        position: 'fixed', top: 56, right: 16, zIndex: 1001,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        color: 'var(--accent-green)', fontFamily: 'var(--font-mono)',
        fontSize: 11, padding: '6px 12px', cursor: 'pointer', letterSpacing: 1,
      }}>
        {showStats ? '× STATS' : '≡ STATS'}
      </button>
    </div>
  )
}
