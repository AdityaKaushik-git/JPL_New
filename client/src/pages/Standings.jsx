import { useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { useAuctionSocket } from '../hooks/useAuctionSocket'
import { api } from '../services/api'
import { Loader, ErrorState, EmptyState } from '../components/States'
import TeamMark from '../components/TeamMark'
import PlayerCard from '../components/PlayerCard'
import FranchiseModal from '../components/FranchiseModal'
import { formatINR, formatShort } from '../lib/format'

/** Public franchise table with squads. */
export default function Standings() {
  const { data, error, loading, reload } = useAsync(() => api.getStandings(), [])
  const { teams: socketTeams } = useAuctionSocket()
  const [open, setOpen] = useState(null)

  if (loading && !data) return <Loader full />
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  
  // Use real-time socket teams if available, fallback to REST API response.
  const rawTeams = (socketTeams && socketTeams.length) ? socketTeams : (data?.standings || data?.franchises || [])
  const teams = rawTeams.filter(t => t.status !== 'disabled')
  
  // Sort teams by total_player_points (primary), remaining_purse (tiebreak 1), batsmen_points (tiebreak 2)
  const sortedTeams = [...teams].sort((a, b) => {
    const ptsDiff = (Number(b.total_player_points) || 0) - (Number(a.total_player_points) || 0)
    if (ptsDiff !== 0) return ptsDiff
    const purseDiff = (Number(b.remaining_purse) || 0) - (Number(a.remaining_purse) || 0)
    if (purseDiff !== 0) return purseDiff
    return (Number(b.batsmen_points) || 0) - (Number(a.batsmen_points) || 0)
  })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Live Rankings</h1>
          <p className="muted">Current leaderboard based on total ICC ranking points. Each franchise started with {formatINR(750000000)}.</p>
        </div>
      </div>
      
      {!teams.length ? <EmptyState title="No franchises yet" /> : (
        <div className="lb-container">
          {sortedTeams.map((t, idx) => {
            const rank = idx + 1;
            let rowClass = 'lb-row';
            let rankDisplay = `#${rank}`;
            
            if (rank === 1) { 
              rowClass += ' is-1st';
              rankDisplay = '1st';
            } else if (rank === 2) { 
              rowClass += ' is-2nd';
              rankDisplay = '2nd';
            } else if (rank === 3) { 
              rowClass += ' is-3rd';
              rankDisplay = '3rd';
            }

            return (
              <button 
                key={t.id} 
                onClick={() => setOpen(t)}
                className={rowClass}
                style={{ '--team': t.color || 'var(--night-4)' }}
              >
                
                <div className="lb-rank">
                  {rankDisplay}
                </div>
                
                <div className="lb-logo">
                  <TeamMark team={t} size={64} />
                </div>
                
                <div className="lb-core">
                  <h2 className="lb-name">{t.team_name}</h2>
                  <div className="lb-owner">{t.owner_name}</div>
                  
                  <div className="lb-composition">
                    <span title="Batsmen">BAT: <b>{t.batsmen_count || 0}</b></span>
                    <span title="Bowlers">BOWL: <b>{t.bowlers_count || 0}</b></span>
                    <span title="All-Rounders">AR: <b>{t.allrounders_count || 0}</b></span>
                    <span title="Wicket Keepers">WK: <b>{t.keepers_count || 0}</b></span>
                    <span title="Foreign">FOR: <b>{t.foreign_count || 0}</b></span>
                    <span title="Uncapped">UNC: <b>{t.uncapped_count || 0}</b></span>
                  </div>
                </div>
                
                <div className="lb-stats">
                  <div className="lb-stat-box">
                    <div className="lb-stat-val">{formatShort(t.remaining_purse)}</div>
                    <div className="lb-stat-label">Purse Left</div>
                  </div>
                  
                  <div className={`lb-stat-box${t.squad_count >= t.max_squad_size ? ' is-danger' : ''}`}>
                    <div className="lb-stat-val">{t.squad_count}/{t.max_squad_size}</div>
                    <div className="lb-stat-label">Squad</div>
                  </div>
                  
                  <div className="lb-pts-box">
                    <div className="lb-pts-val">{Number(t.total_player_points || 0).toLocaleString('en-IN')}</div>
                    <div className="lb-pts-label">Total Points</div>
                  </div>
                </div>
                
              </button>
            );
          })}
        </div>
      )}
      <FranchiseModal franchiseId={open?.id} onClose={() => setOpen(null)} />
    </div>
  )
}