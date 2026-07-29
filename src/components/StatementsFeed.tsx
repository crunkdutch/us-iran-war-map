'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
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

const statements = statementsData as Statement[]

const SOURCE_COLORS: Record<string, string> = {
  CENTCOM: '#3498db',
  'Khatam al Anbiya': '#2ecc71',
}

export default function StatementsFeed() {
  const [visible, setVisible] = useState(false)
  const [filter, setFilter] = useState<'all' | 'CENTCOM' | 'Khatam al Anbiya'>('all')
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return [...statements].sort((a, b) => b.date.localeCompare(a.date))
    return statements
      .filter(s => s.sourceType === filter)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [filter])

  return (
    <>
      {/* ── Toggle button ── */}
      <button
        onClick={() => setVisible(v => !v)}
        style={{
          position: 'fixed',
          top: 56,
          left: visible ? 380 : 16,
          zIndex: 1002,
          background: 'var(--bg-secondary)',
          border: `1px solid ${visible ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
          color: visible ? 'var(--accent-cyan)' : 'var(--accent-green)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          padding: '6px 10px',
          cursor: 'pointer',
          letterSpacing: 1,
          transition: 'left 0.3s, border-color 0.2s',
        }}
      >
        {visible ? '× STMTS' : '≡ STMTS'}
      </button>

      {/* ── Panel ── */}
      <div ref={panelRef} style={{
        position: 'fixed',
        top: 56,
        left: visible ? 0 : -380,
        bottom: 28,
        width: 380,
        zIndex: 1001,
        background: 'rgba(0, 12, 6, 0.95)',
        borderRight: '1px solid var(--border-color)',
        transition: 'left 0.3s ease-out',
        fontFamily: 'var(--font-mono)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: 'var(--accent-cyan)', letterSpacing: 2 }}>
            OFFICIAL STATEMENTS
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {filtered.length}
          </span>
        </div>

        {/* Filter tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          fontSize: 10,
        }}>
          {(['all', 'CENTCOM', 'Khatam al Anbiya'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: filter === f ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: 'none',
                borderBottom: filter === f ? `2px solid ${f === 'CENTCOM' ? '#3498db' : f === 'Khatam al Anbiya' ? '#2ecc71' : 'var(--accent-cyan)'}` : '2px solid transparent',
                color: filter === f ? 'var(--text-bright)' : 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                cursor: 'pointer',
                letterSpacing: 1,
                transition: 'all 0.2s',
              }}
            >
              {f === 'all' ? 'ALL' : f === 'CENTCOM' ? 'US' : 'IRAN'}
            </button>
          ))}
        </div>

        {/* Statement list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
        }}>
          {filtered.map(s => (
            <StatementCard key={s.id} statement={s} />
          ))}
        </div>
      </div>
    </>
  )
}

function StatementCard({ statement }: { statement: Statement }) {
  const [expanded, setExpanded] = useState(false)
  const color = SOURCE_COLORS[statement.source] || 'var(--text-dim)'

  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      cursor: 'pointer',
      transition: 'background 0.15s',
    }}
      onClick={() => setExpanded(e => !e)}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 9,
          color,
          letterSpacing: 1,
          fontWeight: 600,
        }}>
          {statement.source}
        </span>
        <span style={{
          fontSize: 9,
          color: 'var(--text-dim)',
          marginLeft: 'auto',
        }}>
          {statement.date}
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 12,
        color: 'var(--text-bright)',
        fontWeight: 500,
        lineHeight: 1.3,
        marginBottom: expanded ? 8 : 0,
      }}>
        {statement.title}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ animation: 'fadeInUp 0.2s ease-out' }}>
          <p style={{
            fontSize: 11,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            margin: '6px 0',
          }}>
            {statement.quote}
          </p>
          <div style={{
            fontSize: 10,
            color: 'var(--text-dim)',
            marginBottom: 4,
          }}>
            {statement.sourceLabel}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {statement.url && statement.url !== '#' && (
              <a
                href={statement.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  fontSize: 10,
                  color: 'var(--accent-cyan)',
                  textDecoration: 'underline',
                }}
              >
                [ SOURCE → ]
              </a>
            )}
            <span style={{
              fontSize: 9,
              color: statement.confidence === 'confirmed' ? 'var(--accent-green)' : 'var(--accent-amber)',
              letterSpacing: 1,
            }}>
              {statement.confidence.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
