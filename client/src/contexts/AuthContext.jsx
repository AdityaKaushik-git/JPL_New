import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Every time the site is reloaded or opened in a tab, wipe persistent tokens
  // to strictly force mandatory re-authentication.
  useEffect(() => {
    localStorage.removeItem('jpl_token')
    localStorage.removeItem('jpl_user')
    sessionStorage.removeItem('jpl_token')
    sessionStorage.removeItem('jpl_user')
    setUser(null)
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    api.logout().catch(() => {})
    localStorage.removeItem('jpl_token')
    localStorage.removeItem('jpl_user')
    sessionStorage.removeItem('jpl_token')
    sessionStorage.removeItem('jpl_user')
    setUser(null)
  }, [])

  function login(token, userData) {
    sessionStorage.setItem('jpl_token', token)
    sessionStorage.setItem('jpl_user', JSON.stringify(userData))
    setUser(userData)
  }

  const updateUser = useCallback((data) => {
    setUser(prev => {
      const updated = { ...(prev || {}), ...data }
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
