import { useState, useEffect, useCallback, useRef } from 'react'

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Fetch JSON from an async function on mount; re-fetch on `refetch()`.
 * Guards against state updates after unmount.
 * The fetcher is captured via ref so callers don't need to memoize it.
 */
export function useFetch<T>(
  fetcher: () => Promise<T>,
): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null })
  const mountedRef = useRef(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetcherRef.current()
      if (mountedRef.current) setState({ data, loading: false, error: null })
    } catch (err) {
      if (mountedRef.current)
        setState(prev => ({
          ...prev, loading: false,
          error: err instanceof Error ? err.message : 'Fetch failed',
        }))
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    run()
    return () => { mountedRef.current = false }
  }, [run])

  return { ...state, refetch: run }
}
