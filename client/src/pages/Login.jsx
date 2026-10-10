import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, EyeOff, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import Brand from '../components/Brand'
import PitchBackdrop from '../components/PitchBackdrop'

// Sign in only.
export default function Login() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [canForceLogout, setCanForceLogout] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(e, force = false) {
    if (e && e.preventDefault) e.preventDefault()
    if (loading) return
    setError('')
    setCanForceLogout(false)
    setLoading(true)
    try {
      const data = await api.login({ loginId: loginId.trim(), password, forceLogoutOthers: force })
      const from = location.state && location.state.from
      login(data.token, data.user)
      if (from) {
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials')
      if (err.canForceLogout) {
        setCanForceLogout(true)
      }
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <PitchBackdrop className="hero-pitch" />
      <div className="login-card">
        <Brand />
        <h1>Sign in</h1>
        <p className="muted">For franchise owners and the auction admin.</p>
        
        {error && (
          <div className="form-error" role="alert" style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
            <span>{error}</span>
            {canForceLogout && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={(e) => handleSubmit(e, true)}
                disabled={loading}
                style={{ alignSelf: 'flex-start' }}
              >
                <LogOut size={15} /> Log out from other devices & sign in here
              </button>
            )}
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="form">
          <div className="field">
            <span className="field-label">Login ID or email</span>
            <input value={loginId} onChange={e => setLoginId(e.target.value)} autoComplete="username" required autoFocus />
          </div>
          <div className="field">
            <span className="field-label">Password</span>
            <span className="input-with-btn">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="button" className="icon-btn" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="login-note">Need a franchise account? The JPL admin creates them — there is no public sign-up.</p>
        <Link to="/live" className="login-watch">Just watching? Open the live screen (No login required)</Link>
      </div>
    </div>
  )
}
