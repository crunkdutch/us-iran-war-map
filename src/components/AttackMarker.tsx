'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import type { AttackEvent } from './WarMap'

const ICON_COLORS: Record<string, string> = {
  airstrike: '#e74c3c',
  missile: '#f39c12',
  naval: '#3498db',
  drone: '#2ecc71',
  cyber: '#9b59b6',
}

const ICON_SYMBOLS: Record<string, string> = {
  airstrike: '⚡',
  missile: '⟡',
  naval: '⛴',
  drone: '✈',
  cyber: '⬡',
}

interface Props {
  attack: AttackEvent
  onSelect: (attack: AttackEvent) => void
  isSelected: boolean
}

export default function AttackMarker({ attack, onSelect, isSelected }: Props) {
  const markerRef = useRef<L.Marker | null>(null)
  const map = useMap()

  useEffect(() => {
    const color = ICON_COLORS[attack.type] || '#2ecc71'
    const symbol = ICON_SYMBOLS[attack.type] || '●'

    // Pulse ring for selected
    const pulseEl = isSelected
      ? `<div style="
          position: absolute;
          top: 50%; left: 50%;
          width: 40px; height: 40px;
          transform: translate(-50%, -50%);
          border: 2px solid ${color};
          border-radius: 50%;
          animation: hudPulse 1.5s ease-in-out infinite;
          pointer-events: none;
        "></div>`
      : ''

    const icon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative; display:flex; align-items:center; justify-content:center;">
          ${pulseEl}
          <div style="
            width: 14px; height: 14px;
            background: ${color};
            border: 2px solid ${isSelected ? '#fff' : '#0a0a0a'};
            border-radius: 50%;
            box-shadow: 0 0 ${isSelected ? '12' : '4'}px ${color}40;
            cursor: pointer;
            transition: all 0.2s;
          "></div>
          <div style="
            position: absolute;
            top: -22px;
            font-size: 11px;
            color: ${color};
            text-shadow: 0 0 6px ${color}60;
            white-space: nowrap;
            font-family: 'JetBrains Mono', monospace;
            ${isSelected ? '' : 'display: none;'}
          ">${attack.title.slice(0, 24)}${attack.title.length > 24 ? '..' : ''}</div>
        </div>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })

    const marker = L.marker(attack.coordinates, { icon })
    marker.on('click', () => onSelect(attack))
    marker.addTo(map)
    markerRef.current = marker

    return () => {
      marker.remove()
    }
  }, [attack, onSelect, map, isSelected])

  return null
}
