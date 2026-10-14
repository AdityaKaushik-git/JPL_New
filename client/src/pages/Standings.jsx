import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Trophy, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { useAuctionSocket } from '../hooks/useAuctionSocket'
import { api } from '../services/api'
import { Loader, ErrorState, EmptyState } from '../components/States'
import TeamMark from '../components/TeamMark'
import FranchiseModal from '../components/FranchiseModal'
import { formatINR, formatShort } from '../lib/format'

// Franchise leaderboard with real-time Live Rankings and official Declared Results
export default function Standings() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data, error, loading, reload } = useAsync(() => api.getStandings(), [])
  const { teams: socketTeams, state, emit } = useAuctionSocket()
  const [open, setOpen] = useState(null)
  
  const showRankings = Boolean(state?.showLiveRankings)
  const [selectedView, setSelectedView] = useState(null)
  const activeView = selectedView || (showRankings ? 'declared' : 'live')

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
  
  // Sort teams for real-time Live Rankings: total_player_points (primary), remaining_purse (tiebreak 1), batsmen_points (tiebreak 2)
  const sortedTeams = [...teams].sort((a, b) => {
    const ptsDiff = (Number(b.total_player_points) || 0) - (Number(a.total_player_points) || 0)
    if (ptsDiff !== 0) return ptsDiff
    const purseDiff = (Number(b.remaining_purse) || 0) - (Number(a.remaining_purse) || 0)
    if (purseDiff !== 0) return purseDiff
    return (Number(b.batsmen_points) || 0) - (Number(a.batsmen_points) || 0)
  })

  // Rule: franchises must complete 15 players to qualify. Incomplete squads are disqualified and excluded from result.
  const qualifiedTeams = sortedTeams.filter(t => (Number(t.squad_count) || 0) >= 15)
  const disqualifiedTeams = sortedTeams.filter(t => (Number(t.squad_count) || 0) < 15)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          {activeView === 'live' ? (
            <>
              <h1>Live Rankings</h1>
              <p className="muted">Current real-time leaderboard based on total player points. Track who is currently leading in real time as bidding progresses.</p>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h1>Official Declared Results</h1>
                {showRankings && (
                  <span style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '20px',
                    padding: '0.2rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}>
                    Declared
                  </span>
                )}
              </div>
              <p className="muted">Official results leaderboard. Franchises must complete all 15 player slots to qualify. Incomplete squads are disqualified and excluded from the result.</p>
            </>
          )}
        </div>
      </div>

      {/* View Switcher Tabs: Live Rankings (Real-Time) vs Declare Result */}
      <div className="standings-tabs" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        margin: '1.25rem 0 1.5rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--line, rgba(255, 255, 255, 0.08))'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSelectedView('live')}
            className={`btn btn-sm ${activeView === 'live' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}
          >
            <Activity size={15} /> Live Rankings (Real-Time)
          </button>
          <button
            type="button"
            onClick={() => setSelectedView('declared')}
            className={`btn btn-sm ${activeView === 'declared' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}
          >
            <Trophy size={15} /> Declare Result
          </button>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className={`btn btn-sm ${showRankings ? 'btn-success' : 'btn-ghost'}`}
              onClick={() => {
                const next = !showRankings
                emit('admin:toggleRankings', { enabled: next })
                if (next) setSelectedView('declared')
              }}
              title="Declare auction results for franchises"
            >
              {showRankings ? <Eye size={15} /> : <EyeOff size={15} />}
              Declare Result: {showRankings ? 'ON' : 'OFF'}
            </button>
          </div>
        )}
      </div>
      
      {!teams.length ? <EmptyState title="No franchises yet" /> : (
        <>
          {activeView === 'live' ? (
            /* Live Rankings Display (Real-Time) — All franchises ranked so admin sees who is winning in real time */
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
                        <span title="Indian Players (min 3)">IND: <b>{t.indian_count || 0}/3</b></span>
                        <span title="Overseas Players (no limit)">OS: <b>{t.foreign_count || 0}</b></span>
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
          ) : (
            /* Declare Result Display — Only qualified franchises (15 players completed) ranked; disqualified franchises excluded */
            <>
              {qualifiedTeams.length === 0 ? (
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: '12px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  marginBottom: '1.5rem'
                }}>
                  <h3 style={{ margin: '0 0 0.35rem', color: '#f59e0b', fontSize: '1.1rem' }}>No Qualified Franchises in Results Yet</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    Every franchise must complete all 15 player slots to be included in the declared results. Any franchise with fewer than 15 players is termed disqualified. Switch to the <strong>Live Rankings</strong> tab above to view real-time bidding standings.
                  </p>
                </div>
              ) : (
                <div className="lb-container">
                  {qualifiedTeams.map((t, idx) => {
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
                            <span title="Indian Players (min 3)">IND: <b>{t.indian_count || 0}/3</b></span>
                            <span title="Overseas Players (no limit)">OS: <b>{t.foreign_count || 0}</b></span>
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

              {disqualifiedTeams.length > 0 && (
                <div className="disqualified-section" style={{ marginTop: '2.5rem' }}>
                  <div style={{
                    marginBottom: '1rem',
                    borderTop: '1px solid var(--line, rgba(255,255,255,0.1))',
                    paddingTop: '1.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{
                        background: '#ef4444',
                        color: '#fff',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em'
                      }}>
                        DISQUALIFIED
                      </span>
                      <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Disqualified Franchises ({disqualifiedTeams.length})</h2>
                    </div>
                    <p className="muted" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
                      Franchises that did not complete 15 players are excluded from the result and termed disqualified.
                    </p>
                  </div>

                  <div className="lb-container">
                    {disqualifiedTeams.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setOpen(t)}
                        className="lb-row is-disqualified"
                        style={{
                          '--team': t.color || 'var(--night-4)',
                          opacity: 0.9,
                          border: '1px solid rgba(239, 68, 68, 0.45)',
                          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)'
                        }}
                      >
                        <div className="lb-rank" style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                          DISQUALIFIED
                        </div>

                        <div className="lb-logo">
                          <TeamMark team={t} size={64} />
                        </div>

                        <div className="lb-core">
                          <h2 className="lb-name">{t.team_name}</h2>
                          <div className="lb-owner">{t.owner_name}</div>
                          
                          <div className="lb-composition">
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>
                              INCOMPLETE SQUAD ({t.squad_count || 0}/15 PLAYERS) · DISQUALIFIED
                            </span>
                          </div>
                        </div>

                        <div className="lb-stats">
                          <div className="lb-stat-box">
                            <div className="lb-stat-val">{formatShort(t.remaining_purse)}</div>
                            <div className="lb-stat-label">Purse Left</div>
                          </div>

                          <div className="lb-stat-box is-danger">
                            <div className="lb-stat-val" style={{ color: '#ef4444' }}>{t.squad_count || 0}/15</div>
                            <div className="lb-stat-label">Squad</div>
                          </div>

                          <div className="lb-pts-box">
                            <div className="lb-pts-val">{Number(t.total_player_points || 0).toLocaleString('en-IN')}</div>
                            <div className="lb-pts-label">Total Points</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      <FranchiseModal franchiseId={open?.id} onClose={() => setOpen(null)} />
    </div>
  )
}