import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { Loader, ErrorState, EmptyState } from '../components/States'
import { formatINR, dateTime, roleMeta } from '../lib/format'

export default function MyBids() {
  const { data, error, loading, reload } = useAsync(() => api.getMyBids(), [])
  const [filter, setFilter] = useState('All')
  if (loading && !data) return <Loader full />
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  const bids = data.bids.filter(b => filter === 'All' || b.status === filter)

  return (
    <div className="page">
      <div className="page-head"><div><h1>My bids</h1><p className="muted">Every paddle you raised, newest first.</p></div></div>
      <div className="tabs">
        {['All', 'Won', 'Outbid', 'Live'].map(f => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>)}
      </div>
      {bids.length === 0 ? <EmptyState title="No bids here" action={<Link to="/auction" className="btn btn-primary">Go to the bid room</Link>} /> : (
        <div className="panel table-scroll">
          <table className="table">
            <thead><tr><th>Player</th><th>Role</th><th className="num-col">Amount</th><th>When</th><th>Result</th></tr></thead>
            <tbody>{bids.map(b => (
              <tr key={b.id}>
                <td><Link to={`/players/${b.player_id}`}><b>{b.player_name}</b></Link></td>
                <td className="muted">{roleMeta(b.playing_role).label}</td>
                <td className="num-col">{formatINR(b.bid_amount)}</td>
                <td className="muted">{dateTime(b.created_at)}</td>
                <td><span className={`status-tag st-${b.status.toLowerCase()}`}>{b.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
