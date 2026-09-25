import { useEffect, useState, useCallback } from 'react'

export function useFullscreen(ref) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onChange = () => setActive(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await (ref && ref.current ? ref.current : document.documentElement).requestFullscreen()
    } catch (e) {
      // Some browsers (iOS Safari) do not support element fullscreen; the page still works.
    }
  }, [ref])

  return { active, toggle, supported: typeof document !== 'undefined' && Boolean(document.fullscreenEnabled) }
}
