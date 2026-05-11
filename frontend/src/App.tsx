import { MapProvider } from './context/MapContext'
import { TimeProvider } from './context/TimeContext'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import CoordDisplay from './components/CoordDisplay'
import TimeSlider from './components/TimeSlider'

export default function App() {
  return (
    <MapProvider>
      <TimeProvider>
        <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
          {/* Map area — TimeSlider is absolutely positioned within this container */}
          <div style={{ flex: 1, position: 'relative' }}>
            <MapView />
            <CoordDisplay />
            <TimeSlider />
          </div>
          <Sidebar />
        </div>
      </TimeProvider>
    </MapProvider>
  )
}
