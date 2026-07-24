'use client'

import { useMemo } from 'react'
import type { AttackEvent } from './WarMap'

interface Props {
  attacks: AttackEvent[]
  visible: boolean
  onToggle: () => void
}

export default function StatsSidebar({ attacks, visible, onToggle }: Props) {
  const stats = useMemo(() => {
    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let totalMil = 0
    let totalCiv = 0

    for (const a of attacks) {
      byType[a.type] = (byType[a.type] || 0) + 1
      byStatus[a.status] = (byStatus[a.status] || 0) + 1
      totalMil += a.casualties.military
      totalCiv += a.casualties.civilian
    }

    return { byType, byStatus, totalMil, totalCiv, total: attacks.length }
  }, [attacks])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      top: 56,
      left: 16,
      zIndex: 1001,
      width: 220,
      background: 'rgba(0, 12, 6, 0.92)',
      border: '1px solid var(--border-color)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-primary)',
      maxHeight: 'calc(100vh - 100px)',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-color)',
        fontSize: 10,
        color: 'var(--accent-green)',
        letterSpacing: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>THEATER STATS</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)' }}>
          {stats.total}
        </span>
      </div>

      {/* By type */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 6 }}>
          BY TYPE
        </div>
        {Object.entries(TYPE_LABELS).map(([key, label]) => {
          const count = stats.byType[key] || 0
          if (count === 0) return null
          const pct = (count / stats.total) * 100
          return (
            <div key={key} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: TYPE_COLORS[key] }}>{label}</span>
                <span style={{ color: 'var(--text-bright)' }}>{count}</span>
              </div>
              <div style={{
                height: 3,
                background: 'var(--bg-primary)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: TYPE_COLORS[key],
                  borderRadius: 2,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Casualties */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>
          CASUALTIES
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-red)' }}>
              {stats.totalMil}
            </div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>MILITARY</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-amber)' }}>
              {stats.totalCiv}
            </div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>CIVILIAN</div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div style={{ padding: '8px 12px' }}>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>
          STATUS
        </div>
        {Object.entries(stats.byStatus).map(([status, count]) => (
          <div key={status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: STATUS_COLORS[status] || 'var(--text-dim)' }}>
              {status.toUpperCase()}
            </span>
            <span style={{ color: 'var(--text-bright)' }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const TYPE_LABELS: Record<string, string> = {
  airstrike: 'AIRSTRIKE',
  missile: 'MISSILE',
  naval: 'NAVAL',
  drone: 'DRONE',
  cyber: 'CYBER',
}

const TYPE_COLORS: Record<string, string> = {
  airstrike: '#e74c3c',
  missile: '#f39c12',
  naval: '#3498db',
  drone: '#2ecc71',
  cyber: '#9b59b6',
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'var(--accent-green)',
  disputed: 'var(--accent-amber)',
  unconfirmed: 'var(--accent-red)',
}
