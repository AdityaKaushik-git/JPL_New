import { useState } from 'react'
import { Upload, Trash2 } from 'lucide-react'
import TeamMark from '../TeamMark'
import { formatINR } from '../../lib/format'

const PWD_RULES = [
  { label: '8+ characters', test: p => p.length >= 8 },
  { label: 'Uppercase', test: p => /[A-Z]/.test(p) },
  { label: 'Lowercase', test: p => /[a-z]/.test(p) },
  { label: 'Number', test: p => /[0-9]/.test(p) },
  { label: 'Symbol', test: p => /[^A-Za-z0-9]/.test(p) },
]
const MAX_LOGO_BYTES = 280 * 1024

export const EMPTY_FRANCHISE = { team_name: '', short_name: '', owner_name: '', login_id: '', password: '', color: '#C8102E', logo: '' }

/**
 * Admin franchise form. There is deliberately no purse or squad field:
 * the server assigns ₹18,00,00,000 and 12 players to every new franchise.
 */
export default function FranchiseForm({ initial = EMPTY_FRANCHISE, mode = 'create', errors = {}, busy, onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_FRANCHISE, ...initial })
  const [localErr, setLocalErr] = useState({})
  const [removeLogo, setRemoveLogo] = useState(false)
  const err = { ...errors, ...localErr }
  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: k === 'short_name' ? e.target.value.toUpperCase() : e.target.value })); setLocalErr(x => ({ ...x, [k]: '' })) }

  function pickLogo(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setLocalErr(x => ({ ...x, logo: 'Use a PNG, JPG, WEBP or SVG file.' })); return
    }
    if (file.size > MAX_LOGO_BYTES) { setLocalErr(x => ({ ...x, logo: 'Logo must be smaller than 280 KB.' })); return }
    const reader = new FileReader()
    reader.onload = () => { setForm(f => ({ ...f, logo: reader.result })); setRemoveLogo(false); setLocalErr(x => ({ ...x, logo: '' })) }
    reader.readAsDataURL(file)
  }

  function submit(e) {
    e.preventDefault()
    const v = {}
    if (form.team_name.trim().length < 2) v.team_name = 'Enter the team name.'
    if (!/^[A-Z0-9]{2,6}$/.test(form.short_name)) v.short_name = '2–6 letters or digits.'
    if (form.owner_name.trim().length < 2) v.owner_name = "Enter the owner's name."
    if (mode === 'create') {
      if (!/^[A-Za-z0-9@._-]{3,50}$/.test(form.login_id)) v.login_id = '3–50 characters: letters, digits, @ . _ -'
      if (PWD_RULES.some(r => !r.test(form.password))) v.password = 'Password does not meet every rule.'
    }
    setLocalErr(v)
    if (Object.keys(v).length) return
    const payload = { team_name: form.team_name, short_name: form.short_name, owner_name: form.owner_name, color: form.color }
    if (mode === 'create') { payload.login_id = form.login_id; payload.password = form.password }
    if (form.logo && form.logo.startsWith('data:')) payload.logo = form.logo
    if (removeLogo) payload.remove_logo = true
    onSubmit(payload)
  }

  const preview = { short_name: form.short_name || 'JPL', color: form.color, logo_url: removeLogo ? null : (form.logo || initial.logo_url) }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form-preview" style={{ '--team': form.color }}>
        <TeamMark team={preview} size={64} />
        <div>
          <b>{form.team_name || 'Team name'}</b>
          <small>{form.owner_name ? `Owner: ${form.owner_name}` : 'Owner name'}</small>
        </div>
      </div>

      <div className="form-row">
        <Field label="Team name" error={err.team_name}><input value={form.team_name} onChange={set('team_name')} placeholder="JCC Titans" /></Field>
        <Field label="Short name" error={err.short_name} hint="Shown on the live team strip"><input value={form.short_name} onChange={set('short_name')} maxLength={6} placeholder="TIT" /></Field>
      </div>
      <Field label="Owner name" error={err.owner_name} hint="The team owner — owners do not play"><input value={form.owner_name} onChange={set('owner_name')} placeholder="Arjun Mehra" /></Field>

      {mode === 'create' && (
        <div className="form-row">
          <Field label="Login ID or email" error={err.login_id}><input value={form.login_id} onChange={set('login_id')} autoComplete="off" placeholder="titans@jpl.com" /></Field>
          <Field label="Password" error={err.password}>
            <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
            <span className="pwd-rules">
              {PWD_RULES.map(r => <em key={r.label} className={r.test(form.password) ? 'ok' : ''}>{r.label}</em>)}
            </span>
          </Field>
        </div>
      )}

      <div className="form-row">
        <Field label="Team colour"><div className="color-field"><input type="color" value={form.color} onChange={set('color')} /><code>{form.color.toUpperCase()}</code></div></Field>
        <Field label="Team logo" error={err.logo} hint="PNG, JPG, WEBP or SVG · max 280 KB">
          <div className="logo-field">
            <label className="btn btn-ghost btn-sm"><Upload size={14} /> Choose file<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={pickLogo} hidden /></label>
            {(form.logo || initial.logo_url) && !removeLogo && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setForm(f => ({ ...f, logo: '' })); setRemoveLogo(Boolean(initial.logo_url)) }}><Trash2 size={14} /> Remove</button>
            )}
          </div>
        </Field>
      </div>

      {mode === 'create' && (
        <div className="assigned">
          <p>Assigned automatically by the server</p>
          <dl>
            <div><dt>Starting purse</dt><dd>{formatINR(180000000)}</dd></div>
            <div><dt>Remaining</dt><dd>{formatINR(180000000)}</dd></div>
            <div><dt>Spent</dt><dd>{formatINR(0)}</dd></div>
            <div><dt>Squad</dt><dd>0 / 12</dd></div>
          </dl>
        </div>
      )}

      <div className="form-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : mode === 'create' ? 'Create franchise' : 'Save changes'}</button>
      </div>
    </form>
  )
}

export function Field({ label, error, hint, children }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}
