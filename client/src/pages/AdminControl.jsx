import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, Pause, SkipForward, CheckCircle2, XCircle, RotateCcw, Radio, Wifi, WifiOff, Search, Square, Eye, EyeOff } from 'lucide-react'
import ToastContainer from '../components/Toast'
import { ConfirmDialog } from '../components/Modal'
import FranchiseModal from '../components/FranchiseModal'
import { useToast } from '../hooks/useToast'
import { useAuctionSocket } from '../hooks/useAuctionSocket'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import Initials from '../components/Initials'
import RoleIcon from '../components/RoleIcon'
import RankBadge from '../components/RankBadge'
import TeamMark from '../components/TeamMark'
import TimerRing from '../components/live/TimerRing'
import BidFeed from '../components/live/BidFeed'
import AnimatedNumber from '../components/AnimatedNumber'
import { formatINR, formatShort, pad2, roleMeta } from '../lib/format'

/** Auction Control Center — the auctioneer's console. */
export default function AdminControl() {
  const { toasts, addToast, removeToast } = useToast()
  const players = useAsync(() => api.getAdminPlayers(), [])
  const reloadPlayers = players.reload
  const onPlayersChanged = useCallback(() => { reloadPlayers() }, [reloadPlayers])
  const socket = useAuctionSocket({ onNotify: addToast, onPlayersChanged })
  const { state, teams, connection, emit, stats } = socket
  const [confirm, setConfirm] = useState(null)
  const [query, setQuery] = useState('')
  const [selectedFranchiseId, setSelectedFranchiseId] = useState(null)

  const all = players.data ? players.data.players : []
  const queue = useMemo(() => all.filter(p => p.status === 'Available')
    .filter(p => !query || p.name.toLowerCase().includes(query.toLowerCase())), [all, query])
  const unsold = all.filter(p => p.status === 'Unsold')
  const open = ['Live', 'Paused'].includes(state.status)
  const p = state.player
  const showRankings = Boolean(state.showLiveRankings)

  function ask(action) {
    const name = p ? p.name : ''
    const map = {
      sell: {
        title: 'Sell this player?',
        message: `${name} will be sold to ${state.highestBidder?.team_name} for ${formatINR(state.currentBid)}. The purse is deducted immediately.`,
        confirmLabel: 'Sell player', tone: 'success', run: () => emit('admin:sellPlayer'),
      },
      unsold: {
        title: 'Mark as unsold?',
        message: state.highestBidder
          ? `${name} has a bid of ${formatINR(state.currentBid)} from ${state.highestBidder.team_name}. Marking unsold discards it.`
          : `${name} will be marked unsold. You can re-auction them later.`,
        confirmLabel: 'Mark unsold', tone: 'danger', run: () => emit('admin:markUnsold'),
      },
    }
    setConfirm(map[action])
  }

  return (
    <div className="page page-wide control">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDialog open={Boolean(confirm)} {...(confirm || {})}
        onCancel={() => setConfirm(null)} onConfirm={() => { confirm.run(); setConfirm(null) }} />

      <div className="page-head">
        <div>
          <h1>Auction control center</h1>
          <p className="muted">Everything you do here is broadcast instantly to the live screen and every franchise.</p>
        </div>
        <div className="head-actions">
          <button
            className={`btn btn-sm ${showRankings ? 'btn-success' : 'btn-ghost'}`}
            onClick={() => emit('admin:toggleRankings', { enabled: !showRankings })}
            title="Toggle whether non-admin users can see Live Rankings"
          >
            {showRankings ? <Eye size={15} /> : <EyeOff size={15} />}
            Live Rankings: {showRankings ? 'ON' : 'OFF'}
          </button>
          <button className="btn btn-success btn-sm" onClick={() => emit('admin:startAuction')}><Play size={15} /> Start Auction</button>
          <button className="btn btn-danger btn-sm" onClick={() => emit('admin:endAuction')} disabled={state.status === 'Ended'}><Square size={15} /> End Auction</button>
          <span className={`conn conn-${connection}`}>{connection === 'online' ? <Wifi size={15} /> : <WifiOff size={15} />} {connection === 'online' ? 'Connected' : 'Reconnecting'}</span>
          <span className="chip">{stats.bidders || 0} franchises online</span>
          <Link to="/live" target="_blank" className="btn btn-ghost btn-sm"><Radio size={15} /> Open live screen</Link>
        </div>
      </div>

      <div className="control-grid">
        <section className="panel control-lot">
          <div className="panel-head">
            <h2>On the block</h2>
            <span className={`status-pill status-${state.status.toLowerCase()}`}>
              {state.status === 'Live' && <i className="live-dot" />}{state.status}
            </span>
          </div>

          {p ? (
            <div className="lot-card">
              <div className="lot-id">
                <Initials initials={p.initials} size="xl" accent={state.highestBidder?.color} />
                <div>
                  <p className="muted">Player #{pad2(state.lot?.position)} of {state.lot?.total}</p>
                  <h3 className="lot-name">{p.name}</h3>
                  <p className="lot-role"><RoleIcon role={p.playing_role} size={16} /> {roleMeta(p.playing_role).label}</p>
                </div>
                <RankBadge rank={p.current_rank} />
              </div>

              <div className="lot-numbers">
                <div><small>Base price</small><b>{formatINR(p.base_price)}</b></div>
                <div className="lot-current"><small>Current bid</small><b><AnimatedNumber value={state.currentBid} format={formatINR} /></b></div>
                <div><small>Next bid</small><b>{state.status === 'Completed' ? '—' : formatINR(state.nextBid)}</b></div>
                <div><small>Bids</small><b>{state.bidCount}</b></div>
              </div>

              <div className="lot-bidder">
                {state.highestBidder ? (
                  <><TeamMark team={state.highestBidder} size={36} /><span>Leading: <b>{state.highestBidder.team_name}</b></span></>
                ) : <span className="muted">No bids yet</span>}
                <TimerRing timeLeft={state.timeLeft} total={state.timerTotal} status={state.status} size="sm" />
              </div>
            </div>
          ) : (
            <p className="muted lot-empty">No player on the block. Start the next player from the queue.</p>
          )}

          <div className="control-buttons">
            <button className="btn btn-primary btn-lg" onClick={() => emit('admin:nextPlayer')} disabled={open || !queue.length}>
              <SkipForward size={18} /> Next player
            </button>
            {state.status === 'Live' && <button className="btn btn-ghost btn-lg" onClick={() => emit('admin:pauseAuction')}><Pause size={18} /> Pause</button>}
            {state.status === 'Paused' && <button className="btn btn-ghost btn-lg" onClick={() => emit('admin:resumeAuction')}><Play size={18} /> Resume</button>}
            <button className="btn btn-success btn-lg" onClick={() => ask('sell')} disabled={!open || !state.highestBidder}>
              <CheckCircle2 size={18} /> Sell
            </button>
            <button className="btn btn-danger btn-lg" onClick={() => ask('unsold')} disabled={!open}>
              <XCircle size={18} /> Unsold
            </button>
          </div>
          <BidFeed bids={state.bidHistory} limit={5} />
        </section>

        <section className="panel control-queue">
          <div className="panel-head">
            <h2>Player queue <span className="count">{queue.length}</span></h2>
            <label className="search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a player" /></label>
          </div>
          <ul className="queue-list">
            {queue.map(q => (
              <li key={q.id}>
                <span className="queue-no">{pad2(q.auction_order)}</span>
                <Initials initials={q.initials} size="sm" />
                <div className="queue-text">
                  <b>{q.name}</b>
                  <small><RoleIcon role={q.playing_role} size={13} /> {roleMeta(q.playing_role).short} · {formatShort(q.base_price)} · {q.current_rank ? `#${q.current_rank}` : 'NR'}</small>
                </div>
                <button className="btn btn-ghost btn-sm" disabled={open} onClick={() => emit('admin:startPlayer', { playerId: q.id })}><Play size={14} /> Start</button>
              </li>
            ))}
            {!queue.length && <li className="muted queue-empty">{players.loading ? 'Loading players…' : 'No Available players.'}</li>}
          </ul>

          {unsold.length > 0 && (
            <>
              <h3 className="sub-head">Unsold <span className="count">{unsold.length}</span></h3>
              <ul className="queue-list">
                {unsold.map(u => (
                  <li key={u.id}>
                    <Initials initials={u.initials} size="sm" />
                    <div className="queue-text"><b>{u.name}</b><small>{roleMeta(u.playing_role).label}</small></div>
                    <button className="btn btn-ghost btn-sm" onClick={() => emit('admin:reAuction', { playerId: u.id })}><RotateCcw size={14} /> Re-auction</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel control-teams">
          <div className="panel-head"><h2>Team purses</h2></div>
          <table className="table">
            <thead><tr><th>Team</th><th className="num-col">Purse</th><th className="num-col">Spent</th><th className="num-col">Squad</th></tr></thead>
            <tbody>
              {teams.map(t => (
                <tr key={t.id} className={state.highestBidder?.id === t.id ? 'row-lead' : ''} style={{ cursor: 'pointer' }} onClick={() => setSelectedFranchiseId(t.id)} title="Click to view full franchise profile">
                  <td><span className="team-cell"><TeamMark team={t} size={28} /> {t.team_name}{t.status === 'disabled' && <em className="chip chip-muted">disabled</em>}</span></td>
                  <td className="num-col">{formatShort(t.remaining_purse)}</td>
                  <td className="num-col">{formatShort(t.total_spent)}</td>
                  <td className={`num-col${t.squad_count >= t.max_squad_size ? ' text-danger' : ''}`}>{t.squad_count}/{t.max_squad_size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <FranchiseModal franchiseId={selectedFranchiseId} onClose={() => setSelectedFranchiseId(null)} />
    </div>
  )
}
