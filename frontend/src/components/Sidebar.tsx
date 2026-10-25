import { useState } from 'react'
import LayerPanel from './LayerPanel'
import WindLayerPanel from './WindLayerPanel'
import WeatherPanel from './WeatherPanel'
import SolarPanel from './SolarPanel'
import SatellitePanel from './SatellitePanel'
import SitePanel from './SitePanel'
import ImageryPanel from './ImageryPanel'
import MarinePanel from './MarinePanel'
import TidePanel from './TidePanel'
import PlannedPanel from './PlannedPanel'
import { useSite } from '../context/SiteContext'
import GoNoDashboard from './GoNoDashboard'
import { GoNoGoProvider } from '../context/GoNoGoContext'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { active, bbox } = useSite()
  // Site-dependent panels fetch on mount, so re-key them when the work site moves.
  const siteKey = `${active.lat.toFixed(4)},${active.lon.toFixed(4)}`
  const areaKey = `${siteKey}:${bbox.west},${bbox.east}`

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
            BoatOps Iceland
            <span style={{ fontSize: 11, fontWeight: 400, color: '#64748b', marginLeft: 8 }}>Jökulsárlón</span>
          </h1>
          <GoNoGoProvider>
            <SitePanel />
            <GoNoDashboard />
            <LayerPanel />
            <WindLayerPanel />
            <WeatherPanel key={`w-${siteKey}`} />
            <MarinePanel key={`m-${siteKey}`} />
            <TidePanel key={`t-${siteKey}`} />
            <SolarPanel key={`s-${siteKey}`} />
            <ImageryPanel key={`i-${areaKey}`} />
            <SatellitePanel key={`p-${areaKey}`} />
            <PlannedPanel />
          </GoNoGoProvider>
        </div>
      </aside>
    </>
  )
}
