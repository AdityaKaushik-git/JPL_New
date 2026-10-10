import { useCallback, useEffect, useRef, useState } from 'react'

// Runs an async loader and tracks { data, error, loading }.
export function useAsync(loader, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)

  const run = useCallback(() => {
    setLoading(true)
    return loader()
      .then(d => { if (alive.current) { setData(d); setError(null) } })
      .catch(e => { if (alive.current) setError(e) })
      .finally(() => { if (alive.current) setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    alive.current = true
    run()
    return () => { alive.current = false }
  }, [run])

  return { data, error, loading, reload: run, setData }
}
