import { useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { Loader, ErrorState, EmptyState } from '../components/States'
import TeamMark from '../components/TeamMark'
import PlayerCard from '../components/PlayerCard'
import Modal from '../components/Modal'
import { formatINR, formatShort } from '../lib/format'

/** Public franchise table with squads. */
export default function Standings() {
  const { data, error, loading, reload } = useAsync(() => api.getFranchises(), [])
  const [open, setOpen] = useState(null)
  const squad = useAsync(() => (open ? api.getFranchise(open.id) : Promise.resolve(null)), [open && open.id])

  if (loading && !data) return <Loader full />
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  const teams = data.franchises.filter(t => t.status !== 'disabled')

  return (
    <div className="page">
      <div className="page-head"><div><h1>Teams</h1><p className="muted">Purse and squad for every franchise. Each started with {formatINR(180000000)}.</p></div></div>
      {!teams.length ? <EmptyState title="No franchises yet" /> : (
        <div className="franchise-grid">
          {teams.map(t => (
            <button key={t.id} className="franchise-card franchise-card-btn" style={{ '--team': t.color }} onClick={() => setOpen(t)}>
              <header><TeamMark team={t} size={52} /><div><h3>{t.team_name}</h3><p className="muted">{t.owner_name}</p></div></header>
              <dl className="franchise-nums">
                <div><dt>Purse</dt><dd>{formatShort(t.remaining_purse)}</dd></div>
                <div><dt>Spent</dt><dd>{formatShort(t.total_spent)}</dd></div>
                <div><dt>Squad</dt><dd>{t.squad_count}/{t.max_squad_size}</dd></div>
              </dl>
              <div className="purse-bar"><i style={{ width: `${Math.min(100, (t.total_spent / t.starting_purse) * 100)}%` }} /></div>
            </button>
          ))}
        </div>
      )}
      <Modal open={Boolean(open)} title={open ? `${open.team_name} squad` : ''} onClose={() => setOpen(null)} width={960}>
        {squad.loading || !squad.data ? <Loader /> : squad.data.squad.length ? (
          <div className="card-grid">{squad.data.squad.map(p => <PlayerCard key={p.id} player={p} accent={open.color} price={p.purchase_price} />)}</div>
        ) : <p className="muted">No players bought yet.</p>}
      </Modal>
    </div>
  )
}
