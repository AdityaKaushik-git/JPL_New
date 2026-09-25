import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { Loader, ErrorState, EmptyState } from '../components/States'
import Initials from '../components/Initials'
import TeamMark from '../components/TeamMark'
import RoleIcon from '../components/RoleIcon'
import { formatINR, dateTime, roleMeta } from '../lib/format'

/** Public auction history — every SOLD and UNSOLD result. */
export default function History() {
  const { data, error, loading, reload } = useAsync(() => api.getHistory(), [])
  if (loading && !data) return <Loader full />
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  const rows = data.history
  const sold = rows.filter(r => r.status === 'Sold')
  const total = sold.reduce((s, r) => s + (r.winning_bid || 0), 0)

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Auction results</h1><p className="muted">{sold.length} sold · {rows.length - sold.length} unsold · {formatINR(total)} spent</p></div>
      </div>
      {!rows.length ? <EmptyState title="No results yet">Results appear the moment a player is sold or goes unsold.</EmptyState> : (
        <ol className="results">
          {rows.map(r => (
            <li key={r.id} className={`result-row result-row-${r.status.toLowerCase()}`} style={r.team ? { '--team': r.team.color } : undefined}>
              <Initials initials={r.initials} size="md" accent={r.team?.color} />
              <div className="result-row-player">
                <Link to={`/players/${r.player_id}`}><b>{r.player_name}</b></Link>
                <small className="muted"><RoleIcon role={r.playing_role} size={13} /> {roleMeta(r.playing_role).label} · {r.bid_count} bids · {dateTime(r.completed_at)}</small>
              </div>
              {r.status === 'Sold' ? (
                <div className="result-row-sale">
                  <span className="team-cell"><TeamMark team={r.team} size={28} /> {r.team?.team_name}</span>
                  <b className="gold">{formatINR(r.winning_bid)}</b>
                </div>
              ) : <span className="status-tag st-unsold">Unsold</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
