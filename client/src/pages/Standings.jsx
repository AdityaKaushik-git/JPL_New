import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { useAuctionSocket } from '../hooks/useAuctionSocket'
import { api } from '../services/api'
import { Loader, ErrorState } from '../components/States'
import LiveRankingsView from '../components/live/LiveRankingsView'
import FranchiseModal from '../components/FranchiseModal'

// Franchise leaderboard with real-time Live Rankings and official Declared Results
export default function Standings() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data, error, loading, reload } = useAsync(() => api.getStandings(), [])
  const { teams: socketTeams, state, emit } = useAuctionSocket()
  const [open, setOpen] = useState(null)
  
  const showRankings = Boolean(state?.showLiveRankings)

  if (loading && !data) return <Loader full />
  
  if (error) {
    if (!isAdmin) {
      return (
        <div className="page">
          <div className="page-head">
            <div>
              <h1>Live Rankings & Results</h1>
              <p className="muted">Results will be published here once the auctioneer declares official results.</p>
            </div>
          </div>
          <div style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--line, rgba(255, 255, 255, 0.1))',
            marginTop: '2rem'
          }}>
            <h3 style={{ margin: '0 0 0.5rem', color: '#f59e0b' }}>Auction in Progress</h3>
            <p className="muted" style={{ margin: 0, maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
              Official results have not been declared yet. Please check back when the auctioneer declares results, or follow the live action on the <Link to="/live" style={{ color: 'var(--brand)', textDecoration: 'underline' }}>Live Screen</Link>.
            </p>
          </div>
        </div>
      )
    }
    return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  }
  
  // Use real-time socket teams if available, fallback to REST API response.
  const allTeams = (socketTeams && socketTeams.length)
    ? socketTeams
    : (data?.standings || data?.all || data?.qualified || data?.franchises || [])
  const teams = allTeams.filter(t => t.status !== 'disabled')

  return (
    <div className="page standings-page">
      <LiveRankingsView
        teams={teams}
        onSelectTeam={(t) => setOpen(t)}
        isDeclared={showRankings}
        isAdmin={isAdmin}
        showRankings={showRankings}
        onToggleRankings={() => emit && emit('admin:toggleRankings', { enabled: !showRankings })}
        initialView={showRankings ? 'declared' : 'live'}
      />
      <FranchiseModal franchiseId={open?.id} onClose={() => setOpen(null)} />
    </div>
  )
}