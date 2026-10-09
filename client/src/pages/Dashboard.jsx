import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Gavel, Radio, SlidersHorizontal, Users, Check, X, Pencil, Play, Square, Trophy, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { useAuctionSocket } from '../hooks/useAuctionSocket'
import { api } from '../services/api'
import { Loader, ErrorState, EmptyState } from '../components/States'
import TeamMark from '../components/TeamMark'
import PlayerCard from '../components/PlayerCard'
import Initials from '../components/Initials'
import RoleIcon from '../components/RoleIcon'
import RankBadge from '../components/RankBadge'
import StatGrid, { keyStatsFor } from '../components/StatGrid'
import { formatINR, formatShort, roleMeta } from '../lib/format'

export default function Dashboard() {
  const { user } = useAuth()
  if (user?.role === 'admin') return <AdminOverview />
  if (user?.role === 'player') return <PlayerHome />
  return <OwnerDashboard />
}

function OwnerDashboard() {
  const { data, error, loading, reload } = useAsync(() => api.getDashboard(), [])
  if (loading && !data) return <Loader full />
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  const f = data.franchise
  const spentPct = Math.min(100, (f.total_spent / f.starting_purse) * 100)
  const full = f.squad_count >= f.max_squad_size

  return (
    <div className="page">
      <section className="owner-hero" style={{ '--team': f.color }}>
        <TeamMark team={f} size={92} />
        <div className="owner-hero-text">
          <h1>{f.team_name}</h1>
          <p className="muted">Owner: {f.owner_name}</p>
        </div>
        <Link to="/auction" className="btn btn-primary btn-lg"><Gavel size={18} /> Enter bid room</Link>
      </section>

      <section className="purse-panel panel">
        <div className="purse-main">
          <small>Remaining purse</small>
          <b className="gold">{formatINR(f.remaining_purse)}</b>
          <div className="purse-bar purse-bar-lg"><i style={{ width: `${spentPct}%` }} /></div>
          <p className="muted">{formatINR(f.total_spent)} spent of {formatINR(f.starting_purse)}</p>
        </div>
        <dl className="purse-facts">
          <div><dt>Starting purse</dt><dd>{formatINR(f.starting_purse)}</dd></div>
          <div><dt>Total spent</dt><dd>{formatINR(f.total_spent)}</dd></div>
          <div><dt>Squad</dt><dd className={full ? 'text-danger' : ''}>{full ? 'Squad full · ' : ''}{f.squad_count} / {f.max_squad_size}</dd></div>
          <div><dt>Average purchase</dt><dd>{f.squad_count ? formatINR(data.averagePurchase) : '—'}</dd></div>
          <div><dt>Highest purchase</dt><dd>{f.squad_count ? formatINR(data.highestPurchase) : '—'}</dd></div>
        </dl>
      </section>

      <div className="section-head">
        <h2>Squad</h2>
        <div className="role-mix">
          {Object.entries(data.roleMix || {}).map(([r, n]) => (
            <span key={r} className="chip"><RoleIcon role={r} size={13} /> {roleMeta(r).short} {n}</span>
          ))}
          <Link to="/my-team" className="btn btn-ghost btn-sm">Full squad</Link>
        </div>
      </div>
      {data.squad.length ? (
        <div className="card-grid">
          {data.squad.slice(0, 4).map(p => <PlayerCard key={p.id} player={p} accent={f.color} price={p.purchase_price} />)}
        </div>
      ) : <EmptyState icon={<Users size={26} />} title="No players yet" action={<Link to="/auction" className="btn btn-primary">Go to the bid room</Link>}>Win bids in the live auction to build your squad of up to 12.</EmptyState>}

      <section className="panel">
        <h2>Recent bids</h2>
        {data.recentBids.length ? (
          <ul className="simple-list">
            {data.recentBids.map((b, i) => (
              <li key={i}><span>{b.player_name}{b.country ? ` (${b.country})` : ''}</span><b>{formatINR(b.bid_amount)}</b><span className={`status-tag st-${b.status.toLowerCase()}`}>{b.status}</span></li>
            ))}
          </ul>
        ) : <p className="muted">You haven't bid yet.</p>}
      </section>
    </div>
  )
}

function AdminOverview() {
  const { data, error, loading, reload } = useAsync(() => Promise.all([api.getAdminStats(), api.getFranchises()]).then(([s, f]) => ({ s, f: f.franchises })), [])
  const socket = useAuctionSocket()
  const { state, emit } = socket

  if (loading && !data) return <Loader full />
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  const { s, f } = data
  const isEnded = state.status === 'Ended'
  const showRankings = Boolean(state.showLiveRankings)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
            <h1>Auction overview</h1>
            <span className={`status-pill status-${state.status.toLowerCase()}`}>
              {state.status === 'Live' && <i className="live-dot" aria-hidden="true" />}
              {state.status}
            </span>
          </div>
          <p className="muted">{s.soldPlayers} of {s.totalPlayers} players sold · {s.franchises} franchises</p>
        </div>
        <div className="head-actions">
          <button
            className={`btn ${showRankings ? 'btn-success' : 'btn-ghost'}`}
            onClick={() => emit('admin:toggleRankings', { enabled: !showRankings })}
            title="Toggle whether non-admin users can see Live Rankings"
          >
            {showRankings ? <Eye size={16} /> : <EyeOff size={16} />}
            Live Rankings: {showRankings ? 'ON' : 'OFF'}
          </button>
          <button className="btn btn-success" onClick={() => emit('admin:startAuction')}>
            <Play size={16} /> Start Auction
          </button>
          <button className="btn btn-danger" onClick={() => emit('admin:endAuction')} disabled={isEnded}>
            <Square size={16} /> End Auction
          </button>
          <Link to="/admin/control" className="btn btn-primary"><SlidersHorizontal size={16} /> Control center</Link>
          <Link to="/live" target="_blank" className="btn btn-ghost"><Radio size={16} /> Live screen</Link>
        </div>
      </div>
      <StatGrid size="lg" items={[
        { label: 'Available', value: s.availablePlayers }, { label: 'Sold', value: s.soldPlayers, emphasis: true },
        { label: 'Unsold', value: s.unsoldPlayers }, { label: 'Total spent', value: formatShort(s.totalSpent) },
        { label: 'Highest sale', value: s.highestSale ? formatShort(s.highestSale) : '—' }, { label: 'Purse remaining', value: formatShort(s.totalRemaining) },
      ]} />
      <section className="panel">
        <div className="section-head"><h2>Franchises</h2><Link to="/admin" className="btn btn-ghost btn-sm">Manage</Link></div>
        {f.length ? (
          <table className="table">
            <thead><tr><th>Team</th><th>Owner</th><th className="num-col">Purse</th><th className="num-col">Spent</th><th className="num-col">Squad</th></tr></thead>
            <tbody>{f.map(t => (
              <tr key={t.id}><td><span className="team-cell"><TeamMark team={t} size={28} /> {t.team_name}</span></td><td>{t.owner_name}</td>
                <td className="num-col">{formatShort(t.remaining_purse)}</td><td className="num-col">{formatShort(t.total_spent)}</td><td className="num-col">{t.squad_count}/{t.max_squad_size}</td></tr>
            ))}</tbody>
          </table>
        ) : <EmptyState title="No franchises yet" action={<Link to="/admin" className="btn btn-primary">Create a franchise</Link>} />}
      </section>
    </div>
  )
}

function PlayerHome() {
  const { data, error, loading, reload } = useAsync(() => api.getDashboard(), [])
  const [edit, setEdit] = useState(false)
  const [price, setPrice] = useState('')
  const [msg, setMsg] = useState('')
  if (loading && !data) return <Loader full />
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  const p = data.player
  if (!p) return <div className="page"><EmptyState title="Profile pending">The admin hasn't linked your player profile yet.</EmptyState></div>

  async function save() {
    try { await api.updatePlayerProfile({ base_price: Number(price) }); setEdit(false); setMsg('Base price updated.'); reload() }
    catch (e) { setMsg(e.message) }
  }

  return (
    <div className="page">
      <section className="panel player-home">
        <Initials initials={p.initials} size="xl" accent={p.team?.color} />
        <div>
          <h1>{p.name} {p.country && <span className="country-badge">({p.country})</span>}</h1>
          <p className="role-inline"><RoleIcon role={p.playing_role} size={16} /> {roleMeta(p.playing_role).label} · <span className={`status-tag st-${p.status.replace(' ', '-').toLowerCase()}`}>{p.status}</span></p>
        </div>
        <RankBadge rank={p.current_rank} size="lg" />
      </section>
      <StatGrid items={keyStatsFor(p)} />
      <section className="panel">
        <h2>Auction</h2>
        {p.team ? (
          <p className="team-cell"><TeamMark team={p.team} size={36} /> Sold to <b>{p.team.team_name}</b> for <b className="gold">{formatINR(p.sold_price)}</b></p>
        ) : (
          <div className="base-edit">
            <span>Base price <b>{formatINR(p.base_price)}</b> <small className="muted">({p.base_price_updates_count}/2 changes used)</small></span>
            {edit ? (
              <span className="inline-form">
                <input type="number" min="1000" max="5000000" value={price} onChange={e => setPrice(e.target.value)} />
                <button className="icon-btn" onClick={save} aria-label="Save"><Check size={16} /></button>
                <button className="icon-btn" onClick={() => setEdit(false)} aria-label="Cancel"><X size={16} /></button>
              </span>
            ) : p.status === 'Available' && p.base_price_updates_count < 2 && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setPrice(p.base_price); setEdit(true) }}><Pencil size={14} /> Change</button>
            )}
          </div>
        )}
        {msg && <p className="muted">{msg}</p>}
        <Link to={`/players/${p.id}`} className="btn btn-ghost btn-sm">View public profile</Link>
      </section>
    </div>
  )
}
