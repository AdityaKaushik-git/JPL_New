import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { Loader, ErrorState, EmptyState } from '../components/States'
import PlayerCard from '../components/PlayerCard'
import TeamMark from '../components/TeamMark'
import { formatINR } from '../lib/format'

export default function MyTeam() {
  const { data, error, loading, reload } = useAsync(() => api.getMyTeam(), [])
  if (loading && !data) return <Loader full />
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  const { franchise: f, team } = data
  const slots = Math.max(0, f.max_squad_size - team.length)

  return (
    <div className="page">
      <div className="page-head">
        <div className="team-cell"><TeamMark team={f} size={56} /><div><h1>{f.team_name} squad</h1><p className="muted">{team.length} of {f.max_squad_size} players · {formatINR(f.total_spent)} spent</p></div></div>
      </div>
      {team.length === 0 ? (
        <EmptyState icon={<Users size={26} />} title="Your squad is empty" action={<Link to="/auction" className="btn btn-primary">Go to the bid room</Link>}>
          Win players in the live auction. You can hold up to {f.max_squad_size}.
        </EmptyState>
      ) : (
        <div className="card-grid">
          {team.map(p => <PlayerCard key={p.id} player={p} accent={f.color} price={p.purchase_price} />)}
          {Array.from({ length: slots }).map((_, i) => (
            <div key={`slot-${i}`} className="slot-card"><span>{team.length + i + 1}</span><small>Open slot</small></div>
          ))}
        </div>
      )}
    </div>
  )
}
