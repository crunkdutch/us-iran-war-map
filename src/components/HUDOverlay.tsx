'use client'

export default function HUDOverlay() {
  return (
    <>
      {/* ── Top HUD Bar ── */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'linear-gradient(180deg, rgba(0,10,5,0.95) 0%, rgba(0,10,5,0.8) 80%, transparent 100%)',
        borderBottom: '1px solid var(--border-color)',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'var(--accent-green)', fontSize: 14, fontWeight: 600 }}>
            ■ TACTICAL TRACKER
          </span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11, letterSpacing: 2 }}>
            // US-IRAN CONFLICT
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--accent-amber)', fontSize: 11, animation: 'hudPulse 2s ease-in-out infinite' }}>
            ● LIVE
          </span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
            {new Date().toISOString().slice(0, 10).replace(/-/g, '.')}
          </span>
        </div>
      </div>

      {/* ── Corner brackets ── */}
      <div style={{ position: 'fixed', top: 52, left: 12, zIndex: 999, pointerEvents: 'none' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M0 20V0H20" stroke="var(--accent-green)" strokeWidth="1.5" opacity="0.4"/>
        </svg>
      </div>
      <div style={{ position: 'fixed', top: 52, right: 12, zIndex: 999, pointerEvents: 'none', transform: 'scaleX(-1)' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M0 20V0H20" stroke="var(--accent-green)" strokeWidth="1.5" opacity="0.4"/>
        </svg>
      </div>

      {/* ── Bottom HUD ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'linear-gradient(0deg, rgba(0,10,5,0.9) 0%, transparent 100%)',
        borderTop: '1px solid var(--border-color)',
        padding: '6px 20px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-dim)',
        pointerEvents: 'none',
      }}>
        <span>COORD: {new Date().toLocaleDateString('en-US', { timeZone: 'UTC', month: '2-digit', day: '2-digit', year: 'numeric' }).split('/').reverse().join('.')}</span>
        <span style={{ letterSpacing: 1 }}>▲ TOPSECRET // NOFORN</span>
        <span>SYS: ONLINE</span>
      </div>
    </>
  )
}
