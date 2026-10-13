import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(() => {
    localStorage.removeItem('jpl_token')
    localStorage.removeItem('jpl_user')
    sessionStorage.removeItem('jpl_token')
    sessionStorage.removeItem('jpl_user')
    setUser(null)
  }, [])

  const logout = useCallback(() => {
    api.logout().catch(() => {})
    clearSession()
  }, [clearSession])

  useEffect(() => {
    let active = true
    const token = localStorage.getItem('jpl_token') || sessionStorage.getItem('jpl_token')
    if (token) {
      api.getMe()
        .then((data) => {
          if (!active) return
          const currentToken = localStorage.getItem('jpl_token') || sessionStorage.getItem('jpl_token')
          if (currentToken !== token) return
          if (data && data.user) {
            setUser(data.user)
            localStorage.setItem('jpl_user', JSON.stringify(data.user))
            sessionStorage.setItem('jpl_user', JSON.stringify(data.user))
          } else {
            clearSession()
          }
        })
        .catch(() => {
          if (!active) return
          const currentToken = localStorage.getItem('jpl_token') || sessionStorage.getItem('jpl_token')
          if (currentToken === token) {
            clearSession()
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    } else {
      setLoading(false)
    }
    return () => { active = false }
  }, [clearSession])

  useEffect(() => {
    const handleUnauthorized = (e) => {
      const currentToken = localStorage.getItem('jpl_token') || sessionStorage.getItem('jpl_token')
      const failedToken = e?.detail?.token
      // If the 401 is from a previous/stale token, ignore it so the active session isn't killed
      if (failedToken && currentToken && failedToken !== currentToken) {
        return
      }
      logout()
    }
    window.addEventListener('jpl:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('jpl:unauthorized', handleUnauthorized)
  }, [logout])

  function login(token, userData) {
    localStorage.setItem('jpl_token', token)
    localStorage.setItem('jpl_user', JSON.stringify(userData))
    sessionStorage.setItem('jpl_token', token)
    sessionStorage.setItem('jpl_user', JSON.stringify(userData))
    setUser(userData)
    setLoading(false)
  }

  const updateUser = useCallback((data) => {
    setUser(prev => {
      const updated = { ...(prev || {}), ...data }
      localStorage.setItem('jpl_user', JSON.stringify(updated))
      sessionStorage.setItem('jpl_user', JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
