import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Field } from './FranchiseForm'
import { api } from '../../services/api'
import { oversFromBalls } from '../../lib/format'

const ROLES = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper']
const NUM = [
  ['Batting', [['matches', 'Matches'], ['innings', 'Innings'], ['not_outs', 'Not outs'], ['runs', 'Runs'], ['balls_faced', 'Balls faced'], ['fifties', '50s'], ['hundreds', '100s']]],
  ['Bowling', [['balls_bowled', 'Balls bowled'], ['runs_conceded', 'Runs conceded'], ['wickets', 'Wickets'], ['three_wkt_hauls', '3-wkt hauls'], ['four_wkt_hauls', '4-wkt hauls'], ['five_wkt_hauls', '5-wkt hauls']]],
  ['Fielding & impact', [['catches', 'Catches'], ['stumpings', 'Stumpings'], ['run_outs', 'Run outs'], ['player_of_match', 'Player of match'], ['form_points', 'Form rating (0–100)']]],
]
const NUM_KEYS = NUM.flatMap(([, f]) => f.map(([k]) => k))

export const EMPTY_PLAYER = {
  name: '', enrollment_number: '', playing_role: 'Batsman', batting_style: '', bowling_style: '', course: '', year: '',
  base_price: 500000, auction_order: '', highest_score: '', best_bowling: '', country: '', is_uncapped: false,
  ...Object.fromEntries(NUM_KEYS.map(k => [k, 0])),
}

/** Admin player editor. Averages, strike rates, economy and ranks are computed by the server. */
export default function PlayerEditor({ player, onSaved, onCancel, notify }) {
  const editing = Boolean(player && player.id)
  const [form, setForm] = useState(() => {
    const base = { ...EMPTY_PLAYER }
    if (player) for (const k of Object.keys(base)) if (player[k] !== undefined && player[k] !== null) base[k] = player[k]
    return base
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const payload = { ...form }
    for (const k of NUM_KEYS) payload[k] = payload[k] === '' ? 0 : Number(payload[k])
    payload.base_price = Number(payload.base_price)
    payload.auction_order = payload.auction_order === '' ? null : Number(payload.auction_order)
    try {
      if (editing) await api.updatePlayer(player.id, payload)
      else await api.addPlayer(payload)
      notify(editing ? 'Player updated. Rankings recalculated.' : 'Player added. Rankings recalculated.', 'success')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-row">
        <Field label="Player name"><input value={form.name} onChange={set('name')} required /></Field>
        <Field label="Player ID / enrollment no." hint="Internal — not shown publicly"><input value={form.enrollment_number} onChange={set('enrollment_number')} required /></Field>
      </div>
      <div className="form-row form-row-3">
        <Field label="Role">
          <select value={form.playing_role} onChange={set('playing_role')}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
        </Field>
        <Field label="Base price (₹)"><input type="number" min="1000" step="1000" value={form.base_price} onChange={set('base_price')} required /></Field>
        <Field label="Auction order" hint="Blank = end of queue"><input type="number" min="0" value={form.auction_order ?? ''} onChange={set('auction_order')} /></Field>
      </div>
      <div className="form-row form-row-4">
        <Field label="Batting style"><input value={form.batting_style || ''} onChange={set('batting_style')} placeholder="Right-hand bat" /></Field>
        <Field label="Bowling style"><input value={form.bowling_style || ''} onChange={set('bowling_style')} placeholder="Right-arm fast" /></Field>
        <Field label="Country"><input value={form.country || ''} onChange={set('country')} placeholder="India" /></Field>
        <Field label="Course / year"><div className="split"><input value={form.course || ''} onChange={set('course')} placeholder="BCA" /><input value={form.year || ''} onChange={set('year')} placeholder="3rd" /></div></Field>
      </div>

      {NUM.map(([group, fields]) => (
        <fieldset key={group} className="stat-fields">
          <legend>{group}</legend>
          <div className="stat-inputs">
            {fields.map(([k, label]) => (
              <Field key={k} label={label}><input type="number" min="0" max={k === 'form_points' ? 100 : undefined} value={form[k]} onChange={set(k)} /></Field>
            ))}
            {group === 'Batting' && <Field label="Highest score"><input value={form.highest_score || ''} onChange={set('highest_score')} placeholder="92*" maxLength={10} /></Field>}
            {group === 'Bowling' && <Field label="Best bowling"><input value={form.best_bowling || ''} onChange={set('best_bowling')} placeholder="4/18" maxLength={10} /></Field>}
          </div>
        </fieldset>
      ))}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save player' : 'Add player'}</button>
      </div>
    </form>
  )
}

/** Per-match log for the profile's match history. */
export function MatchLog({ player, matches, onChange, notify }) {
  const blank = { match_label: '', match_date: '', runs: 0, balls_faced: 0, wickets: 0, balls_bowled: 0, runs_conceded: 0, catches: 0, stumpings: 0 }
  const [m, setM] = useState(blank)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setM(x => ({ ...x, [k]: e.target.value }))

  async function add(e) {
    e.preventDefault()
    setBusy(true)
    try { await api.addPlayerMatch(player.id, m); setM(blank); notify('Match added', 'success'); onChange() }
    catch (err) { notify(err.message, 'danger') }
    finally { setBusy(false) }
  }
  async function remove(id) {
    try { await api.deletePlayerMatch(player.id, id); onChange() } catch (err) { notify(err.message, 'danger') }
  }

  return (
    <div className="matchlog">
      <table className="table table-compact">
        <thead><tr><th>Match</th><th>Date</th><th className="num-col">R (B)</th><th className="num-col">W–R (O)</th><th className="num-col">Ct/St</th><th /></tr></thead>
        <tbody>
          {matches.map(x => (
            <tr key={x.id}>
              <td>{x.match_label}</td><td>{x.match_date ? String(x.match_date).slice(0, 10) : '—'}</td>
              <td className="num-col">{x.runs} ({x.balls_faced})</td>
              <td className="num-col">{x.wickets}–{x.runs_conceded} ({oversFromBalls(x.balls_bowled)})</td>
              <td className="num-col">{x.catches}/{x.stumpings}</td>
              <td><button className="icon-btn" onClick={() => remove(x.id)} aria-label="Remove match"><Trash2 size={14} /></button></td>
            </tr>
          ))}
          {!matches.length && <tr><td colSpan={6} className="muted">No matches logged yet.</td></tr>}
        </tbody>
      </table>
      <form className="matchlog-add" onSubmit={add}>
        <input value={m.match_label} onChange={set('match_label')} placeholder="vs BBA XI" required />
        <input type="date" value={m.match_date} onChange={set('match_date')} />
        {['runs', 'balls_faced', 'wickets', 'balls_bowled', 'runs_conceded', 'catches', 'stumpings'].map(k => (
          <input key={k} type="number" min="0" value={m[k]} onChange={set(k)} title={k.replace('_', ' ')} aria-label={k.replace('_', ' ')} placeholder={k} />
        ))}
        <button className="btn btn-ghost btn-sm" disabled={busy}><Plus size={14} /> Add</button>
      </form>
      <p className="field-hint">Columns: runs, balls, wickets, balls bowled, runs conceded, catches, stumpings. Career totals above drive the ranking.</p>
    </div>
  )
}
