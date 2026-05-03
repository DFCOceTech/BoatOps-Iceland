import { createContext, useContext, useState, useCallback } from 'react'

export interface GoNoGoValues {
  windKt:       number | null
  gustKt:       number | null
  hsM:          number | null
  cloudPct:     number | null
  solarElevDeg: number | null
  lastUpdated:  Date | null
}

interface GoNoGoContextType {
  values:         GoNoGoValues
  update:         (partial: Partial<Omit<GoNoGoValues, 'lastUpdated'>>) => void
  refreshSignal:  number   // increments each time user clicks "Refresh All"
  triggerRefresh: () => void
}

const INIT: GoNoGoValues = {
  windKt: null, gustKt: null, hsM: null, cloudPct: null, solarElevDeg: null, lastUpdated: null,
}

const GoNoGoContext = createContext<GoNoGoContextType>({
  values: INIT,
  update: () => {},
  refreshSignal: 0,
  triggerRefresh: () => {},
})

export function GoNoGoProvider({ children }: { children: React.ReactNode }) {
  const [values, setValues]             = useState<GoNoGoValues>(INIT)
  const [refreshSignal, setRefresh]     = useState(0)

  const update = useCallback((partial: Partial<Omit<GoNoGoValues, 'lastUpdated'>>) => {
    setValues(prev => ({ ...prev, ...partial, lastUpdated: new Date() }))
  }, [])

  const triggerRefresh = useCallback(() => setRefresh(n => n + 1), [])

  return (
    <GoNoGoContext.Provider value={{ values, update, refreshSignal, triggerRefresh }}>
      {children}
    </GoNoGoContext.Provider>
  )
}

export const useGoNoGo = () => useContext(GoNoGoContext)
