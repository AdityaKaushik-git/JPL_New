import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { Loader, ErrorState, EmptyState } from '../components/States'
import Initials from '../components/Initials'
import RoleIcon from '../components/RoleIcon'
import Movement, { FormDelta } from '../components/Movement'
import { pad2, roleMeta } from '../lib/format'

const CATEGORIES = [
  { id: 'overall', label: 'Overall' },
  { id: 'batters', label: 'Batters' },
  { id: 'bowlers', label: 'Bowlers' },
  { id: 'all-rounders', label: 'All-rounders' },
  { id: 'wicketkeepers', label: 'Wicketkeepers' },
]

export default function Rankings() {
  const [cat, setCat] = useState('overall')
  const { data, error, loading, reload } = useAsync(() => api.getRankings(cat), [cat])
  const navigate = useNavigate()
  const rows = data ? data.players : []
  const ranked = rows.filter(r => r.rank !== null)
  const unranked = rows.filter(r => r.rank === null)
  const podium = ranked.slice(0, 3)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>JPL player rankings</h1>
          <p className="muted">JPL's own rating, built from runs, wickets, rates, milestones, form and match impact. Not an official ICC ranking.</p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {CATEGORIES.map(c => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
      </div>

      {loading && !data ? <Loader /> : error ? <ErrorState error={error} onRetry={reload} /> : !ranked.length ? (
        <EmptyState title="No ranked players yet">Players are ranked once they have at least one match recorded.</EmptyState>
      ) : (
        <>
          <div className="podium">
            {podium.map((p, i) => (
              <button key={p.id} className={`podium-card podium-${i + 1}`} onClick={() => navigate(`/players/${p.id}`)}>
                <span className="podium-rank">#{pad2(p.rank)}</span>
                <span className="podium-mono" aria-hidden="true">{p.initials}</span>
                <b className="podium-name">{p.name} {p.country && <small className="muted" style={{ fontWeight: 500, fontSize: '0.85em' }}>({p.country})</small>}</b>
                <span className="podium-role"><RoleIcon role={p.playing_role} size={15} /> {roleMeta(p.playing_role).label}</span>
                <span className="podium-pts"><b>{p.ranking_points}</b> pts <Movement value={p.movement} /></span>
              </button>
            ))}
          </div>

          <div className="table-scroll panel">
            <table className="table ranking-table">
              <thead>
                <tr><th>Rank</th><th /><th>Player</th><th>Role</th><th className="num-col">M</th><th className="num-col">Points</th><th className="num-col">Form</th><th className="num-col">Move</th></tr>
              </thead>
              <tbody>
                {ranked.map(p => (
                  <tr key={p.id} className="row-link" onClick={() => navigate(`/players/${p.id}`)} tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') navigate(`/players/${p.id}`) }}>
                    <td className="rank-col">{pad2(p.rank)}</td>
                    <td><Initials initials={p.initials} size="sm" /></td>
                    <td><b>{p.name}</b> {p.country && <span className="country-badge">({p.country})</span>}{p.team && <small className="muted"> · {p.team.short_name}</small>}</td>
                    <td><span className="role-inline"><RoleIcon role={p.playing_role} size={15} /> {roleMeta(p.playing_role).short}</span></td>
                    <td className="num-col">{p.matches}</td>
                    <td className="num-col"><b>{p.ranking_points}</b></td>
                    <td className="num-col"><FormDelta value={p.form} /></td>
                    <td className="num-col">
                      <Movement value={p.movement} />
                      {p.previous && p.previous !== p.rank && <small className="muted prev-rank">prev #{p.previous}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unranked.length > 0 && <p className="muted small-note">Unranked (no matches yet): {unranked.map(u => `${u.name}${u.country ? ` (${u.country})` : ''}`).join(', ')}</p>}
        </>
      )}
    </div>
  )
}
