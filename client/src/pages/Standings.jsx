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
      <div className="page-head">
        <div>
          <h1>Live Rankings</h1>
          <p className="muted">Current leaderboard based on total ICC ranking points. Each franchise started with {formatINR(750000000)}.</p>
        </div>
      </div>
      
      {!teams.length ? <EmptyState title="No franchises yet" /> : (
        <div className="leaderboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          {sortedTeams.map((t, idx) => {
            const rank = idx + 1;
            let medal = '';
            let rankColor = 'var(--text)';
            let scale = 1;
            let bg = 'var(--surface)';
            
            if (rank === 1) { 
              medal = '🥇'; 
              rankColor = '#FFD700'; 
              scale = 1.02;
              bg = 'linear-gradient(90deg, rgba(255, 215, 0, 0.1) 0%, var(--surface) 100%)';
            } else if (rank === 2) { 
              medal = '🥈'; 
              rankColor = '#C0C0C0'; 
              scale = 1.01;
              bg = 'linear-gradient(90deg, rgba(192, 192, 192, 0.1) 0%, var(--surface) 100%)';
            } else if (rank === 3) { 
              medal = '🥉'; 
              rankColor = '#CD7F32'; 
              bg = 'linear-gradient(90deg, rgba(205, 127, 50, 0.1) 0%, var(--surface) 100%)';
            }

            return (
              <button 
                key={t.id} 
                onClick={() => setOpen(t)}
                style={{ 
                  display: 'flex', alignItems: 'center', padding: '1.25rem', 
                  background: bg, border: '1px solid var(--line)', 
                  borderRadius: '12px', borderLeft: `8px solid ${t.color || 'var(--primary)'}`, 
                  cursor: 'pointer', transition: 'all 0.2s ease', 
                  transform: `scale(${scale})`, textAlign: 'left',
                  boxShadow: rank === 1 ? '0 4px 20px rgba(0,0,0,0.3)' : 'none'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = `scale(${scale * 1.01}) translateY(-2px)`}
                onMouseOut={(e) => e.currentTarget.style.transform = `scale(${scale}) translateY(0)`}
              >
                
                <div style={{ width: '70px', textAlign: 'center', fontSize: rank <= 3 ? '2.5rem' : '1.5rem', fontWeight: '900', color: rankColor, textShadow: rank === 1 ? '0 0 10px rgba(255,215,0,0.3)' : 'none' }}>
                  {medal ? medal : `#${rank}`}
                </div>
                
                <div style={{ marginRight: '1.5rem' }}>
                  <TeamMark team={t} size={64} />
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: rank === 1 ? '1.75rem' : '1.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 800 }}>{t.team_name}</h2>
                  <div style={{ color: 'var(--chalk-2)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{t.owner_name}</div>
                  
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--chalk-2)', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <span title="Batsmen">BAT: <b>{t.batsmen_count || 0}</b></span>
                    <span title="Bowlers">BOWL: <b>{t.bowlers_count || 0}</b></span>
                    <span title="All-Rounders">AR: <b>{t.allrounders_count || 0}</b></span>
                    <span title="Wicket Keepers">WK: <b>{t.keepers_count || 0}</b></span>
                    <span title="Foreign">FOR: <b>{t.foreign_count || 0}</b></span>
                    <span title="Uncapped">UNC: <b>{t.uncapped_count || 0}</b></span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '2.5rem', textAlign: 'right', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '80px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>{formatShort(t.remaining_purse)}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--chalk-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Purse Left</div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '60px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: t.squad_count >= t.max_squad_size ? 'var(--danger)' : 'var(--text)' }}>{t.squad_count}/{t.max_squad_size}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--chalk-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Squad</div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', background: 'rgba(0,0,0,0.2)', padding: '0.75rem 1.25rem', borderRadius: '8px', border: rank === 1 ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent' }}>
                    <div style={{ fontSize: rank === 1 ? '2.2rem' : '1.8rem', fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>{Number(t.total_player_points || 0).toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8, marginTop: '0.25rem' }}>Total Points</div>
                  </div>
                </div>
                
              </button>
            );
          })}
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