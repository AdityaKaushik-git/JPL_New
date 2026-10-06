/**
 * LeaderPanel — shows the current JPL leader and WHY they are leading.
 */
import { useAuth } from '../../contexts/AuthContext'
import TeamMark from '../TeamMark'
import { formatINR, formatShort } from '../../lib/format'

export default function LeaderPanel({ teams }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return null
  if (!teams || !teams.length) return null
  
  // Sort by total_player_points (primary), remaining_purse (tiebreak 1), batsmen_points (tiebreak 2)
  const sorted = [...teams].sort((a, b) => {
    const ptsDiff = (Number(b.total_player_points) || 0) - (Number(a.total_player_points) || 0)
    if (ptsDiff !== 0) return ptsDiff
    const purseDiff = (Number(b.remaining_purse) || 0) - (Number(a.remaining_purse) || 0)
    if (purseDiff !== 0) return purseDiff
    return (Number(b.batsmen_points) || 0) - (Number(a.batsmen_points) || 0)
  })
  
  const leader = sorted[0]
  if (!leader) return null
  
  return (
    <div className="leader-panel" style={{ '--team': leader.color }}>
      <div className="leader-panel-header">
        <span className="leader-crown">🏆</span>
        <span className="leader-label">CURRENT LEADER</span>
      </div>
      <div className="leader-body">
        <TeamMark team={leader} size={44} />
        <div className="leader-info">
          <div className="leader-name">{leader.team_name}</div>
          <div className="leader-pts">
            <span className="leader-pts-num">{Number(leader.total_player_points || 0).toLocaleString('en-IN')}</span>
            <span className="leader-pts-label"> PTS</span>
          </div>
        </div>
        <div className="leader-rank">#1</div>
      </div>
      <div className="leader-why">
        <div className="leader-why-title">WHY LEADING</div>
        <div className="leader-why-grid">
          <div><small>Players</small><b>{leader.squad_count || 0}</b></div>
          <div><small>Total Spent</small><b>{formatShort(leader.total_spent)}</b></div>
          <div><small>Remaining</small><b>{formatShort(leader.remaining_purse)}</b></div>
        </div>
        <div className="leader-why-note">
          Ranked #1 by <strong>Total Player Points</strong> ({Number(leader.total_player_points || 0).toLocaleString('en-IN')} pts). Squad depth and remaining purse are secondary factors.
        </div>
      </div>
    </div>
  )
}
