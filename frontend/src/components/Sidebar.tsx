import { useState } from 'react'
import LayerPanel from './LayerPanel'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside style={{
      width: collapsed ? 0 : 380,
      minWidth: collapsed ? 0 : 380,
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: '#1e2030',
      color: '#e2e8f0',
      borderLeft: '1px solid #2d3148',
      transition: 'width 0.2s ease, min-width 0.2s ease',
      position: 'relative',
    }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          position: 'absolute',
          top: 12,
          left: collapsed ? 8 : -28,
          zIndex: 10,
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

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: collapsed ? 0 : '16px',
        opacity: collapsed ? 0 : 1,
        transition: 'opacity 0.15s ease',
        pointerEvents: collapsed ? 'none' : 'auto',
      }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px', color: '#f1f5f9',
          borderBottom: '1px solid #2d3148', paddingBottom: 12 }}>
          BoatOps
        </h1>
        <LayerPanel />
      </div>
    </aside>
  )
}
