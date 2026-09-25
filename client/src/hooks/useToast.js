import { useState, useCallback, useRef } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'info') => {
    counter.current += 1
    const id = `${Date.now()}-${counter.current}`
    setToasts(prev => [...prev.slice(-3), { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4200)
  }, [])

  return { toasts, addToast, removeToast }
}
