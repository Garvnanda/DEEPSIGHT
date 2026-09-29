import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '@/lib/api'

interface AsyncResult<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

/** Run an async fn on mount and whenever `deps` change. Ignores stale resolutions. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const runId = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoFn = useCallback(fn, deps)

  const run = useCallback(() => {
    const id = ++runId.current
    setLoading(true)
    memoFn()
      .then((d) => {
        if (id === runId.current) {
          setData(d)
          setError(null)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (id === runId.current) {
          setError(e instanceof ApiError ? e.message : 'Something went wrong.')
          setLoading(false)
        }
      })
  }, [memoFn])

  useEffect(run, [run])

  return { data, error, loading, reload: run }
}
