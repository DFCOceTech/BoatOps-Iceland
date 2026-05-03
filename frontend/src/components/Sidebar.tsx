import { useState } from 'react'
import LayerPanel from './LayerPanel'
import OceanLayerPanel from './OceanLayerPanel'
import WeatherPanel from './WeatherPanel'
import WavePanel from './WavePanel'
import SolarPanel from './SolarPanel'
import SatellitePanel from './SatellitePanel'
import GoNoDashboard from './GoNoDashboard'
import { GoNoGoProvider } from '../context/GoNoGoContext'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Toggle button — fixed positioning keeps it visible regardless of sidebar width.
          When collapsed: right:0 (at viewport right edge).
          When expanded:  right:380 (just outside the sidebar's left edge, in map area).
          Transition syncs with sidebar width 0.2s ease. */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          position: 'fixed',
          top: 12,
          right: collapsed ? 0 : 380,
          transition: 'right 0.2s ease',
          zIndex: 100,
          width: 28,
          height: 28,
          background: '#1e2030',
          border: '1px solid #2d3148',
          borderRadius: 4,
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '◀' : '▶'}
      </button>

      <aside style={{
        width: collapsed ? 0 : 380,
        minWidth: collapsed ? 0 : 380,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#1e2030',
        color: '#e2e8f0',
        borderLeft: '1px solid #2d3148',
        transition: 'width 0.2s ease, min-width 0.2s ease',
      }}>
        <div style={{
          flex: 1,
          overflow: collapsed ? 'hidden' : 'auto',
          padding: collapsed ? 0 : '16px',
          opacity: collapsed ? 0 : 1,
          transition: 'opacity 0.15s ease',
          pointerEvents: collapsed ? 'none' : 'auto',
        }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#f1f5f9',
            borderBottom: '1px solid #2d3148', paddingBottom: 12 }}>
            BoatOps
          </h1>
          <GoNoGoProvider>
            <GoNoDashboard />
            <LayerPanel />
            <OceanLayerPanel />
            <WeatherPanel />
            <WavePanel />
            <SolarPanel />
            <SatellitePanel />
          </GoNoGoProvider>
        </div>
      </aside>
    </>
  )
}
