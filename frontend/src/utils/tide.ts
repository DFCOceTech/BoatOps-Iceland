export interface Extremum { time: string; level: number; kind: 'High' | 'Low' }

/** Local maxima/minima of the hourly sea-level series (next 48 h). */
export function findExtrema(times: string[], levels: (number | null)[], fromIso: string, hours = 48): Extremum[] {
  const out: Extremum[] = []
  const start = times.findIndex(t => t >= fromIso)
  if (start < 0) return out
  const end = Math.min(times.length - 1, start + hours)
  for (let i = Math.max(1, start); i < end; i++) {
    const a = levels[i - 1], b = levels[i], c = levels[i + 1]
    if (a == null || b == null || c == null) continue
    if (b > a && b >= c) out.push({ time: times[i], level: b, kind: 'High' })
    else if (b < a && b <= c) out.push({ time: times[i], level: b, kind: 'Low' })
  }
  return out
}
