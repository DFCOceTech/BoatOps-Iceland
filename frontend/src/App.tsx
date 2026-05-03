import MapView from './components/MapView'
import Sidebar from './components/Sidebar'

export default function App() {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView />
      </div>
      <Sidebar />
    </div>
  )
}
