import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, RotateCcw, Calculator, Search, KeyRound, Power, ListOrdered } from 'lucide-react'
import ToastContainer from '../components/Toast'
import Modal, { ConfirmDialog } from '../components/Modal'
import { Loader, ErrorState, EmptyState } from '../components/States'
import FranchiseForm from '../components/admin/FranchiseForm'
import PlayerEditor, { MatchLog } from '../components/admin/PlayerEditor'
import Initials from '../components/Initials'
import TeamMark from '../components/TeamMark'
import RoleIcon from '../components/RoleIcon'
import { useToast } from '../hooks/useToast'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { formatINR, formatShort, dateTime, roleMeta, pad2 } from '../lib/format'

const TABS = [
  { id: 'players', label: 'Players' },
  { id: 'franchises', label: 'Franchises' },
  { id: 'history', label: 'Auction history' },
]

export default function Admin() {
  const [tab, setTab] = useState('players')
  const { toasts, addToast, removeToast } = useToast()
  return (
    <div className="page page-wide">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="page-head">
        <div>
          <h1>Manage</h1>
          <p className="muted">Players, franchises and results. Live bidding is run from the control center.</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === 'players' && <PlayersTab notify={addToast} />}
      {tab === 'franchises' && <FranchisesTab notify={addToast} />}
      {tab === 'history' && <HistoryTab notify={addToast} />}
    </div>
  )
}

function PlayersTab({ notify }) {
  const { data, error, loading, reload } = useAsync(() => api.getAdminPlayers(), [])
  const [q, setQ] = useState('')
  const [role, setRole] = useState('All')
  const [editing, setEditing] = useState(null)
  const [matchesFor, setMatchesFor] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const players = useMemo(() => (data ? data.players : [])
    .filter(p => role === 'All' || p.playing_role === role)
    .filter(p => !q || `${p.name} ${p.enrollment_number} ${p.player_code}`.toLowerCase().includes(q.toLowerCase())), [data, q, role])

  async function recalc() {
    try { const r = await api.recalculateRankings(); notify(r.message, 'success'); reload() } catch (e) { notify(e.message, 'danger') }
  }

  async function runConfirm() {
    setBusy(true)
    try { await confirm.run(); setConfirm(null); reload() } catch (e) { notify(e.message, 'danger') } finally { setBusy(false) }
  }

  if (loading && !data) return <Loader />
  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <section className="panel">
      <div className="toolbar">
        <label className="search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or ID" /></label>
        <select value={role} onChange={e => setRole(e.target.value)} className="select-sm">
          <option>All</option><option>Batsman</option><option>Bowler</option><option>All-Rounder</option><option>Wicket Keeper</option>
        </select>
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={recalc}><Calculator size={15} /> Recalculate rankings</button>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={15} /> Add player</button>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr><th>#</th><th>Player</th><th>Role</th><th className="num-col">Base</th><th className="num-col">Rank</th><th className="num-col">Pts</th><th className="num-col">M</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id}>
                <td className="muted">{pad2(p.auction_order)}</td>
                <td><span className="player-cell"><Initials initials={p.initials} size="sm" /><span><b>{p.name}</b><small className="muted">{p.player_code} · {p.enrollment_number}</small></span></span></td>
                <td><span className="role-inline"><RoleIcon role={p.playing_role} size={15} /> {roleMeta(p.playing_role).short}</span></td>
                <td className="num-col">{formatShort(p.base_price)}</td>
                <td className="num-col">{p.current_rank ? `#${p.current_rank}` : 'NR'}</td>
                <td className="num-col">{p.ranking_points}</td>
                <td className="num-col">{p.matches}</td>
                <td><span className={`status-tag st-${p.status.replace(' ', '-').toLowerCase()}`}>{p.status}</span></td>
                <td className="row-actions">
                  <button className="icon-btn" title="Edit" onClick={() => setEditing(p)} disabled={p.status === 'In Auction'}><Pencil size={15} /></button>
                  <button className="icon-btn" title="Match log" onClick={() => setMatchesFor(p)}><ListOrdered size={15} /></button>
                  {(p.status === 'Sold' || p.status === 'Unsold') && (
                    <button className="icon-btn" title="Reset to Available" onClick={() => setConfirm({
                      title: 'Reset to Available?',
                      message: p.status === 'Sold'
                        ? `${p.name} will be removed from their team and the purchase price refunded to that franchise.`
                        : `${p.name} will return to the auction queue.`,
                      confirmLabel: 'Reset player', run: () => api.updatePlayerStatus(p.id, 'Available'),
                    })}><RotateCcw size={15} /></button>
                  )}
                  <button className="icon-btn icon-danger" title="Delete" disabled={p.status === 'In Auction'} onClick={() => setConfirm({
                    title: `Delete ${p.name}?`,
                    message: 'This removes the player, their bids and results permanently. Any purchase is refunded.',
                    confirmLabel: 'Delete player', run: () => api.deletePlayer(p.id),
                  })}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!players.length && <EmptyState title="No players match">Change the search or add a player.</EmptyState>}
      </div>

      <Modal open={Boolean(editing)} title={editing && editing.id ? `Edit ${editing.name}` : 'Add player'} onClose={() => setEditing(null)} width={860}>
        {editing && <PlayerEditor player={editing} notify={notify} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
      </Modal>

      <Modal open={Boolean(matchesFor)} title={matchesFor ? `Match log — ${matchesFor.name}` : ''} onClose={() => setMatchesFor(null)} width={860}>
        {matchesFor && <MatchLogLoader player={matchesFor} notify={notify} />}
      </Modal>

      <ConfirmDialog open={Boolean(confirm)} {...(confirm || {})} busy={busy} onCancel={() => setConfirm(null)} onConfirm={runConfirm} />
    </section>
  )
}

function MatchLogLoader({ player, notify }) {
  const { data, loading, reload } = useAsync(() => api.getPlayer(player.id), [player.id])
  if (loading && !data) return <Loader />
  return <MatchLog player={player} matches={data ? data.matches : []} onChange={reload} notify={notify} />
}

function FranchisesTab({ notify }) {
  const { data, error, loading, reload } = useAsync(() => api.getAdminFranchises(), [])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [pwFor, setPwFor] = useState(null)
  const [pw, setPw] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  async function create(payload) {
    setBusy(true); setErrors({})
    try {
      const r = await api.createFranchise(payload)
      notify(r.message, 'success'); setCreating(false); reload()
    } catch (e) { setErrors(e.errors || {}); notify(e.message, 'danger') } finally { setBusy(false) }
  }
  async function save(payload) {
    setBusy(true); setErrors({})
    try { await api.updateFranchise(editing.id, payload); notify('Franchise updated', 'success'); setEditing(null); reload() }
    catch (e) { setErrors(e.errors || {}); notify(e.message, 'danger') } finally { setBusy(false) }
  }
  async function toggle(f) {
    try { await api.setFranchiseStatus(f.id, f.status === 'active' ? 'disabled' : 'active'); reload() } catch (e) { notify(e.message, 'danger') }
  }
  async function resetPw(e) {
    e.preventDefault()
    try { await api.resetFranchisePassword(pwFor.id, pw); notify('Password updated', 'success'); setPwFor(null); setPw('') } catch (err) { notify(err.message, 'danger') }
  }

  if (loading && !data) return <Loader />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const list = data.franchises

  return (
    <section className="panel">
      <div className="toolbar">
        <p className="muted">Every franchise starts with {formatINR(180000000)} and room for 12 players. Owners bid; they don't play.</p>
        <span className="spacer" />
        <button className="btn btn-primary btn-sm" onClick={() => { setErrors({}); setCreating(true) }}><Plus size={15} /> Create franchise</button>
      </div>

      {list.length === 0 ? (
        <EmptyState title="No franchises yet" action={<button className="btn btn-primary" onClick={() => setCreating(true)}>Create the first franchise</button>}>
          Only you can create franchise accounts — there is no public sign-up.
        </EmptyState>
      ) : (
        <div className="franchise-grid">
          {list.map(f => (
            <article key={f.id} className={`franchise-card${f.status === 'disabled' ? ' is-disabled' : ''}`} style={{ '--team': f.color }}>
              <header>
                <TeamMark team={f} size={52} />
                <div><h3>{f.team_name}</h3><p className="muted">{f.owner_name} · {f.login_id}</p></div>
              </header>
              <dl className="franchise-nums">
                <div><dt>Remaining</dt><dd>{formatShort(f.remaining_purse)}</dd></div>
                <div><dt>Spent</dt><dd>{formatShort(f.total_spent)}</dd></div>
                <div><dt>Squad</dt><dd>{f.squad_count} / {f.max_squad_size}</dd></div>
              </dl>
              <div className="purse-bar"><i style={{ width: `${Math.min(100, (f.total_spent / f.starting_purse) * 100)}%` }} /></div>
              <footer>
                <button className="btn btn-ghost btn-sm" onClick={() => { setErrors({}); setEditing(f) }}><Pencil size={14} /> Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setPwFor(f)}><KeyRound size={14} /> Password</button>
                <button className={`btn btn-sm ${f.status === 'active' ? 'btn-ghost' : 'btn-success'}`} onClick={() => toggle(f)}><Power size={14} /> {f.status === 'active' ? 'Disable' : 'Enable'}</button>
              </footer>
            </article>
          ))}
        </div>
      )}

      <Modal open={creating} title="Create franchise" onClose={() => setCreating(false)} width={680}>
        {creating && <FranchiseForm errors={errors} busy={busy} onSubmit={create} onCancel={() => setCreating(false)} />}
      </Modal>
      <Modal open={Boolean(editing)} title={editing ? `Edit ${editing.team_name}` : ''} onClose={() => setEditing(null)} width={680}>
        {editing && (
          <FranchiseForm mode="edit" errors={errors} busy={busy} onSubmit={save} onCancel={() => setEditing(null)}
            initial={{ team_name: editing.team_name, short_name: editing.short_name, owner_name: editing.owner_name, color: editing.color, logo_url: editing.logo_url }} />
        )}
      </Modal>
      <Modal open={Boolean(pwFor)} title={pwFor ? `New password for ${pwFor.team_name}` : ''} onClose={() => setPwFor(null)} width={440}>
        <form className="form" onSubmit={resetPw}>
          <label className="field"><span className="field-label">New password</span>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" required />
            <span className="field-hint">8+ characters with upper, lower, number and symbol.</span></label>
          <div className="form-actions"><button className="btn btn-primary">Update password</button></div>
        </form>
      </Modal>
    </section>
  )
}

function HistoryTab({ notify }) {
  const { data, error, loading, reload } = useAsync(() => api.getAuctionHistory(), [])
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try { const r = await api.deleteAuctionHistory(confirm.id); notify(r.message, 'success'); setConfirm(null); reload() }
    catch (e) { notify(e.message, 'danger') } finally { setBusy(false) }
  }

  if (loading && !data) return <Loader />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const rows = data.history

  return (
    <section className="panel">
      {rows.length === 0 ? <EmptyState title="No results yet">SOLD and UNSOLD results appear here as the auction runs.</EmptyState> : (
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Player</th><th>Result</th><th>Team</th><th className="num-col">Price</th><th>When</th><th /></tr></thead>
            <tbody>
              {rows.map(h => (
                <tr key={h.id}>
                  <td><b>{h.player_name}</b> <small className="muted">{roleMeta(h.playing_role).short}</small></td>
                  <td><span className={`status-tag st-${h.status.toLowerCase()}`}>{h.status}</span></td>
                  <td>{h.winner_name || '—'}</td>
                  <td className="num-col">{h.winning_bid ? formatINR(h.winning_bid) : '—'}</td>
                  <td className="muted">{dateTime(h.completed_at)}</td>
                  <td><button className="icon-btn icon-danger" title="Undo result" onClick={() => setConfirm(h)}><RotateCcw size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog open={Boolean(confirm)} busy={busy} title="Undo this result?" confirmLabel="Undo result"
        message={confirm ? (confirm.status === 'Sold'
          ? `${confirm.player_name} returns to the queue and ${formatINR(confirm.winning_bid)} is refunded to ${confirm.winner_name}.`
          : `${confirm.player_name} returns to the queue.`) : ''}
        onCancel={() => setConfirm(null)} onConfirm={run} />
    </section>
  )
}
