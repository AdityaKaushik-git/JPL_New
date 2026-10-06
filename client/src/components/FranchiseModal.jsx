import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import Modal from './Modal'
import TeamMark from './TeamMark'
import RoleSlots from './RoleSlots'
import PlayerCard from './PlayerCard'
import { Loader, ErrorState, EmptyState } from './States'
import { formatINR } from '../lib/format'

export default function FranchiseModal({ franchiseId, onClose }) {
  const open = Boolean(franchiseId)
  const { data, error, loading } = useAsync(
    () => (franchiseId ? api.getFranchise(franchiseId) : Promise.resolve(null)),
    [franchiseId]
  )

  if (!open) return null

  const f = data?.franchise || {}
  const squad = data?.squad || []
  const maxSquad = f.max_squad_size || 15
  const openSlots = Math.max(0, maxSquad - squad.length)

  return (
    <Modal
      open={open}
      title={f.team_name ? `${f.team_name} — Franchise Profile` : 'Franchise Profile'}
      onClose={onClose}
      width={1000}
    >
      {loading || !data ? (
        <Loader />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <div className="franchise-modal-content">
          {/* Header */}
          <div className="fmodal-head" style={{ '--accent': f.color || 'var(--night-4)' }}>
            <div className="fmodal-cell">
              <TeamMark team={f} size={64} />
              <div>
                <div className="fmodal-title-row">
                  <h2>{f.team_name}</h2>
                  <span className="chip">{f.short_name}</span>
                </div>
                <p className="muted" style={{ margin: '.2rem 0 0' }}>Franchise Owner: <b>{f.owner_name}</b></p>
              </div>
            </div>
            
            <div className="fmodal-score-box">
              <div className="fmodal-score-val">{Number(f.total_player_points || 0).toLocaleString('en-IN')}</div>
              <div className="fmodal-score-label">Total ICC Ranking Points</div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="fmodal-stats-grid">
            <div className="fmodal-stat">
              <span className="muted" style={{ fontSize: '.8rem' }}>Remaining Purse</span>
              <strong>{formatINR(f.remaining_purse)}</strong>
              <small className="muted">Starting: {formatINR(f.starting_purse || 750000000)}</small>
            </div>
            <div className="fmodal-stat">
              <span className="muted" style={{ fontSize: '.8rem' }}>Total Spent</span>
              <strong>{formatINR(f.total_spent)}</strong>
              <small className="muted">Purchased: {squad.length} player(s)</small>
            </div>
            <div className="fmodal-stat">
              <span className="muted" style={{ fontSize: '.8rem' }}>Squad Size</span>
              <strong className={squad.length >= maxSquad ? 'text-danger' : ''}>{squad.length} / {maxSquad}</strong>
              <small className="muted">{openSlots} open slot(s) left</small>
            </div>
            <div className="fmodal-stat">
              <span className="muted" style={{ fontSize: '.8rem' }}>Batsmen Points (TB2)</span>
              <strong>{Number(f.batsmen_points || 0).toLocaleString('en-IN')} pts</strong>
              <small className="muted">Tie-breaker criteria #2</small>
            </div>
          </div>

          {/* Squad Composition Slots */}
          <div className="fmodal-section">
            <h4 className="fmodal-section-title">Squad Composition Requirements</h4>
            <RoleSlots franchise={f} />
          </div>

          {/* Roster Display */}
          <div className="fmodal-section">
            <h4 className="fmodal-section-title">Purchased Squad Roster ({squad.length})</h4>
            {!squad.length ? (
              <EmptyState title="No players purchased yet" />
            ) : (
              <div className="card-grid">
                {squad.map(p => (
                  <PlayerCard key={p.id} player={p} accent={f.color} price={p.purchase_price} />
                ))}
                {Array.from({ length: openSlots }).map((_, i) => (
                  <div key={`open-slot-${i}`} className="slot-card">
                    <span>{squad.length + i + 1}</span>
                    <small>Open slot</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
