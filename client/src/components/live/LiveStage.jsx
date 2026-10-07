import { forwardRef, useState } from 'react'
import { Maximize2, Minimize2, Wifi, WifiOff, Users } from 'lucide-react'
import Brand from '../Brand'
import PlayerHero from './PlayerHero'
import BidPanel from './BidPanel'
import TeamStrip from './TeamStrip'
import BidFeed from './BidFeed'
import ResultOverlay from './ResultOverlay'
import FranchiseModal from '../FranchiseModal'
import LiveRankingsView from './LiveRankingsView'
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

/**
 * Broadcast composition shared by the public /live screen and the owner bid room.
 * `dock` renders below the stage (the owner's bid controls).
 */
const LiveStage = forwardRef(function LiveStage({ socket, fullscreen, dock, leading }, ref) {
  const { state, teams, stats, connection, overlay, pulse, dismissOverlay } = socket
  const { player, status, lot, result } = state
  const leaderId = state.highestBidder ? state.highestBidder.id : null
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const isEnded = status === 'Ended'

  if (isEnded) {
    return (
      <div className={`stage stage-ended${fullscreen && fullscreen.active ? ' is-fullscreen' : ''}`} ref={ref}>
        <header className="stage-top">
          {leading || <Brand to="/" />}
          <div className="stage-title">
            <span className="stage-event">JPL Live Auction</span>
            <span className="status-pill status-completed">🏆 Auction Completed</span>
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

        <main className="stage-main stage-main-rankings">
          <LiveRankingsView teams={teams} onSelectTeam={setSelectedTeamId} />
        </main>

        <FranchiseModal franchiseId={selectedTeamId} onClose={() => setSelectedTeamId(null)} />
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
              <BidPanel state={state} onSelectTeam={setSelectedTeamId} />
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

      <TeamStrip teams={teams} pulse={pulse} leaderId={leaderId} onSelectTeam={setSelectedTeamId} />
      {dock}
      <ResultOverlay result={overlay} onDismiss={dismissOverlay} />
      <FranchiseModal franchiseId={selectedTeamId} onClose={() => setSelectedTeamId(null)} />
    </div>
  )
})

export default LiveStage
