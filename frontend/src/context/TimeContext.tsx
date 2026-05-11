import { createContext, useContext, useState, type ReactNode } from 'react'

interface TimeCtx {
  forecastHour: number              // 0–167 (hours from current UTC hour)
  setForecastHour: (h: number) => void
}

const TimeContext = createContext<TimeCtx>({
  forecastHour: 0,
  setForecastHour: () => {},
})

export function TimeProvider({ children }: { children: ReactNode }) {
  const [forecastHour, setForecastHour] = useState(0)
  return (
    <TimeContext.Provider value={{ forecastHour, setForecastHour }}>
      {children}
    </TimeContext.Provider>
  )
}

export const useTimeContext = () => useContext(TimeContext)
