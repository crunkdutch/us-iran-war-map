'use client'

import { useEffect, useRef } from 'react'
import type { AttackEvent } from './WarMap'

const TYPE_LABELS: Record<string, string> = {
  airstrike: 'AIRSTRIKE',
  missile: 'MISSILE STRIKE',
  naval: 'NAVAL OPERATION',
  drone: 'DRONE OPERATION',
  cyber: 'CYBER ATTACK',
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'var(--accent-green)',
  disputed: 'var(--accent-amber)',
  unconfirmed: 'var(--accent-red)',
}

interface Props {
  attack: AttackEvent | null
  visible: boolean
  onClose: () => void
}

export default function IncidentPanel({ attack, visible, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible, onClose])

  if (!attack) return null

  const totalCasualties =
    (attack.casualties.iranian_mil || 0) + (attack.casualties.iranian_civ || 0) +
    (attack.casualties.us_mil || 0) + (attack.casualties.us_civ || 0) +
    (attack.casualties.kurdish || 0) + (attack.casualties.other || 0)
  const sourceUrl = attack.sources.find(s => s.url && s.url !== '#')?.url || null
  const sourceName = attack.sources.find(s => s.url && s.url !== '#')?.name || null
  const multimediaUrl = attack.satelliteImage || attack.videoUrl || sourceUrl
  const sourceTypes = [...new Set(attack.sources.map(s => s.type))]

  return (
    <div className="incident-panel" style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: Math.min(420, window.innerWidth - 16),
      zIndex: 1002,
      background: 'linear-gradient(270deg, rgba(0,12,6,0.97) 0%, rgba(0,8,4,0.92) 100%)',
      borderLeft: '1px solid var(--border-bright)',
      transform: visible ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.3s ease-out',
      fontFamily: 'var(--font-mono)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '64px 20px 12px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{
              fontSize: 10,
              color: STATUS_COLORS[attack.status] || 'var(--text-dim)',
              border: `1px solid ${STATUS_COLORS[attack.status] || 'var(--text-dim)'}`,
              padding: '1px 6px',
              letterSpacing: 1,
            }}>
              {attack.status.toUpperCase()}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: 1 }}>
              {TYPE_LABELS[attack.type] || attack.type.toUpperCase()}
            </span>
          </div>
          <h2 style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-bright)',
            lineHeight: 1.3,
            margin: 0,
          }}>
            {attack.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            color: 'var(--accent-green)',
            width: 28,
            height: 28,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Date / Location */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <InfoBlock label="DATE" value={attack.date} />
          <InfoBlock label="TIME" value={attack.time} />
          <InfoBlock label="LOCATION" value={attack.location} span={2} />
        </div>

        {/* Coordinates */}
        <InfoBlock
          label="COORDINATES"
          value={`${attack.coordinates[0].toFixed(4)}°N, ${attack.coordinates[1].toFixed(4)}°E`}
        />

        {/* Description */}
        <div>
          <div style={{ fontSize: 9, color: 'var(--accent-green)', letterSpacing: 2, marginBottom: 4 }}>
            SITREP
          </div>
          <p style={{ color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            {attack.description}
          </p>
        </div>

        {/* Casualties */}
        {totalCasualties > 0 && (
          <div>
            <div style={{ fontSize: 9, color: 'var(--accent-green)', letterSpacing: 2, marginBottom: 6 }}>
              CASUALTIES
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {attack.casualties.iranian_mil > 0 && (
                <Badge label="IRAN MIL" value={attack.casualties.iranian_mil} color="var(--accent-red)" />
              )}
              {attack.casualties.iranian_civ > 0 && (
                <Badge label="IRAN CIV" value={attack.casualties.iranian_civ} color="var(--accent-amber)" />
              )}
              {attack.casualties.us_mil > 0 && (
                <Badge label="US MIL" value={attack.casualties.us_mil} color="#3498db" />
              )}
              {attack.casualties.us_civ > 0 && (
                <Badge label="US CIV" value={attack.casualties.us_civ} color="#85c1e9" />
              )}
              {attack.casualties.kurdish > 0 && (
                <Badge label="KURDISH" value={attack.casualties.kurdish} color="#9b59b6" />
              )}
              {attack.casualties.other > 0 && (
                <Badge label="OTHER" value={attack.casualties.other} color="var(--text-dim)" />
              )}
              <Badge label="TOTAL" value={totalCasualties} color="var(--text-bright)" />
            </div>
          </div>
        )}

        {/* Sources */}
        <div>
          <div style={{ fontSize: 9, color: 'var(--accent-green)', letterSpacing: 2, marginBottom: 6 }}>
            SOURCES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {attack.sources.map((s, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: 'var(--text-primary)',
              }}>
                <span style={{
                  fontSize: 8,
                  padding: '1px 4px',
                  border: '1px solid var(--border-color)',
                  color: s.type === 'official' ? 'var(--accent-cyan)' :
                         s.type === 'analyst' ? 'var(--accent-amber)' :
                         'var(--text-dim)',
                  letterSpacing: 1,
                }}>
                  {s.type.slice(0, 4).toUpperCase()}
                </span>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Multimedia section — only show when actual media/source links exist */}
        {multimediaUrl && (
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={multimediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                border: '1px solid var(--border-color)',
                padding: 16,
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--accent-cyan)',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-cyan)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
            >
              🛰 SATELLITE IMAGERY
            </a>
            <a
              href={multimediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                border: '1px solid var(--border-color)',
                padding: 16,
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--accent-amber)',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-amber)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
            >
              📹 VIDEO FOOTAGE
            </a>
          </div>
        )}

        {/* Source link — only when a real source URL exists */}
        {sourceUrl && sourceName && (
          <div style={{ marginTop: 8 }}>
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
              style={{
                fontSize: 11, color: 'var(--accent-green)', textDecoration: 'underline',
                cursor: 'pointer', opacity: 0.7,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
            >
              [ VIEW SOURCE {sourceName.toUpperCase()} → ]
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoBlock({ label, value, span }: { label: string; value: string; span?: number }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <div style={{ fontSize: 9, color: 'var(--accent-green)', letterSpacing: 2, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-bright)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
    </div>
  )
}

function Badge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      <div style={{ fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>
        {label}
      </div>
    </div>
  )
}
