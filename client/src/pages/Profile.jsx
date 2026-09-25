import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/Toast'
import { Loader } from '../components/States'
import { formatINR } from '../lib/format'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const { toasts, addToast, removeToast } = useToast()
  const [form, setForm] = useState({ full_name: '', mobile: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getProfile()
      .then(d => setForm({ full_name: d.user.full_name || '', mobile: d.user.mobile || '' }))
      .catch(() => addToast('Could not load your account.', 'danger'))
      .finally(() => setLoading(false))
  }, [addToast])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const d = await api.updateProfile(form)
      updateUser({ full_name: d.user.full_name, mobile: d.user.mobile })
      addToast('Account saved', 'success')
    } catch (err) { addToast(err.message, 'danger') } finally { setSaving(false) }
  }

  if (loading) return <Loader full />
  return (
    <div className="page page-narrow">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="page-head"><div><h1>Account</h1><p className="muted">Signed in as {user?.enrollment_number}</p></div></div>
      {user?.role === 'user' && (
        <section className="panel">
          <h2>{user.team_name}</h2>
          <p className="muted">Team details, purse ({formatINR(user.starting_purse)} start) and squad limit are managed by the admin.</p>
        </section>
      )}
      <form className="panel form" onSubmit={submit}>
        <label className="field"><span className="field-label">{user?.role === 'user' ? 'Owner name' : 'Name'}</span>
          <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required /></label>
        <label className="field"><span className="field-label">Mobile (optional)</span>
          <input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} inputMode="tel" /></label>
        <div className="form-actions"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save account'}</button></div>
      </form>
    </div>
  )
}
