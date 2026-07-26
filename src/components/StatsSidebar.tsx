'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type { AttackEvent, SitRep } from './WarMap'
import statementsData from '@/data/statements.json'

interface Statement {
  [key: string]: any
  id: number; source: string; title: string
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
  dateRange?: number
}

export default function StatsSidebar({ attacks, sitreps, visible, dateRange = Infinity }: Props) {
  const [tab, setTab] = useState<'stats' | 'stmts' | 'sitreps' | 'losses'>('stats')
  const [stmtFilter, setStmtFilter] = useState<'all' | 'CENTCOM' | 'Khatam al Anbiya'>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedSitrep, setExpandedSitrep] = useState<number | null>(null)
  const [sitrepFilter, setSitrepFilter] = useState<string>('all')
  const [width, setWidth] = useState(260)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef(false)

  // ── Hormuz data: runtime fetch from public/ (bypasses Vercel build cache) ──
  const [hormuzData, setHormuzData] = useState<{date:string;daily:number;label:string;note:string}[]>([])
  useEffect(() => {
    fetch('/data/hormuz-data.json')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d) && d.length) setHormuzData(d) })
      .catch(() => {})
  }, [])

  const stats = useMemo(() => {
    const cutoff = dateRange === Infinity ? null : Date.now() - dateRange * 86400000
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
    // Filter hormuz data by selected date range (respects time period selector)
    const filteredHormuz = cutoff
      ? hormuzData.filter(d => new Date(d.date).getTime() >= cutoff)
      : hormuzData
    const currentHormuz = filteredHormuz.length > 0 ? filteredHormuz[filteredHormuz.length-1].daily : 0
    const peakHormuz = filteredHormuz.length > 0 ? Math.max(...filteredHormuz.map(d => d.daily)) : 0
    const hormuzRecent = filteredHormuz.slice(-7)
    const fpvLaunched = 80
    const fpvHits = 15
    const fpvKilled = 5
    const fpvCost = 300
    // Cross-referenced from SimurghRes + Enemy Watch Jul 24
    const confirmedInterceptors = sitreps.filter(function(s) { return /interceptor|patriot.*fail|pac-3|missile.*confus|air defense.*fail|malfunction/i.test(s.description); }).length
    const confirmedAttackInterceptors = attacks.filter(function(a) { return /interceptor|patriot.*fail|pac-3|missile.*confus|air defense.*fail|malfunction/i.test(a.description); }).length
    return { byType, byStatus, iranMil, iranCiv, usMil, usCiv, kurdish, other, total: attacks.length, interceptorFailures, sitrepInterceptors, currentHormuz, peakHormuz, hormuzRecent, fpvLaunched, fpvHits, fpvKilled, fpvCost, confirmedInterceptors, confirmedAttackInterceptors }
  }, [attacks, sitreps, hormuzData, dateRange])

  const filteredStatements = useMemo(() => {
    const list = stmtFilter === 'all' ? allStatements : allStatements.filter(s => s.source === stmtFilter)
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [stmtFilter])

  const filteredSitreps = useMemo(() => {
    const list = sitrepFilter === 'all' ? sitreps : sitreps.filter(s => s.type === sitrepFilter)
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
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
        {(['stats', 'stmts', 'sitreps', 'losses'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '7px 4px',
            background: tab === t ? 'rgba(255,255,255,0.05)' : 'transparent',
            border: 'none',
            borderBottom: tab === t
              ? `2px solid ${t === 'stats' ? 'var(--accent-green)' : t === 'stmts' ? 'var(--accent-cyan)' : t === 'sitreps' ? 'var(--accent-amber)' : 'var(--accent-red)'}`
              : '2px solid transparent',
            color: tab === t ? 'var(--text-bright)' : 'var(--text-dim)',
            fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer', letterSpacing: 1,
          }}>
            {t === 'stats' ? 'STATS' : t === 'stmts' ? 'STMTS' : t === 'sitreps' ? 'SITREPS' : 'LOSSES'}
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

      {/* ── LOSSES ── */}
      {tab === 'losses' && <LossesContent />}

      {/* ── HEZBOLLAH ── */}

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
            {stats.confirmedAttackInterceptors || stats.interceptorFailures}
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

const PAGE_SIZE = 25

function StmtsContent({ filtered, filter, setFilter, expandedId, setExpandedId }: {
  filtered: Statement[]; filter: string; setFilter: (f: any) => void
  expandedId: number | null; setExpandedId: (n: number | null) => void
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const visible = filtered.slice(0, limit)
  const hasMore = limit < filtered.length

  return (<>
    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 4 }}>
      {(['all', 'CENTCOM', 'Khatam al Anbiya', 'Hezbollah'] as const).map(f => (
        <button key={f} onClick={() => { setFilter(f); setLimit(PAGE_SIZE) }} style={{
          flex: 1, padding: '4px 4px',
          background: filter === f ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: `1px solid ${filter === f ? (f === 'CENTCOM' ? '#3498db' : f === 'Khatam al Anbiya' ? '#2ecc71' : f === 'Hezbollah' ? '#e91e63' : 'var(--accent-cyan)') : 'transparent'}`,
          color: filter === f ? 'var(--text-bright)' : 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer', letterSpacing: 1,
        }}>{f === 'all' ? 'ALL' : f === 'CENTCOM' ? 'US' : f === 'Khatam al Anbiya' ? 'IRAN' : f === 'Hezbollah' ? 'HEZBOLLAH' : f}</button>
      ))}
    </div>
    <div style={{ padding: 0 }}>
      {visible.map(s => {
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
            <p style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.5, margin: '4px 0' }}>{s.quote || s.description || ''}</p>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>{s.sourceLabel || (s as any).sourceType || ''}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(() => {
                const stmtUrl = s.url && s.url !== '#' ? s.url : s.sourceUrl || null
                return stmtUrl
                  ? <a href={stmtUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 9, color: 'var(--accent-cyan)', textDecoration: 'underline' }}>[ SOURCE → ]</a>
                  : null
              })()}
              <span style={{ fontSize: 8, color: s.confidence === 'confirmed' ? 'var(--accent-green)' : 'var(--accent-amber)', letterSpacing: 1 }}>{(s.confidence || 'unconfirmed').toUpperCase()}</span>
            </div>
          </div>)}
        </div>)
      })}
      {hasMore && (
        <div style={{ padding: '8px 10px', textAlign: 'center' }}>
          <button onClick={() => setLimit(l => l + PAGE_SIZE)} style={{
            background: 'transparent', border: '1px solid var(--border-color)',
            color: 'var(--accent-green)', fontFamily: 'var(--font-mono)',
            fontSize: 9, padding: '4px 16px', cursor: 'pointer', letterSpacing: 1,
          }}>LOAD +{Math.min(PAGE_SIZE, filtered.length - limit)}</button>
        </div>
      )}
    </div>
  </>)
}

// ── SitReps tab ──
function SitrepsContent({ filtered, filter, setFilter, expandedId, setExpandedId, typeCounts }: {
  filtered: SitRep[]; filter: string; setFilter: (f: any) => void
  expandedId: number | null; setExpandedId: (n: number | null) => void
  typeCounts: Record<string, number>
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const visible = filtered.slice(0, limit)
  const hasMore = limit < filtered.length

  const typeLabels: Record<string, string> = {
    launch: 'LAUNCH', strike: 'STRIKE', drone: 'DRONE',
    intercept: 'INTERCEPT', casualty: 'CASUALTY', naval: 'NAVAL',
    statement: 'STATEMENT', report: 'REPORT',
  }
  return (<>
    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      <button onClick={() => { setFilter('all'); setLimit(PAGE_SIZE) }} style={{
        padding: '3px 6px', background: filter === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent',
        border: `1px solid ${filter === 'all' ? 'var(--accent-amber)' : 'transparent'}`,
        color: filter === 'all' ? 'var(--text-bright)' : 'var(--text-dim)',
        fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer', letterSpacing: 1,
      }}>ALL ({Object.values(typeCounts).reduce((a,b) => a+b, 0)})</button>
      {Object.entries(typeCounts).map(([type, count]) => (
        <button key={type} onClick={() => { setFilter(type); setLimit(PAGE_SIZE) }} style={{
          padding: '3px 6px',
          background: filter === type ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: `1px solid ${filter === type ? (SITREP_TYPE_COLORS[type] || '#666') : 'transparent'}`,
          color: filter === type ? 'var(--text-bright)' : 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer', letterSpacing: 1,
        }}>{typeLabels[type] || type.toUpperCase()} ({count})</button>
      ))}
    </div>
    <div style={{ padding: 0 }}>
      {visible.map(s => {
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
      {hasMore && (
        <div style={{ padding: '8px 10px', textAlign: 'center' }}>
          <button onClick={() => setLimit(l => l + PAGE_SIZE)} style={{
            background: 'transparent', border: '1px solid var(--border-color)',
            color: 'var(--accent-green)', fontFamily: 'var(--font-mono)',
            fontSize: 9, padding: '4px 16px', cursor: 'pointer', letterSpacing: 1,
          }}>LOAD +{Math.min(PAGE_SIZE, filtered.length - limit)}</button>
        </div>
      )}
    </div>
  </>)
}

// ── IRGC Losses tab ──
interface LossCategory {
  name: string; icon: string; color: string
  items: { label: string; count: number }[]
}

interface LossesData {
  title: string; source: string; period: string
  categories: LossCategory[]
}

const CATEGORY_ICONS: Record<string, string> = {
  'Radar & Air Defense': '📡',
  'Support & Logistics': '🔧',
  'Operational Infrastructure': '🏗️',
  'Aircraft Destroyed': '✈️',
}

function LossesContent() {
  const [data, setData] = useState<LossesData | null>(null)
  const [expandedCat, setExpandedCat] = useState<string | null>('Radar & Air Defense')

  useEffect(() => {
    const fetchLosses = () => {
      fetch('/data/irgc-losses.json')
        .then(r => r.json())
        .then(d => setData(d))
        .catch(() => {/* silent */})
    }
    fetchLosses()
    const interval = setInterval(fetchLosses, 60000) // poll every 60s
    return () => clearInterval(interval)
  }, [])

  if (!data) {
    return <div style={{ padding: 20, textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>LOADING...</div>
  }

  const totalItems = data.categories.reduce((sum, cat) =>
    sum + cat.items.reduce((s, i) => s + i.count, 0), 0)

  return (<>
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)',
      fontSize: 10, color: 'var(--accent-red)', letterSpacing: 2,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>US LOSSES (IRGC CLAIM)</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)' }}>{totalItems}</span>
    </div>
    <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-color)',
      fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, lineHeight: 1.4 }}>
      Brig. Gen. Mohebbi, IRGC<br/>
      Period: {data.period}
    </div>
    <div style={{ padding: 0 }}>
      {data.categories.map(cat => {
        const expanded = expandedCat === cat.name
        const catTotal = cat.items.reduce((s, i) => s + i.count, 0)
        return (<div key={cat.name}>
          <div onClick={() => setExpandedCat(expanded ? null : cat.name)}
            style={{
              padding: '8px 10px', cursor: 'pointer',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: expanded ? 'rgba(255,255,255,0.03)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{CATEGORY_ICONS[cat.name] || '●'}</span>
              <span style={{ fontSize: 9, color: cat.color, letterSpacing: 1, fontWeight: 600 }}>
                {cat.name.toUpperCase()}
              </span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-bright)' }}>{catTotal}</span>
          </div>
          {expanded && (
            <div style={{ padding: '2px 10px 6px 28px' }}>
              {cat.items.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.02)',
                }}>
                  <span style={{ fontSize: 9, color: 'var(--text-primary)', lineHeight: 1.3, flex: 1 }}>
                    {item.label}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: item.count >= 10 ? 'var(--accent-red)' :
                           item.count >= 5 ? 'var(--accent-amber)' : 'var(--accent-green)',
                    fontFamily: 'var(--font-mono)', marginLeft: 8, flexShrink: 0,
                  }}>
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>)
      })}
    </div>
    <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-color)',
      fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1, lineHeight: 1.3 }}>
      Source: {data.source} — damages inflicted on US Army in the region over 15 days (Jul 8–22).
      "Patriot systems weakened — Iranian missiles/drones hit targets without interception."
    </div>
  </>)
}

// ── Hezbollah Statements tab ──
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
