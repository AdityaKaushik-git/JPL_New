import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import Brand from '../components/Brand'
import PitchBackdrop from '../components/PitchBackdrop'

/** Sign in only. Franchise accounts are issued by the JPL admin. */
export default function Login() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login({ loginId: loginId.trim(), password })
      login(data.token, data.user)
      const from = location.state && location.state.from
      navigate(from || (data.user.role === 'admin' ? '/admin/control' : '/dashboard'), { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    } finally {
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
        {error && <p className="form-error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span className="field-label">Login ID or email</span>
            <input value={loginId} onChange={e => setLoginId(e.target.value)} autoComplete="username" required autoFocus />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <span className="input-with-btn">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="button" className="icon-btn" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          <button className="btn btn-primary btn-lg btn-block" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="login-note">Need a franchise account? The JPL admin creates them — there is no public sign-up.</p>
        <Link to="/live" className="login-watch">Just watching? Open the live screen</Link>
      </div>
    </div>
  )
}
