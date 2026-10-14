import { forwardRef, useState, useEffect } from 'react'
import { Maximize2, Minimize2, Wifi, WifiOff, Users, Trophy, Activity, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import Brand from '../Brand'
import PlayerHero from './PlayerHero'
import BidPanel from './BidPanel'
import BidFeed from './BidFeed'
import ResultOverlay from './ResultOverlay'
import TeamMark from '../TeamMark'
import { formatINR, pad2 } from '../../lib/format'

const STATUS_LABEL = {
  Live: 'Live',
  Paused: 'Paused',
  Processing: 'Closing lot',
  Completed: 'Lot closed',
  Pending: 'Standing by',
  Ended: 'Auction Ended',
}

// Broadcast composition shared by the public /live screen and the owner bid room.
const LiveStage = forwardRef(function LiveStage({ socket, fullscreen, dock, leading }, ref) {
  const { state, stats, connection, overlay, dismissOverlay, emit } = socket
  const { player, status, lot, result } = state
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isEnded = status === 'Ended'
  const isDeclared = Boolean(state.showLiveRankings)
  const showResults = isDeclared
  const showEndedWaiting = !isDeclared && isEnded

  const [viewMode, setViewMode] = useState('declared') // 'declared' | 'live'
  const [fetchedTeams, setFetchedTeams] = useState([])

  // If results are declared, ensure teams are loaded (fallback API fetch if socket teams not present yet)
  useEffect(() => {
    if (state.showLiveRankings && (!socket.teams || socket.teams.length === 0)) {
      fetch('/api/franchises')
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.franchises)) {
            setFetchedTeams(data.franchises)
          }
        })
        .catch(() => {})
    }
  }, [state.showLiveRankings, socket.teams])

  const teamsList = (socket.teams && socket.teams.length > 0) ? socket.teams : fetchedTeams

  if (showResults || showEndedWaiting) {
    return (
      <div className={`stage stage-ended${fullscreen && fullscreen.active ? ' is-fullscreen' : ''}`} ref={ref}>
        <header className="stage-top">
          {leading || <Brand to="/" />}
          <div className="stage-title">
            <span className="stage-event">JPL Live Auction</span>
            <span
              className="status-pill status-completed"
              style={showResults ? { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' } : {}}
            >
              {showResults ? (
                <>
                  <Trophy size={13} style={{ marginRight: '5px' }} />
                  Official Results Declared
                </>
              ) : (
                'Auction Ended'
              )}
            </span>
          </div>
          <div className="stage-tools">
            {isAdmin && (
              <button
                className={`btn btn-sm ${state.showLiveRankings ? 'btn-success' : 'btn-ghost'}`}
                onClick={() => emit && emit('admin:toggleRankings', { enabled: !state.showLiveRankings })}
                title="Declare auction results for franchises"
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }}
              >
                {state.showLiveRankings ? <Eye size={14} /> : <EyeOff size={14} />}
                Declare Result: {state.showLiveRankings ? 'ON' : 'OFF'}
              </button>
            )}
            <span className={`conn conn-${connection}`} title={connection === 'online' ? 'Connected' : 'Reconnecting'}>
              {connection === 'online' ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>{connection === 'online' ? 'Connected' : connection === 'offline' ? 'Offline' : 'Reconnecting'}</span>
            </span>
            <span className="watching" title="People connected"><Users size={15} /> {stats.total || 0}</span>
            {fullscreen && fullscreen.supported && (
              <button className="icon-btn" onClick={fullscreen.toggle} aria-label={fullscreen.active ? 'Exit fullscreen' : 'Fullscreen'}>
                {fullscreen.active ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            )}
          </div>
        </header>

        <main className="stage-main">
          {showResults ? (
            <div className="stage-declared-results" style={{ width: '100%', maxWidth: '1050px', margin: '0 auto', padding: '1rem', overflowY: 'auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <div className="ended-trophy-glow" style={{ margin: '0 auto 0.75rem' }}>
                  <Trophy size={48} className="trophy-gold" />
                </div>
                <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 800 }}>Official Auction Results</h1>
                <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '1rem' }}>
                  Final franchise standings based on total player points. Franchises must complete all 15 player slots to qualify.
                </p>
              </div>

              {/* View Switcher Tabs: Official Declared Results vs Live Rankings (Real-Time) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                marginBottom: '1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '0.75rem'
              }}>
                <button
                  type="button"
                  onClick={() => setViewMode('declared')}
                  className={`btn btn-sm ${viewMode === 'declared' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}
                >
                  <Trophy size={15} /> Official Declared Results
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('live')}
                  className={`btn btn-sm ${viewMode === 'live' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}
                >
                  <Activity size={15} /> Live Rankings (All Franchises)
                </button>
              </div>

              {(() => {
                const allActive = (teamsList || []).filter(t => t && t.status !== 'disabled');
                const sortFn = (a, b) => {
                  const ptsDiff = (Number(b.total_player_points) || 0) - (Number(a.total_player_points) || 0);
                  if (ptsDiff !== 0) return ptsDiff;
                  const purseDiff = (Number(b.remaining_purse) || 0) - (Number(a.remaining_purse) || 0);
                  if (purseDiff !== 0) return purseDiff;
                  const batDiff = (Number(b.batsmen_points) || 0) - (Number(a.batsmen_points) || 0);
                  if (batDiff !== 0) return batDiff;
                  return (a.team_name || '').localeCompare(b.team_name || '');
                };

                if (viewMode === 'live') {
                  const sortedAll = [...allActive].sort(sortFn);
                  return (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {sortedAll.map((t, idx) => (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1rem 1.5rem',
                            borderRadius: '12px',
                            background: idx === 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.04)',
                            border: idx === 0 ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            <span style={{ fontSize: '1.4rem', fontWeight: 800, minWidth: '40px', color: idx === 0 ? '#f59e0b' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#d97706' : 'var(--muted)' }}>
                              {idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`}
                            </span>
                            <TeamMark team={t} size={48} />
                            <div>
                              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{t.team_name}</div>
                              <div className="muted" style={{ fontSize: '0.9rem' }}>
                                {t.owner_name} · Squad: {t.squad_count || 0}/{t.max_squad_size || 15} · IND: {t.indian_count || 0}/3 · OS: {t.foreign_count || 0}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                              {Number(t.total_player_points || 0).toLocaleString('en-IN')} pts
                            </div>
                            <div className="muted" style={{ fontSize: '0.85rem' }}>Purse: {formatINR(t.remaining_purse || 0)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                // Official Declared Results View (Strict 15 player squad qualification)
                const qTeams = allActive.filter(t => (Number(t.squad_count) || 0) >= 15).sort(sortFn);
                const dqTeams = allActive.filter(t => (Number(t.squad_count) || 0) < 15).sort(sortFn);

                return (
                  <>
                    {qTeams.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.3)', margin: '1rem 0' }}>
                        <h3 style={{ color: '#f59e0b', margin: 0, fontSize: '1.2rem' }}>No Franchises Qualified Yet</h3>
                        <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.95rem' }}>
                          Every franchise must complete all 15 player slots to be ranked in the declared results. Any franchise with fewer than 15 players is termed disqualified. Switch to the <strong>Live Rankings</strong> tab above to view real-time standings.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {qTeams.map((t, idx) => (
                          <div
                            key={t.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '1rem 1.5rem',
                              borderRadius: '12px',
                              background: idx === 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.04)',
                              border: idx === 0 ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                              <span style={{ fontSize: '1.4rem', fontWeight: 800, minWidth: '40px', color: idx === 0 ? '#f59e0b' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#d97706' : 'var(--muted)' }}>
                                {idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`}
                              </span>
                              <TeamMark team={t} size={48} />
                              <div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                                  {t.team_name}
                                  {idx === 0 && (
                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#f59e0b', color: '#000', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 800, verticalAlign: 'middle' }}>
                                      CHAMPION
                                    </span>
                                  )}
                                </div>
                                <div className="muted" style={{ fontSize: '0.9rem' }}>
                                  {t.owner_name} · Squad: {t.squad_count}/15 · IND: {t.indian_count || 0}/3 · OS: {t.foreign_count || 0}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                                {Number(t.total_player_points || 0).toLocaleString('en-IN')} pts
                              </div>
                              <div className="muted" style={{ fontSize: '0.85rem' }}>Purse: {formatINR(t.remaining_purse || 0)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {dqTeams.length > 0 && (
                      <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <span style={{ background: '#ef4444', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>DISQUALIFIED</span>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Incomplete Squads (&lt; 15 players) — Excluded from Results</span>
                        </div>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          {dqTeams.map(t => (
                            <div
                              key={t.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1.25rem',
                                borderRadius: '8px',
                                background: 'rgba(239, 68, 68, 0.06)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                opacity: 0.85
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <TeamMark team={t} size={36} />
                                <div>
                                  <div style={{ fontWeight: 600 }}>{t.team_name} ({t.owner_name})</div>
                                  <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                                    Incomplete Squad: {t.squad_count || 0}/15 players · Disqualified from results
                                  </div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', fontSize: '0.9rem', color: 'var(--muted)' }}>
                                {Number(t.total_player_points || 0).toLocaleString('en-IN')} pts
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="stage-idle stage-ended-waiting">
              <div className="ended-trophy-glow">
                <Trophy size={56} className="trophy-gold" />
              </div>
              <h1 className="ended-title">Auction Ended</h1>
              <p className="ended-subtitle">Results will be shared shortly</p>
              <div className="ended-chip">
                <span>Official rankings and standings will be published shortly by the auctioneer.</span>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className={`stage stage-${status.toLowerCase()}${fullscreen && fullscreen.active ? ' is-fullscreen' : ''}`} ref={ref}>
      <header className="stage-top">
        {leading || <Brand to="/" />}
        <div className="stage-title">
          <span className="stage-event">Live auction</span>
          <span className={`status-pill status-${status.toLowerCase()}`}>
            {status === 'Live' && <i className="live-dot" aria-hidden="true" />}
            {STATUS_LABEL[status] || status}
          </span>
          {lot && <span className="stage-lot">Player {pad2(lot.position)} / {pad2(lot.total)}</span>}
        </div>
        <div className="stage-tools">
          {isAdmin && (
            <button
              className={`btn btn-sm ${state.showLiveRankings ? 'btn-success' : 'btn-ghost'}`}
              onClick={() => emit && emit('admin:toggleRankings', { enabled: !state.showLiveRankings })}
              title="Declare auction results for franchises"
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }}
            >
              {state.showLiveRankings ? <Eye size={14} /> : <EyeOff size={14} />}
              Declare Result: {state.showLiveRankings ? 'ON' : 'OFF'}
            </button>
          )}
          <span className={`conn conn-${connection}`} title={connection === 'online' ? 'Connected' : 'Reconnecting'}>
            {connection === 'online' ? <Wifi size={15} /> : <WifiOff size={15} />}
            <span>{connection === 'online' ? 'Connected' : connection === 'offline' ? 'Offline' : 'Reconnecting'}</span>
          </span>
          <span className="watching" title="People connected"><Users size={15} /> {stats.total || 0}</span>
          {fullscreen && fullscreen.supported && (
            <button className="icon-btn" onClick={fullscreen.toggle} aria-label={fullscreen.active ? 'Exit fullscreen' : 'Fullscreen'}>
              {fullscreen.active ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
        </div>
      </header>

      <main className="stage-main">
        {player ? (
          <>
            <div className="stage-hero-wrap" key={state.auctionId}>
              <PlayerHero player={player} lot={lot} accent={state.highestBidder && state.highestBidder.color} />
              {status === 'Completed' && result && (
                <div className={`closed-banner closed-${result.type.toLowerCase()}`} style={{ '--team': result.color }}>
                  {result.type === 'SOLD' ? (
                    <>
                      <TeamMark team={{ team_name: result.teamName, short_name: result.shortName, color: result.color, logo_url: result.logoUrl }} size={34} />
                      <span>Sold to <b>{result.teamName}</b> for <b>{formatINR(result.price)}</b></span>
                    </>
                  ) : <span>Unsold — no successful bid</span>}
                </div>
              )}
            </div>
            <div className="stage-side">
              <BidPanel state={state} />
              <BidFeed bids={state.bidHistory} />
            </div>
          </>
        ) : (
          <div className="stage-idle">
            <span className="stage-idle-mark" aria-hidden="true">JPL</span>
            <h1>Next player coming up</h1>
            <p>The auctioneer will bring the next player to the block shortly.</p>
          </div>
        )}
      </main>

      {dock}
      <ResultOverlay result={overlay} onDismiss={dismissOverlay} />
    </div>
  )
})

export default LiveStage
