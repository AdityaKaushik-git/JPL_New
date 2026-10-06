import { useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { Loader, ErrorState, EmptyState } from '../components/States'
import TeamMark from '../components/TeamMark'
import PlayerCard from '../components/PlayerCard'
import Modal from '../components/Modal'
import LeaderPanel from '../components/live/LeaderPanel'
import { formatINR, formatShort } from '../lib/format'

/** Public franchise table with squads. */
export default function Standings() {
  const { data, error, loading, reload } = useAsync(() => api.getStandings(), [])
  const [open, setOpen] = useState(null)
  const squad = useAsync(() => (open ? api.getFranchise(open.id) : Promise.resolve(null)), [open && open.id])

  if (loading && !data) return <Loader full />
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  
  // Use data.standings or data.franchises depending on what api.getStandings returns.
  const teams = (data.standings || data.franchises || []).filter(t => t.status !== 'disabled')
  
  // Sort teams by total_player_points for ranking display
  const sortedTeams = [...teams].sort((a, b) => {
    const ptsDiff = (Number(b.total_player_points) || 0) - (Number(a.total_player_points) || 0)
    if (ptsDiff !== 0) return ptsDiff
    return (Number(b.remaining_purse) || 0) - (Number(a.remaining_purse) || 0)
  })

  return (
    <div className="page">
      <div className="page-head"><div><h1>Teams</h1><p className="muted">Purse, points and squad composition for every franchise. Each started with {formatINR(750000000)}.</p></div></div>
      
      {teams.length > 0 && <LeaderPanel teams={teams} />}

      {!teams.length ? <EmptyState title="No franchises yet" /> : (
        <div className="franchise-grid">
          {sortedTeams.map((t, idx) => (
            <button key={t.id} className="franchise-card franchise-card-btn" style={{ '--team': t.color }} onClick={() => setOpen(t)}>
              <header>
                <div className="rank-badge rank-sm" style={{ marginRight: '0.5rem' }}>
                  <small>Rank</small>
                  <b>#{idx + 1}</b>
                </div>
                <TeamMark team={t} size={52} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.team_name}</h3>
                  <p className="muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t.owner_name}</span>
                    <strong className="gold" style={{ fontSize: '1.1rem' }}>{Number(t.total_player_points || 0).toLocaleString('en-IN')} pts</strong>
                  </p>
                </div>
              </header>
              <dl className="franchise-nums">
                <div><dt>Purse</dt><dd>{formatShort(t.remaining_purse)}</dd></div>
                <div><dt>Spent</dt><dd>{formatShort(t.total_spent)}</dd></div>
                <div><dt>Squad</dt><dd>{t.squad_count}/{t.max_squad_size}</dd></div>
              </dl>
              
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--chalk-2)', padding: '0.5rem 0', borderTop: '1px solid var(--line)', marginTop: '0.5rem' }}>
                <span title="Batsmen">BAT: <b>{t.batsmen_count || 0}</b></span>
                <span title="Bowlers">BOWL: <b>{t.bowlers_count || 0}</b></span>
                <span title="All-Rounders">AR: <b>{t.allrounders_count || 0}</b></span>
                <span title="Wicket Keepers">WK: <b>{t.keepers_count || 0}</b></span>
                <span title="Foreign" style={{ marginLeft: 'auto' }}>FOR: <b>{t.foreign_count || 0}</b></span>
                <span title="Uncapped">UNC: <b>{t.uncapped_count || 0}</b></span>
              </div>
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
