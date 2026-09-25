import { formatINR } from '../../lib/format'

export default function BidFeed({ bids, limit = 6 }) {
  const list = (bids || []).slice(0, limit)
  return (
    <section className="bid-feed" aria-label="Recent bids">
      <p className="label">Bid feed</p>
      {list.length === 0 ? (
        <p className="bid-feed-empty">Bids will appear here.</p>
      ) : (
        <ol>
          {list.map((b, i) => (
            <li key={`${b.at}-${b.amount}`} className={i === 0 ? 'is-latest' : ''} style={{ '--team': b.color }}>
              <span className="bid-feed-team">{b.teamName || b.userName}</span>
              <span className="bid-feed-amt">{formatINR(b.amount)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
