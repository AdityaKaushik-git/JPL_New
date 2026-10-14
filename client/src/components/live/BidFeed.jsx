import { formatINR } from '../../lib/format'
import { Activity, Clock } from 'lucide-react'

// Live stream of incoming auction bids.
export default function BidFeed({ bids, limit = 6 }) {
  const list = (bids || []).slice(0, limit)

  return (
    <section className="bid-feed" aria-label="Recent bids">
      <div className="bid-feed-header">
        <div className="bid-feed-title">
          <Activity size={15} className="feed-activity-icon" />
          <span>Live Bid Stream</span>
        </div>
        <span className="feed-count-pill">{list.length} {list.length === 1 ? 'Bid' : 'Bids'}</span>
      </div>

      {list.length === 0 ? (
        <div className="bid-feed-empty-box">
          <Clock size={20} className="empty-clock-icon" />
          <p>No bids recorded for this lot yet</p>
        </div>
      ) : (
        <ol className="bid-feed-list">
          {list.map((b, i) => (
            <li 
              key={`${b.at}-${b.amount}`} 
              className={`bid-feed-item${i === 0 ? ' is-latest' : ''}`} 
              style={{ '--team': b.color }}
            >
              <div className="feed-team-badge">
                <span className="feed-team-pip" style={{ background: b.color || 'var(--gold)' }} />
                <span className="bid-feed-team">{b.teamName || b.userName}</span>
              </div>
              <div className="feed-amount-badge">
                <span className="bid-feed-amt">{formatINR(b.amount)}</span>
                {i === 0 && <span className="latest-tag">LATEST</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
