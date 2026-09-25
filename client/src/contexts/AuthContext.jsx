import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jpl_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('jpl_token')
    localStorage.removeItem('jpl_user')
    setUser(null)
  }, [])

  const refresh = useCallback(() => {
    if (!localStorage.getItem('jpl_token')) return Promise.resolve(null)
    return api.getMe()
      .then(data => {
        setUser(data.user)
        localStorage.setItem('jpl_user', JSON.stringify(data.user))
        return data.user
      })
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('jpl_token')) { setLoading(false); return }
    refresh()
      .catch((err) => { if (err.status === 401 || err.status === 403 || err.status === 404) logout() })
      .finally(() => setLoading(false))
  }, [refresh, logout])

  function login(token, userData) {
    localStorage.setItem('jpl_token', token)
    localStorage.setItem('jpl_user', JSON.stringify(userData))
    setUser(userData)
  }

  const updateUser = useCallback((data) => {
    setUser(prev => {
      const updated = { ...(prev || {}), ...data }
      localStorage.setItem('jpl_user', JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, refresh, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
