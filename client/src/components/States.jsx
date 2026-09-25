import { AlertTriangle } from 'lucide-react'

export function Loader({ label = 'Loading', full }) {
  return (
    <div className={`loader${full ? ' loader-full' : ''}`} role="status">
      <span className="loader-ball" aria-hidden="true" />
      <span className="loader-label">{label}</span>
    </div>
  )
}

export function EmptyState({ icon, title, children, action }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty empty-error">
      <div className="empty-icon"><AlertTriangle size={28} /></div>
      <h3>Couldn't load this</h3>
      <p>{(error && error.message) || 'The server did not respond.'}</p>
      {onRetry && <button className="btn btn-ghost" onClick={onRetry}>Try again</button>}
    </div>
  )
}
