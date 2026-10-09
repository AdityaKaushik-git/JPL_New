import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, Pause, SkipForward, CheckCircle2, XCircle, RotateCcw, Radio, Wifi, WifiOff, Search, Square, Eye, EyeOff } from 'lucide-react'
import ToastContainer from '../components/Toast'
import Modal, { ConfirmDialog } from '../components/Modal'
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
  const [roleFilter, setRoleFilter] = useState('All')
  const [catFilter, setCatFilter] = useState('All')
  const [sortBy, setSortBy] = useState('order')
  const [selectedFranchiseId, setSelectedFranchiseId] = useState(null)

  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otpInput, setOtpInput] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpEmail, setOtpEmail] = useState('')

  async function handleStartAuctionClick() {
    setOtpLoading(true)
    setOtpError('')
    try {
      const res = await api.requestStartOtp()
      setOtpEmail(res.email || 'adityakaushik1200@gmail.com')
      setOtpInput(res.devOtp || '')
      setShowOtpModal(true)
      if (res.devOtp) {
        addToast(`OTP generated: ${res.devOtp} (Sent to ${res.email})`, 'info')
      } else {
        addToast(`OTP code sent to ${res.email || 'adityakaushik1200@gmail.com'}`, 'info')
      }
    } catch (err) {
      addToast(err.message || 'Failed to send OTP', 'danger')
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleVerifyOtpSubmit(e) {
    if (e) e.preventDefault()
    if (!otpInput.trim() || otpInput.trim().length !== 6) {
      setOtpError('Please enter the 6-digit OTP code.')
      return
    }
    setOtpLoading(true)
    setOtpError('')
    try {
      const res = await api.verifyStartOtp(otpInput.trim())
      addToast(res.message || 'Auction started and reset successfully!', 'success')
      setShowOtpModal(false)
      setOtpInput('')
      reloadPlayers()
      emit('user:join')
    } catch (err) {
      setOtpError(err.message || 'Invalid OTP code')
    } finally {
      setOtpLoading(false)
    }
  }

  const all = players.data ? players.data.players : []
  const queue = useMemo(() => {
    let list = all.filter(p => p.status === 'Available')
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.player_code && p.player_code.toLowerCase().includes(q)) ||
        (p.country && p.country.toLowerCase().includes(q)) ||
        (p.enrollment_number && p.enrollment_number.toLowerCase().includes(q))
      )
    }
    if (roleFilter !== 'All') {
      list = list.filter(p => p.playing_role === roleFilter)
    }
    if (catFilter === 'Overseas') {
      list = list.filter(p => p.country && p.country.trim().toLowerCase() !== 'india')
    } else if (catFilter === 'Uncapped') {
      list = list.filter(p => Boolean(p.is_uncapped))
    }
    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'price') {
      list.sort((a, b) => b.base_price - a.base_price)
    } else if (sortBy === 'rank') {
      list.sort((a, b) => (a.current_rank || 999) - (b.current_rank || 999))
    } else {
      list.sort((a, b) => (a.auction_order ?? a.id) - (b.auction_order ?? b.id))
    }
    return list
  }, [all, query, roleFilter, catFilter, sortBy])
  const unsold = all.filter(p => p.status === 'Unsold')
  const p = state.player
  const hasActiveLot = Boolean(p && state.auctionId && ['Live', 'Paused'].includes(state.status))
  const open = hasActiveLot
  const hasBidsOnCurrentLot = Boolean(hasActiveLot && state.highestBidder && state.highestBidder.id)
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
          <button className="btn btn-success btn-sm" onClick={handleStartAuctionClick} disabled={otpLoading}><Play size={15} /> {otpLoading ? 'Sending OTP…' : 'Start Auction'}</button>
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
                  <h3 className="lot-name">{p.name} {p.country && <span className="country-badge">({p.country})</span>}</h3>
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
            <button className="btn btn-primary btn-lg" onClick={() => emit('admin:nextPlayer')} disabled={!queue.length || hasBidsOnCurrentLot}>
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
          <div className="panel-head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
              <h2>Player queue <span className="count">{queue.length}</span></h2>
              <label className="search" style={{ flex: 1, minWidth: '160px', maxWidth: '240px' }}>
                <Search size={15} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name/country/code" />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="select-sm" title="Filter by role">
                <option value="All">All Roles</option>
                <option value="Batsman">Batsmen</option>
                <option value="Bowler">Bowlers</option>
                <option value="All-Rounder">All-Rounders</option>
                <option value="Wicket Keeper">Keepers</option>
              </select>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="select-sm" title="Filter by category">
                <option value="All">All Categories</option>
                <option value="Overseas">Overseas</option>
                <option value="Uncapped">Uncapped</option>
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="select-sm" title="Sort queue">
                <option value="order">Queue Order</option>
                <option value="name">Name (A-Z)</option>
                <option value="price">Base Price</option>
                <option value="rank">Rank</option>
              </select>
            </div>
          </div>
          <ul className="queue-list">
            {queue.map(q => (
              <li key={q.id}>
                <span className="queue-no">{pad2(q.auction_order)}</span>
                <Initials initials={q.initials} size="sm" />
                <div className="queue-text">
                  <b>{q.name} {q.country && <span className="country-badge">({q.country})</span>}</b>
                  <small><RoleIcon role={q.playing_role} size={13} /> {roleMeta(q.playing_role).short} · {formatShort(q.base_price)} · {q.current_rank ? `#${q.current_rank}` : 'NR'}</small>
                </div>
                <button className="btn btn-ghost btn-sm" disabled={hasBidsOnCurrentLot} onClick={() => emit('admin:startPlayer', { playerId: q.id })}><Play size={14} /> Start</button>
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
                    <div className="queue-text"><b>{u.name} {u.country && <span className="country-badge">({u.country})</span>}</b><small>{roleMeta(u.playing_role).label}</small></div>
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

      <Modal
        open={showOtpModal}
        title="🔒 Verify OTP to Start Auction"
        onClose={() => !otpLoading && setShowOtpModal(false)}
        width={480}
      >
        <form onSubmit={handleVerifyOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.5' }}>
            A 6-digit authorization OTP code has been sent to <b>{otpEmail || 'adityakaushik1200@gmail.com'}</b>.
            Verifying this code will release all sold/bidded players and reset all franchise balances back to starting purse for a fresh auction.
          </p>
          {otpError && (
            <div className="chip chip-danger" style={{ padding: '0.6rem 1rem', borderRadius: '6px', textAlign: 'center' }}>
              {otpError}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Enter 6-Digit Verification OTP</label>
            <input
              type="text"
              maxLength={6}
              value={otpInput}
              onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              style={{
                fontSize: '1.5rem',
                letterSpacing: '0.5rem',
                textAlign: 'center',
                padding: '0.6rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-color)',
              }}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowOtpModal(false)} disabled={otpLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-success" disabled={otpLoading || otpInput.length !== 6}>
              {otpLoading ? 'Verifying OTP…' : 'Verify & Start Auction'}
            </button>
          </div>
        </form>
      </Modal>

      <FranchiseModal franchiseId={selectedFranchiseId} onClose={() => setSelectedFranchiseId(null)} />
    </div>
  )
}
