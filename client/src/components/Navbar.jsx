import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, Radio } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Brand from './Brand'
import { formatShort } from '../lib/format'

const PUBLIC_LINKS = [
  { to: '/live', label: 'Live screen' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/standings', label: 'Teams' },
  { to: '/history', label: 'Results' },
]

const LINKS = {
  admin: [
    { to: '/dashboard', label: 'Overview' },
    { to: '/admin/control', label: 'Control center' },
    { to: '/admin', label: 'Manage', end: true },
    { to: '/rankings', label: 'Rankings' },
    { to: '/history', label: 'Results' },
  ],
  user: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/auction', label: 'Bid room' },
    { to: '/my-team', label: 'Squad' },
    { to: '/my-bids', label: 'My bids' },
    { to: '/rankings', label: 'Rankings' },
    { to: '/standings', label: 'Teams' },
  ],
  player: [
    { to: '/dashboard', label: 'My card' },
    { to: '/live', label: 'Live screen' },
    { to: '/rankings', label: 'Rankings' },
    { to: '/standings', label: 'Teams' },
  ],
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const links = user ? (LINKS[user.role] || []) : PUBLIC_LINKS

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Brand to={user ? '/dashboard' : '/'} />
        <nav className={`topnav${open ? ' open' : ''}`} aria-label="Main">
          {links.map(link => (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
          {user && user.role !== 'player' && (
            <NavLink to="/live" onClick={() => setOpen(false)} className="topnav-live">
              <Radio size={14} /> Live screen
            </NavLink>
          )}
        </nav>
        <div className="topbar-right">
          {user?.role === 'user' && (
            <span className="topbar-purse" title="Remaining purse">
              {user.short_name && <b>{user.short_name}</b>} {formatShort(user.purse)}
            </span>
          )}
          {user ? (
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}><LogOut size={15} /> Sign out</button>
          ) : (
            <NavLink to="/login" className="btn btn-primary btn-sm">Sign in</NavLink>
          )}
          <button className="icon-btn hamburger" onClick={() => setOpen(o => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  )
}
