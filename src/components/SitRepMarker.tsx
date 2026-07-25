'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'

interface SitRep {
  id: number
  type: string
  location: string
  coordinates: number[]
  date: string
  source: string
  sourceUrl: string
  description: string
  media: { url: string; type: string }[]
  verified: boolean
}

const TYPE_COLORS: Record<string, string> = {
  launch: '#f39c12',
  strike: '#e74c3c',
  drone: '#2ecc71',
  intercept: '#3498db',
  casualty: '#e74c3c',
  naval: '#3498db',
  statement: '#9b59b6',
  report: '#666666',
}

interface Props {
  sitrep: SitRep
  onClick: (s: SitRep) => void
}

export default function SitRepMarker({ sitrep, onClick }: Props) {
  const markerRef = useRef<L.Marker | null>(null)
  const map = useMap()

  useEffect(() => {
    const color = TYPE_COLORS[sitrep.type] || '#666666'

    const icon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative; display:flex; align-items:center; justify-content:center;">
          <div style="
            width: 9px; height: 9px;
            background: ${color};
            border: 1px solid rgba(255,255,255,0.5);
            border-radius: 50%;
            opacity: 0.7;
            cursor: pointer;
            transition: all 0.2s;
          "></div>
        </div>
      `,
      iconSize: [9, 9],
      iconAnchor: [4.5, 4.5],
    })

    const marker = L.marker(sitrep.coordinates as [number, number], { icon })

    const popupContent = `
      <div style="
        font-family: 'JetBrains Mono', monospace;
        background: #0a0a0a;
        color: #c0c0c0;
        font-size: 11px;
        line-height: 1.5;
        max-width: 260px;
      ">
        <div style="color: ${color}; font-weight: 600; font-size: 10px; letter-spacing: 1px; margin-bottom: 4px;">
          ${sitrep.type.toUpperCase()}  —  ${sitrep.date}
        </div>
        <div style="color: #ffffff; font-weight: 500; margin-bottom: 4px;">
          ${sitrep.location}
        </div>
        <div style="margin-bottom: 4px;">
          ${sitrep.description.slice(0, 200)}${sitrep.description.length > 200 ? '...' : ''}
        </div>
        <div style="color: #666666; font-size: 10px;">
          ${sitrep.source}
        </div>
      </div>
    `

    marker.bindPopup(popupContent, {
      className: '',
      closeButton: true,
      minWidth: 240,
      maxWidth: 300,
    })

    marker.addTo(map)
    markerRef.current = marker

    return () => { marker.remove() }
  }, [sitrep, map, onClick])

  return null
}
