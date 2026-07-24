'use client'

import dynamic from 'next/dynamic'

// Dynamic import — Leaflet needs browser globals
const WarMap = dynamic(() => import('@/components/WarMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      fontFamily: 'var(--font-mono)',
      color: 'var(--accent-green)',
      fontSize: 14,
      letterSpacing: 2,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 16, fontSize: 11, color: 'var(--text-dim)' }}>
          INITIALIZING TACTICAL DISPLAY
        </div>
        <div style={{
          width: 200,
          height: 2,
          background: 'var(--bg-tertiary)',
          margin: '0 auto',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            width: '40%',
            height: '100%',
            background: 'var(--accent-green)',
            animation: 'scanLine 1.5s ease-in-out infinite',
            borderRadius: 2,
          }} />
        </div>
      </div>
    </div>
  ),
})

export default function Home() {
  return <WarMap />
}
