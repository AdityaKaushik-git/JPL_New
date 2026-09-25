import { useEffect, useRef, useState } from 'react'
import AnimatedNumber from '../AnimatedNumber'
import TeamMark from '../TeamMark'
import TimerRing from './TimerRing'
import { formatINR } from '../../lib/format'

/** Current bid, current bidder, next bid and the timer — the second and third biggest things on screen. */
export default function BidPanel({ state }) {
  const { currentBid, highestBidder, nextBid, status, timeLeft, timerTotal, bidCount, player } = state
  const [bump, setBump] = useState(false)
  const last = useRef(currentBid)

  useEffect(() => {
    if (currentBid > last.current) {
      setBump(true)
      const t = setTimeout(() => setBump(false), 420)
      last.current = currentBid
      return () => clearTimeout(t)
    }
    last.current = currentBid
  }, [currentBid])

  const hasBid = currentBid > 0
  return (
    <section className="bidpanel" aria-label="Bidding" style={highestBidder ? { '--team': highestBidder.color } : undefined}>
      <p className="label">{hasBid ? 'Current bid' : 'Opening bid'}</p>
      <div className={`bid-amount${bump ? ' is-bump' : ''}`} aria-live="polite">
        <AnimatedNumber value={hasBid ? currentBid : (player ? player.base_price : 0)} format={formatINR} />
      </div>

      <div className="bidpanel-row">
        <div className={`bidder${highestBidder ? ' has-bidder' : ''}`} key={highestBidder ? highestBidder.id : 'none'}>
          {highestBidder ? (
            <>
              <TeamMark team={highestBidder} size={46} />
              <div>
                <p className="label">Current bidder</p>
                <p className="bidder-name">{highestBidder.team_name}</p>
              </div>
            </>
          ) : (
            <p className="bidder-empty">{status === 'Live' ? 'Waiting for the first paddle' : 'No bids yet'}</p>
          )}
          <div className="next-bid">
            <p className="label">Next bid</p>
            <b>{status === 'Completed' || !nextBid ? '—' : formatINR(nextBid)}</b>
            <small>{bidCount} {bidCount === 1 ? 'bid' : 'bids'}</small>
          </div>
        </div>
        <TimerRing timeLeft={timeLeft} total={timerTotal} status={status} />
      </div>
    </section>
  )
}
