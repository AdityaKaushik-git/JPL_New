import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { Loader, ErrorState } from '../components/States'
import PitchBackdrop from '../components/PitchBackdrop'
import RoleIcon from '../components/RoleIcon'
import RankBadge from '../components/RankBadge'
import TeamMark from '../components/TeamMark'
import StatGrid from '../components/StatGrid'
import Movement, { FormDelta } from '../components/Movement'
import { LineChart, BarChart } from '../components/Charts'
import PlayerAvatar from '../components/PlayerAvatar'
import { formatINR, roleMeta, fmtDecimal, oversFromBalls, dateTime, pad2 } from '../lib/format'

function priceTierLabel(points) {
  if (points >= 900) return '900+ pts → ₹4 Cr tier'
  if (points >= 800) return '800-899 pts → ₹3 Cr tier'
  if (points >= 700) return '700-799 pts → ₹2 Cr tier'
  if (points >= 600) return '600-699 pts → ₹1.5 Cr tier'
  if (points >= 500) return '500-599 pts → ₹1 Cr tier'
  if (points >= 400) return '400-499 pts → ₹50 L tier'
  if (points >= 300) return '300-399 pts → ₹25 L tier'
  return 'Below 300 pts → base tier'
}

export default function PlayerProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, error, loading, reload } = useAsync(() => api.getPlayer(id), [id])

  if (loading && !data) return <Loader full />
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>

  const { player: p, rankingHistory, matches, bids } = data
  const role = roleMeta(p.playing_role)
  const accent = p.team ? p.team.color : undefined
  const movement = p.previous_rank && p.current_rank ? p.previous_rank - p.current_rank : 0
  const isBidder = user?.role === 'user'

  return (
    <div className="page profile">
      <Link to={isBidder ? '/dashboard' : '/rankings'} className="back-link">
        <ArrowLeft size={16} /> {isBidder ? 'Dashboard' : 'Rankings'}
      </Link>

      <section className="profile-hero" style={accent ? { '--accent': accent } : undefined}>
        <PitchBackdrop className="hero-pitch" />
        <span className="hero-watermark" aria-hidden="true">{p.initials}</span>
        
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: '1.5rem' }}>
          <PlayerAvatar player={p} size="hero" />
        </div>

        <div className="profile-hero-body" style={{ gridColumn: '2' }}>
          <p className="hero-lot">Player <b>#{pad2(p.auction_order)}</b> <span className="hero-code">{p.player_code}</span></p>
          <h1 className="profile-name">{p.name} {p.country && <span className="country-badge">({p.country})</span>}</h1>
          <div className="hero-tags">
            {p.country && <span className="chip" style={{ fontSize: '0.9rem', fontWeight: 600, background: 'rgba(255,255,255,0.1)' }}>{p.country}</span>}
            <span className={`role-chip role-${role.key}`}><RoleIcon role={p.playing_role} size={20} /> {role.label}</span>
            {p.batting_style && <span className="hero-style">{p.batting_style}</span>}
            {p.bowling_style && <span className="hero-style">{p.bowling_style}</span>}
          </div>
          <div className="profile-facts">
            <RankBadge rank={p.current_rank} size="lg" />
            <div><small>Ranking points</small><b>{p.ranking_points}</b></div>
            <div><small>{p.category} rank</small><b>{p.category_rank ? `#${p.category_rank}` : 'NR'}</b></div>
            <div><small>Form</small><FormDelta value={p.ranking_points - p.previous_ranking_points} /></div>
            <div><small>Movement</small><Movement value={movement} /></div>
            <div><small>Form rating</small><b>{p.form_points}/100</b></div>
          </div>
        </div>
        
        <aside className="profile-auction" style={{ gridColumn: '3' }}>
          <small>Auction status</small>
          <b className={`status-tag st-${p.status.replace(' ', '-').toLowerCase()}`}>{p.status}</b>
          <small>Base price</small><b>{formatINR(p.base_price)}</b>
          
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(242,193,78,0.08)', borderRadius: '4px', borderLeft: '3px solid var(--gold)' }}>
            <small style={{ color: 'var(--gold)', margin: 0 }}>Why this price?</small>
            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{priceTierLabel(p.ranking_points)}</div>
          </div>

          {p.team && (
            <>
              <small>Team</small>
              <span className="team-cell"><TeamMark team={p.team} size={30} /> {p.team.team_name}</span>
              <small>Auction price</small><b className="gold">{formatINR(p.sold_price)}</b>
            </>
          )}
        </aside>
      </section>

      <div className="profile-grid">
        <section className="panel">
          <h2>Batting</h2>
          <StatGrid items={[
            { label: 'Matches', value: p.matches }, { label: 'Innings', value: p.innings }, { label: 'Not outs', value: p.not_outs },
            { label: 'Runs', value: p.runs, emphasis: true }, { label: 'Average', value: fmtDecimal(p.batting_average) },
            { label: 'Strike rate', value: fmtDecimal(p.strike_rate, 1) }, { label: 'Highest', value: p.highest_score || '—' },
            { label: '50s', value: p.fifties }, { label: '100s', value: p.hundreds },
          ]} />
        </section>
        <section className="panel">
          <h2>Bowling</h2>
          <StatGrid items={[
            { label: 'Overs', value: oversFromBalls(p.balls_bowled) }, { label: 'Wickets', value: p.wickets, emphasis: true },
            { label: 'Runs conceded', value: p.runs_conceded }, { label: 'Economy', value: fmtDecimal(p.economy) },
            { label: 'Average', value: fmtDecimal(p.bowling_average) }, { label: 'Strike rate', value: fmtDecimal(p.bowling_strike_rate, 1) },
            { label: 'Best', value: p.best_bowling || '—' }, { label: '3W / 4W / 5W', value: `${p.three_wkt_hauls} / ${p.four_wkt_hauls} / ${p.five_wkt_hauls}` },
          ]} />
        </section>
        <section className="panel">
          <h2>Fielding & impact</h2>
          <StatGrid items={[
            { label: 'Catches', value: p.catches }, { label: 'Stumpings', value: p.stumpings },
            { label: 'Run outs', value: p.run_outs }, { label: 'Player of match', value: p.player_of_match, emphasis: true },
          ]} />
        </section>
        <section className="panel">
          <h2>Ranking history</h2>
          <LineChart label="Ranking points over time" points={rankingHistory.map(h => ({ y: h.points }))} format={(v) => `${v} pts`} />
        </section>
        <section className="panel panel-span">
          <h2>Match history</h2>
          <BarChart label={p.playing_role === 'Bowler' ? 'Wickets per match' : 'Runs per match'}
            bars={[...matches].reverse().map(m => ({ value: p.playing_role === 'Bowler' ? m.wickets : m.runs, accent: m.runs >= 50 || m.wickets >= 3 }))} />
          {matches.length > 0 && (
            <div className="table-scroll">
              <table className="table table-compact">
                <thead><tr><th>Match</th><th>Date</th><th className="num-col">Runs (balls)</th><th className="num-col">Bowling</th><th className="num-col">Ct / St</th></tr></thead>
                <tbody>
                  {matches.map(m => (
                    <tr key={m.id}>
                      <td>{m.match_label}</td><td className="muted">{m.match_date ? String(m.match_date).slice(0, 10) : '—'}</td>
                      <td className="num-col">{m.runs} ({m.balls_faced})</td>
                      <td className="num-col">{m.balls_bowled ? `${m.wickets}/${m.runs_conceded} (${oversFromBalls(m.balls_bowled)})` : '—'}</td>
                      <td className="num-col">{m.catches} / {m.stumpings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {bids.length > 0 && (
          <section className="panel panel-span">
            <h2>Auction bids</h2>
            <ol className="bid-trail">
              {bids.map((b, i) => (
                <li key={i} style={{ '--team': b.color }}><b>{b.short_name}</b> <span>{formatINR(b.amount)}</span> <small className="muted">{dateTime(b.at)}</small></li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  )
}
