'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type { AttackEvent, SitRep } from './WarMap'
import statementsData from '@/data/statements.json'
import hormuzData from '@/data/hormuz-data.json'

interface Statement {
  id: number; source: string; sourceLabel: string; type: string
  date: string; time: string; title: string; summary: string; quote: string
  url: string; sourceChannel: string; confidence: string
}

const allStatements = statementsData as Statement[]
const STATEMENT_SOURCE_COLORS: Record<string, string> = {
  CENTCOM: '#3498db', 'Khatam al Anbiya': '#2ecc71',
}

const SITREP_TYPE_COLORS: Record<string, string> = {
  launch: '#f39c12', strike: '#e74c3c', drone: '#2ecc71',
  intercept: '#3498db', casualty: '#e74c3c', naval: '#3498db',
  statement: '#9b59b6', report: '#666666',
}

interface Props {
  attacks: AttackEvent[]
  sitreps: SitRep[]
  visible: boolean
  selectedSitrep: SitRep | null
  onToggle: () => void
}

export default function StatsSidebar({ attacks, sitreps, visible }: Props) {
  const [tab, setTab] = useState<'stats' | 'stmts' | 'sitreps'>('stats')
  const [stmtFilter, setStmtFilter] = useState<'all' | 'CENTCOM' | 'Khatam al Anbiya'>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedSitrep, setExpandedSitrep] = useState<number | null>(null)
  const [sitrepFilter, setSitrepFilter] = useState<string>('all')
  const [width, setWidth] = useState(260)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef(false)

  const stats = useMemo(() => {
    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let iranMil = 0, iranCiv = 0, usMil = 0, usCiv = 0, kurdish = 0, other = 0
    let interceptorFailures = 0
    const interceptorKeywords = /interceptor|patriot.*fail|missed.*intercept|failed.*intercept|malfunction|missile defense.*confus|not.*intercept|pac-3|air defense.*fail|intercept.*fell|interceptor.*inside/i
    for (const a of attacks) {
      byType[a.type] = (byType[a.type] || 0) + 1
      byStatus[a.status] = (byStatus[a.status] || 0) + 1
      iranMil += a.casualties.iranian_mil || 0
      iranCiv += a.casualties.iranian_civ || 0
      usMil += a.casualties.us_mil || 0
      usCiv += a.casualties.us_civ || 0
      kurdish += a.casualties.kurdish || 0
      other += a.casualties.other || 0
      if (interceptorKeywords.test(a.description)) interceptorFailures++
    }
    // Also check sitreps
    let sitrepInterceptors = 0
    for (const s of sitreps) {
      if (interceptorKeywords.test(s.description)) sitrepInterceptors++
    }
    const hData = hormuzData as { date: string; daily: number; label: string; note: string }[]
    const currentHormuz = hData.length > 0 ? hData[hData.length-1].daily : 0
    const peakHormuz = Math.max(...hData.map(d => d.daily))
    const hormuzRecent = hData.slice(-7)
    const fpvLaunched = 80
    const fpvHits = 15
    const fpvKilled = 5
    const fpvCost = 300
    return { byType, byStatus, iranMil, iranCiv, usMil, usCiv, kurdish, other, total: attacks.length, interceptorFailures, sitrepInterceptors, currentHormuz, peakHormuz, hormuzRecent, fpvLaunched, fpvHits, fpvKilled, fpvCost }
  }, [attacks, sitreps])

  const filteredStatements = useMemo(() => {
    if (stmtFilter === 'all') return allStatements
    return allStatements.filter(s => s.source === stmtFilter)
  }, [stmtFilter])

  const filteredSitreps = useMemo(() => {
    if (sitrepFilter === 'all') return sitreps
    return sitreps.filter(s => s.type === sitrepFilter)
  }, [sitreps, sitrepFilter])

  const sitrepTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of sitreps) counts[s.type] = (counts[s.type] || 0) + 1
    return counts
  }, [sitreps])

  // ── Resize drag handler ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = true
    setDragging(true)
  }, [])

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const newWidth = Math.max(200, Math.min(600, e.clientX - 16))
      setWidth(newWidth)
    }

    const handleUp = () => {
      dragRef.current = false
      setDragging(false)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="stats-sidebar" style={{
      position: 'fixed', top: 56, left: 16, zIndex: 1001,
      width, background: 'rgba(0, 12, 6, 0.92)',
      border: '1px solid var(--border-color)',
      fontFamily: 'var(--font-mono)', fontSize: 11,
      color: 'var(--text-primary)',
      maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
      userSelect: dragging ? 'none' : 'auto',
      cursor: dragging ? 'col-resize' : 'default',
    }}>
      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        {(['stats', 'stmts', 'sitreps'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '7px 4px',
            background: tab === t ? 'rgba(255,255,255,0.05)' : 'transparent',
            border: 'none',
            borderBottom: tab === t
              ? `2px solid ${t === 'stats' ? 'var(--accent-green)' : t === 'stmts' ? 'var(--accent-cyan)' : 'var(--accent-amber)'}`
              : '2px solid transparent',
            color: tab === t ? 'var(--text-bright)' : 'var(--text-dim)',
            fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer', letterSpacing: 1,
          }}>
            {t === 'stats' ? 'STATS' : t === 'stmts' ? 'STMTS' : 'SITREPS'}
          </button>
        ))}
      </div>

      {/* ── STATS ── */}
      {tab === 'stats' && <StatsContent stats={stats} />}

      {/* ── STMTS ── */}
      {tab === 'stmts' && (
        <StmtsContent
          filtered={filteredStatements}
          filter={stmtFilter}
          setFilter={setStmtFilter}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
        />
      )}

      {/* ── SITREPS ── */}
      {tab === 'sitreps' && (
        <SitrepsContent
          filtered={filteredSitreps}
          filter={sitrepFilter}
          setFilter={setSitrepFilter}
          expandedId={expandedSitrep}
          setExpandedId={setExpandedSitrep}
          typeCounts={sitrepTypeCounts}
        />
      )}

      {/* ── Drag handle ── */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          top: 0, right: 0, bottom: 0,
          width: 6,
          cursor: 'col-resize',
          background: dragging ? 'var(--accent-green)' : 'transparent',
          transition: dragging ? 'none' : 'background 0.2s',
        }}
      />
    </div>
  )
}

// ── Stats tab ──
function StatsContent({ stats }: { stats: any }) {
  return (<>
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)',
      fontSize: 10, color: 'var(--accent-green)', letterSpacing: 2,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>THEATER STATS</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)' }}>{stats.total}</span>
    </div>
    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 6 }}>BY TYPE</div>
      {Object.entries(TYPE_LABELS).map(([key, label]) => {
        const count = stats.byType[key] || 0
        if (count === 0) return null
        const pct = (count / stats.total) * 100
        return (<div key={key} style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: TYPE_COLORS[key] }}>{label}</span>
            <span style={{ color: 'var(--text-bright)' }}>{count}</span>
          </div>
          <div style={{ height: 3, background: 'var(--bg-primary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: TYPE_COLORS[key], borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>)
      })}
    </div>
    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>CASUALTIES</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, rowGap: 4 }}>
        <CasLabel value={stats.iranMil} color="var(--accent-red)" label="IRAN MIL" />
        <CasLabel value={stats.iranCiv} color="var(--accent-amber)" label="IRAN CIV" />
        <CasLabel value={stats.usMil} color="#3498db" label="US MIL" />
        <CasLabel value={stats.usCiv} color="#85c1e9" label="US CIV" />
        <CasLabel value={stats.kurdish} color="#9b59b6" label="KURD" />
        <CasLabel value={stats.other} color="var(--text-dim)" label="OTHER" />
      </div>
    </div>
    <div style={{ padding: '8px 12px' }}>
      <div style={{ fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>STATUS</div>
      {Object.entries(stats.byStatus).map(([status, count]) => (
        <div key={status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: STATUS_COLORS[status] || 'var(--text-dim)' }}>{String(status).toUpperCase()}</span>
          <span style={{ color: 'var(--text-bright)' }}>{count as number}</span>
        </div>
      ))}

      {/* ── Air Defense Interceptor Failure Stat ── */}
      <div style={{
        marginTop: 12, paddingTop: 10,
        borderTop: '1px solid var(--border-color)',
      }}>
        <div style={{ fontSize: 8, color: 'var(--accent-amber)', letterSpacing: 1, marginBottom: 4 }}>
          AIR DEFENSE FAILURES
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
            {stats.interceptorFailures}
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
            attacks
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-cyan)' }}>
            +{stats.sitrepInterceptors}
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
            reports
          </span>
        </div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>
          Patriot / PAC-3 / air defense malfunctions
        </div>
      </div>

      {/* Strait of Hormuz Shipping */}
      <div style={{
        marginTop: 12, paddingTop: 10,
        borderTop: '1px solid var(--border-color)',
      }}>
        <div style={{ fontSize: 8, color: 'var(--accent-cyan)', letterSpacing: 1, marginBottom: 4 }}>
          STRAIT OF HORMUZ u2014 DAILY CROSSINGS
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 6 }}>
          Since war began Feb 28
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{stats.currentHormuz}</span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>today</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)' }}>{stats.peakHormuz}</span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>peak</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-red)' }}>{stats.peakHormuz > 0 ? Math.round(stats.currentHormuz / stats.peakHormuz * 100) : 0}%</span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>of peak</span>
        </div>
        {stats.hormuzRecent && stats.hormuzRecent.length > 0 && (
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 24, marginTop: 4 }}>
            {stats.hormuzRecent.map((d: any, i: number) => {
              const barH = Math.max(4, (d.daily / Math.max(stats.peakHormuz, 1)) * 22);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '100%', height: barH,
                    background: d.daily > 10 ? 'var(--accent-green)' : d.daily > 5 ? 'var(--accent-amber)' : 'var(--accent-red)',
                    borderRadius: '1px 1px 0 0',
                    minHeight: 4,
                  }} />
                  <span style={{ fontSize: 6, color: 'var(--text-dim)', marginTop: 1 }}>{d.date.slice(-2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hezbollah FPV Drone Campaign */}
      <div style={{
        marginTop: 12, paddingTop: 10,
        borderTop: '1px solid var(--border-color)',
      }}>
        <div style={{ fontSize: 8, color: 'var(--accent-red)', letterSpacing: 1, marginBottom: 6 }}>
          HEZBOLLAH FPV DRONE CAMPAIGN
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{stats.fpvLaunched}</span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>drones launched</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-amber)" }}>{stats.fpvHits}</span><span style={{ fontSize: 7, color: "var(--text-dim)", marginLeft: 2, letterSpacing: 1 }}>HITS</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-red)" }}>{stats.fpvKilled}</span><span style={{ fontSize: 7, color: "var(--text-dim)", marginLeft: 2, letterSpacing: 1 }}>KILLED</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-cyan)" }}>{"$" + stats.fpvCost}</span><span style={{ fontSize: 7, color: "var(--text-dim)", marginLeft: 2, letterSpacing: 1 }}>PER DRONE</span>
        </div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 4 }}>
          Fiber-optic FPV - jam-proof, no EM signature
        </div>
      </div>
    </div>
  </>)
}

function StmtsContent({ filtered, filter, setFilter, expandedId, setExpandedId }: {
  filtered: Statement[]; filter: string; setFilter: (f: any) => void
  expandedId: number | null; setExpandedId: (n: number | null) => void
}) {
  return (<>
    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 4 }}>
      {(['all', 'CENTCOM', 'Khatam al Anbiya'] as const).map(f => (
        <button key={f} onClick={() => setFilter(f)} style={{
          flex: 1, padding: '4px 4px',
          background: filter === f ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: `1px solid ${filter === f ? (f === 'CENTCOM' ? '#3498db' : f === 'Khatam al Anbiya' ? '#2ecc71' : 'var(--accent-cyan)') : 'transparent'}`,
          color: filter === f ? 'var(--text-bright)' : 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer', letterSpacing: 1,
        }}>{f === 'all' ? 'ALL' : f === 'CENTCOM' ? 'US' : 'IRAN'}</button>
      ))}
    </div>
    <div style={{ padding: 0 }}>
      {filtered.map(s => {
        const expanded = expandedId === s.id
        const color = STATEMENT_SOURCE_COLORS[s.source] || 'var(--text-dim)'
        return (<div key={s.id} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
          onClick={() => setExpandedId(expanded ? null : s.id)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 8, color, letterSpacing: 1, fontWeight: 600 }}>{s.source}</span>
            <span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 'auto' }}>{s.date}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-bright)', fontWeight: 500, lineHeight: 1.3 }}>{s.title}</div>
          {expanded && (<div>
            <p style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.5, margin: '4px 0' }}>{s.quote}</p>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>{s.sourceLabel}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {s.url && s.url !== '#' && <a href={s.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 9, color: 'var(--accent-cyan)', textDecoration: 'underline' }}>[ SOURCE → ]</a>}
              <span style={{ fontSize: 8, color: s.confidence === 'confirmed' ? 'var(--accent-green)' : 'var(--accent-amber)', letterSpacing: 1 }}>{s.confidence.toUpperCase()}</span>
            </div>
          </div>)}
        </div>)
      })}
    </div>
  </>)
}

// ── SitReps tab ──
function SitrepsContent({ filtered, filter, setFilter, expandedId, setExpandedId, typeCounts }: {
  filtered: SitRep[]; filter: string; setFilter: (f: any) => void
  expandedId: number | null; setExpandedId: (n: number | null) => void
  typeCounts: Record<string, number>
}) {
  const typeLabels: Record<string, string> = {
    launch: 'LAUNCH', strike: 'STRIKE', drone: 'DRONE',
    intercept: 'INTERCEPT', casualty: 'CASUALTY', naval: 'NAVAL',
    statement: 'STATEMENT', report: 'REPORT',
  }
  return (<>
    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      <button onClick={() => setFilter('all')} style={{
        padding: '3px 6px', background: filter === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent',
        border: `1px solid ${filter === 'all' ? 'var(--accent-amber)' : 'transparent'}`,
        color: filter === 'all' ? 'var(--text-bright)' : 'var(--text-dim)',
        fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer', letterSpacing: 1,
      }}>ALL ({Object.values(typeCounts).reduce((a,b) => a+b, 0)})</button>
      {Object.entries(typeCounts).map(([type, count]) => (
        <button key={type} onClick={() => setFilter(type)} style={{
          padding: '3px 6px',
          background: filter === type ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: `1px solid ${filter === type ? (SITREP_TYPE_COLORS[type] || '#666') : 'transparent'}`,
          color: filter === type ? 'var(--text-bright)' : 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer', letterSpacing: 1,
        }}>{typeLabels[type] || type.toUpperCase()} ({count})</button>
      ))}
    </div>
    <div style={{ padding: 0 }}>
      {filtered.map(s => {
        const expanded = expandedId === s.id
        const color = SITREP_TYPE_COLORS[s.type] || '#666'
        return (<div key={s.id} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
          onClick={() => setExpandedId(expanded ? null : s.id)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 8, color, letterSpacing: 1, fontWeight: 600 }}>
              {(typeLabels[s.type] || s.type.toUpperCase()).slice(0, 8)}
            </span>
            <span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 'auto' }}>{s.date}</span>
            {!s.verified && <span style={{ fontSize: 7, color: 'var(--accent-amber)', letterSpacing: 1 }}>UNC</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-bright)', fontWeight: 500 }}>{s.location}</div>
          {expanded && (<div>
            <p style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.5, margin: '4px 0' }}>{s.description}</p>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>{s.source}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {s.sourceUrl && <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 9, color: 'var(--accent-cyan)', textDecoration: 'underline' }}>[ SOURCE → ]</a>}
              {s.media.map((m, i) => (
                <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 9, color: m.type === 'video' ? 'var(--accent-amber)' : 'var(--accent-green)', textDecoration: 'underline' }}>
                  [{m.type === 'video' ? '📹' : '🛰'} MEDIA]
                </a>
              ))}
            </div>
          </div>)}
        </div>)
      })}
    </div>
  </>)
}

const TYPE_LABELS: Record<string, string> = {
  airstrike: 'AIRSTRIKE', missile: 'MISSILE', naval: 'NAVAL', drone: 'DRONE', cyber: 'CYBER',
}
const TYPE_COLORS: Record<string, string> = {
  airstrike: '#e74c3c', missile: '#f39c12', naval: '#3498db', drone: '#2ecc71', cyber: '#9b59b6',
}
const STATUS_COLORS: Record<string, string> = {
  confirmed: 'var(--accent-green)', disputed: 'var(--accent-amber)', unconfirmed: 'var(--accent-red)',
}

function CasLabel({ value, color, label }: { value: number; color: string; label: string }) {
  if (!value) return null
  return (
    <div style={{ minWidth: 40 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
      <div style={{ fontSize: 7, color: 'var(--text-dim)', letterSpacing: 1 }}>{label}</div>
    </div>
  )
}
