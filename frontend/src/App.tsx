import { MapProvider } from './context/MapContext'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import CoordDisplay from './components/CoordDisplay'

export default function App() {
  return (
    <MapProvider>
      <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <MapView />
          <CoordDisplay />
        </div>
        <Sidebar />
      </div>
    </MapProvider>
  )
}
