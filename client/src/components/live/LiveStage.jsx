import { forwardRef, useState, useEffect } from 'react'
import { Maximize2, Minimize2, Wifi, WifiOff, Users, Trophy, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import Brand from '../Brand'
import PlayerHero from './PlayerHero'
import BidPanel from './BidPanel'
import BidFeed from './BidFeed'
import ResultOverlay from './ResultOverlay'
import LiveRankingsView from './LiveRankingsView'
import FranchiseModal from '../FranchiseModal'
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

  const [fetchedTeams, setFetchedTeams] = useState([])
  const [selectedFranchise, setSelectedFranchise] = useState(null)

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

        <main className={`stage-main ${showResults ? 'stage-main-results' : ''}`}>
          {showResults ? (
            <LiveRankingsView
              teams={teamsList}
              onSelectTeam={(team) => setSelectedFranchise(team)}
              isDeclared={isDeclared}
              isAdmin={isAdmin}
              showRankings={state.showLiveRankings}
              onToggleRankings={() => emit && emit('admin:toggleRankings', { enabled: !state.showLiveRankings })}
              initialView="declared"
            />
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

        <FranchiseModal franchiseId={selectedFranchise?.id} onClose={() => setSelectedFranchise(null)} />
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
      <FranchiseModal franchiseId={selectedFranchise?.id} onClose={() => setSelectedFranchise(null)} />
    </div>
  )
})

export default LiveStage
