import { useEffect, useRef, useState } from 'react'
import { Gavel, TrendingUp, Award, Clock } from 'lucide-react'
import AnimatedNumber from '../AnimatedNumber'
import TeamMark from '../TeamMark'
import TimerRing from './TimerRing'
import { formatINR } from '../../lib/format'

// Current bid, highest bidder spotlight, next bid increment, and live countdown timer.
export default function BidPanel({ state }) {
  const { currentBid, highestBidder, nextBid, status, timeLeft, timerTotal, bidCount, player } = state
  const [bump, setBump] = useState(false)
  const last = useRef(currentBid)

  useEffect(() => {
    if (currentBid > last.current) {
      setBump(true)
      const t = setTimeout(() => setBump(false), 450)
      last.current = currentBid
      return () => clearTimeout(t)
    }
    last.current = currentBid
  }, [currentBid])

  const hasBid = currentBid > 0
  const isLive = status === 'Live'

  return (
    <section className="bidpanel" aria-label="Bidding" style={highestBidder ? { '--team': highestBidder.color } : undefined}>
      {/* Top Status & Activity Bar */}
      <div className="bidpanel-topbar">
        <div className="bid-status-pill">
          <span className={`live-pulse-dot${isLive ? ' is-pulsing' : ''}`} />
          <span>{hasBid ? 'Current Leading Bid' : (isLive ? 'Opening Reserve' : 'Base Price')}</span>
        </div>
        <div className="bid-counter-badge">
          <Gavel size={13} />
          <span>{bidCount} {bidCount === 1 ? 'Bid' : 'Bids'} Placed</span>
        </div>
      </div>

      {/* Main Massive Bid Price Display */}
      <div className={`bid-amount-display${bump ? ' is-bump' : ''}`} aria-live="polite">
        <AnimatedNumber value={hasBid ? currentBid : (player ? player.base_price : 0)} format={formatINR} />
      </div>

      {/* Leading Bidder Spotlight Card */}
      <div className="bidder-spotlight">
        {highestBidder ? (
          <div className="highest-bidder-card" key={highestBidder.id}>
            <div className="bidder-team-mark-wrap">
              <TeamMark team={highestBidder} size={52} />
            </div>
            <div className="bidder-team-details">
              <span className="bidder-lead-label">
                <Award size={13} className="trophy-lead-icon" /> Highest Bidder
              </span>
              <h2 className="bidder-team-name">{highestBidder.team_name}</h2>
            </div>
          </div>
        ) : (
          <div className="bidder-empty-state">
            <span className="bidder-empty-icon"><Gavel size={20} /></span>
            <div className="bidder-empty-text">
              <p className="bidder-empty-title">{isLive ? 'Awaiting First Paddle' : 'Auction Paused'}</p>
              <p className="bidder-empty-sub">
                {isLive ? `Opens at base reserve of ${formatINR(player ? player.base_price : 0)}` : 'Waiting for the auctioneer'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: Next Bid Step & Live Countdown Timer */}
      <div className="bidpanel-footer-grid">
        <div className="next-bid-card">
          <div className="next-bid-head">
            <TrendingUp size={14} className="next-bid-icon" />
            <small>Next Required Bid</small>
          </div>
          <b className="next-bid-value">
            {status === 'Completed' || !nextBid ? '—' : formatINR(nextBid)}
          </b>
          <span className="next-bid-hint">Minimum increment step</span>
        </div>

        <div className="timer-dock-card">
          <TimerRing timeLeft={timeLeft} total={timerTotal} status={status} />
        </div>
      </div>
    </section>
  )
}
