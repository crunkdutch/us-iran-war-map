'use client'

import { useState, useMemo } from 'react'
import type { AttackEvent } from './WarMap'
import statementsData from '@/data/statements.json'

interface Statement {
  id: number
  source: string
  sourceLabel: string
  type: string
  date: string
  time: string
  title: string
  summary: string
  quote: string
  url: string
  sourceChannel: string
  confidence: string
}

const allStatements = statementsData as Statement[]
const STATEMENT_SOURCE_COLORS: Record<string, string> = {
  CENTCOM: '#3498db',
  'Khatam al Anbiya': '#2ecc71',
}

interface Props {
  attacks: AttackEvent[]
  visible: boolean
  onToggle: () => void
}

export default function StatsSidebar({ attacks, visible, onToggle }: Props) {
  const [tab, setTab] = useState<'stats' | 'stmts'>('stats')
  const [stmtFilter, setStmtFilter] = useState<'all' | 'CENTCOM' | 'Khatam al Anbiya'>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)

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

  const filteredStatements = useMemo(() => {
    if (stmtFilter === 'all') return allStatements
    return allStatements.filter(s => s.source === stmtFilter)
  }, [stmtFilter])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      top: 56,
      left: 16,
      zIndex: 1001,
      width: 260,
      background: 'rgba(0, 12, 6, 0.92)',
      border: '1px solid var(--border-color)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-primary)',
      maxHeight: 'calc(100vh - 100px)',
      overflowY: 'auto',
    }}>
      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setTab('stats')}
          style={{
            flex: 1,
            padding: '8px 8px',
            background: tab === 'stats' ? 'rgba(255,255,255,0.05)' : 'transparent',
            border: 'none',
            borderBottom: tab === 'stats' ? '2px solid var(--accent-green)' : '2px solid transparent',
            color: tab === 'stats' ? 'var(--text-bright)' : 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            cursor: 'pointer',
            letterSpacing: 2,
          }}
        >
          STATS
        </button>
        <button
          onClick={() => setTab('stmts')}
          style={{
            flex: 1,
            padding: '8px 8px',
            background: tab === 'stmts' ? 'rgba(255,255,255,0.05)' : 'transparent',
            border: 'none',
            borderBottom: tab === 'stmts' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            color: tab === 'stmts' ? 'var(--text-bright)' : 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            cursor: 'pointer',
            letterSpacing: 2,
          }}
        >
          STMTS
        </button>
      </div>

      {/* ── STATS TAB ── */}
      {tab === 'stats' && (
        <>
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
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)' }}>{stats.total}</span>
          </div>

          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 6 }}>BY TYPE</div>
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
                  <div style={{ height: 3, background: 'var(--bg-primary)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: TYPE_COLORS[key], borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>CASUALTIES</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-red)' }}>{stats.totalMil}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>MILITARY</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-amber)' }}>{stats.totalCiv}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>CIVILIAN</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>STATUS</div>
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: STATUS_COLORS[status] || 'var(--text-dim)' }}>{status.toUpperCase()}</span>
                <span style={{ color: 'var(--text-bright)' }}>{count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── STATEMENTS TAB ── */}
      {tab === 'stmts' && (
        <>
          <div style={{
            padding: '8px 8px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            gap: 4,
          }}>
            {(['all', 'CENTCOM', 'Khatam al Anbiya'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStmtFilter(f)}
                style={{
                  flex: 1,
                  padding: '4px 4px',
                  background: stmtFilter === f ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: `1px solid ${stmtFilter === f ? (f === 'CENTCOM' ? '#3498db' : f === 'Khatam al Anbiya' ? '#2ecc71' : 'var(--accent-cyan)') : 'transparent'}`,
                  color: stmtFilter === f ? 'var(--text-bright)' : 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  cursor: 'pointer',
                  letterSpacing: 1,
                }}
              >
                {f === 'all' ? 'ALL' : f === 'CENTCOM' ? 'US' : 'IRAN'}
              </button>
            ))}
          </div>

          <div style={{ padding: 0 }}>
            {filteredStatements.map(s => {
              const expanded = expandedId === s.id
              const color = STATEMENT_SOURCE_COLORS[s.source] || 'var(--text-dim)'
              return (
                <div key={s.id} style={{
                  padding: '8px 10px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                }}
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 8, color, letterSpacing: 1, fontWeight: 600 }}>{s.source}</span>
                    <span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 'auto' }}>{s.date}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-bright)', fontWeight: 500, lineHeight: 1.3 }}>
                    {s.title}
                  </div>
                  {expanded && (
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.5, margin: '4px 0' }}>
                        {s.quote}
                      </p>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>{s.sourceLabel}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {s.url && s.url !== '#' && (
                          <a href={s.url} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 9, color: 'var(--accent-cyan)', textDecoration: 'underline' }}
                          >[ SOURCE → ]</a>
                        )}
                        <span style={{
                          fontSize: 8, color: s.confidence === 'confirmed' ? 'var(--accent-green)' : 'var(--accent-amber)',
                          letterSpacing: 1,
                        }}>{s.confidence.toUpperCase()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
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
