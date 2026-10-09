import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Live from './pages/Live'
import BidRoom from './pages/BidRoom'
import Dashboard from './pages/Dashboard'
import MyTeam from './pages/MyTeam'
import MyBids from './pages/MyBids'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import AdminControl from './pages/AdminControl'
import Standings from './pages/Standings'
import Rankings from './pages/Rankings'
import PlayerProfile from './pages/PlayerProfile'
import History from './pages/History'

// Pages that own the whole viewport (broadcast / bid room / sign-in).
const CHROMELESS = ['/live', '/login', '/auction']

function AuctionEntry() {
  const { user } = useAuth()
  if (user?.role === 'admin') return <Navigate to="/admin/control" replace />
  if (user?.role === 'user') return <BidRoom />
  return <Navigate to="/live" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  const location = useLocation()
  const chromeless = CHROMELESS.includes(location.pathname)
  return (
    <>
      {!chromeless && <Navbar />}
      <Routes>
        {/* Public Homepage — displayed when website link is opened */}
        <Route path="/" element={<Landing />} />

        {/* Public watch live screen — NO login required to watch auction live! */}
        <Route path="/live" element={<Live />} />

        {/* Sign in */}
        <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin/control' : '/dashboard'} replace /> : <Login />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />

        {/* Protected routes — require login */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/rankings" element={<ProtectedRoute roles={['admin', 'player']}><Rankings /></ProtectedRoute>} />
        <Route path="/players/:id" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/auction" element={<ProtectedRoute><AuctionEntry /></ProtectedRoute>} />
        <Route path="/standings" element={<ProtectedRoute roles={['admin']}><Standings /></ProtectedRoute>} />
        <Route path="/my-team" element={<ProtectedRoute roles={['user']}><MyTeam /></ProtectedRoute>} />
        <Route path="/my-bids" element={<ProtectedRoute roles={['user']}><MyBids /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
        <Route path="/admin/control" element={<ProtectedRoute roles={['admin']}><AdminControl /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
