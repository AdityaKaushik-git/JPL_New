import { forwardRef } from 'react'
import { Maximize2, Minimize2, Wifi, WifiOff, Users, Trophy } from 'lucide-react'
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
  const { state, stats, connection, overlay, dismissOverlay } = socket
  const { player, status, lot, result } = state
  const isEnded = status === 'Ended'

  if (isEnded) {
    return (
      <div className={`stage stage-ended${fullscreen && fullscreen.active ? ' is-fullscreen' : ''}`} ref={ref}>
        <header className="stage-top">
          {leading || <Brand to="/" />}
          <div className="stage-title">
            <span className="stage-event">JPL Live Auction</span>
            <span className="status-pill status-completed">Auction Ended</span>
          </div>
          <div className="stage-tools">
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
          {state.showLiveRankings && (socket.teams && socket.teams.length > 0) ? (
            <div className="stage-declared-results" style={{ width: '100%', maxWidth: '1050px', margin: '0 auto', padding: '1rem', overflowY: 'auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div className="ended-trophy-glow" style={{ margin: '0 auto 0.75rem' }}>
                  <Trophy size={48} className="trophy-gold" />
                </div>
                <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 800 }}>Official Auction Results</h1>
                <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '1rem' }}>
                  Final franchise standings based on total player points. Franchises must complete all 15 player slots to qualify.
                </p>
              </div>

              {(() => {
                const qTeams = (socket.teams || []).filter(t => (Number(t.squad_count) || 0) >= 15).sort((a, b) => {
                  const ptsDiff = (Number(b.total_player_points) || 0) - (Number(a.total_player_points) || 0);
                  if (ptsDiff !== 0) return ptsDiff;
                  const purseDiff = (Number(b.remaining_purse) || 0) - (Number(a.remaining_purse) || 0);
                  if (purseDiff !== 0) return purseDiff;
                  return (Number(b.batsmen_points) || 0) - (Number(a.batsmen_points) || 0);
                });
                const dqTeams = (socket.teams || []).filter(t => (Number(t.squad_count) || 0) < 15);

                return (
                  <>
                    {qTeams.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(239,68,68,0.1)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.3)', margin: '1rem 0' }}>
                        <h3 style={{ color: '#f59e0b', margin: 0 }}>No Franchises Qualified</h3>
                        <p className="muted" style={{ margin: '0.25rem 0 0' }}>A completed 15-player squad is required to be ranked in the results.</p>
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
                                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{t.team_name}</div>
                                <div className="muted" style={{ fontSize: '0.9rem' }}>{t.owner_name} · Squad: {t.squad_count}/15</div>
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
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Incomplete Squads (&lt; 15 players)</span>
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
