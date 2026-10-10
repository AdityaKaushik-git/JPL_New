import { useEffect, useRef, useState } from 'react'

const reduceMotion = () => typeof window !== 'undefined'
  && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Tweens between numeric values with requestAnimationFrame (transform-free, cheap).
export default function AnimatedNumber({ value, format = (n) => String(n), duration = 550, from, className = '' }) {
  const target = Math.round(Number(value) || 0)
  const [display, setDisplay] = useState(from !== undefined ? Math.round(Number(from) || 0) : target)
  const current = useRef(display)
  const frame = useRef(null)

  useEffect(() => {
    cancelAnimationFrame(frame.current)
    const start = current.current
    if (start === target || reduceMotion()) {
      current.current = target
      setDisplay(target)
      return
    }
    const t0 = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = Math.round(start + (target - start) * eased)
      current.current = v
      setDisplay(v)
      if (p < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration])

  return <span className={`num ${className}`}>{format(display)}</span>
}
