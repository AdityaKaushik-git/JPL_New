import { Link } from 'react-router-dom'

/** JPL wordmark: a cricket ball seam as the counter of the mark. */
export default function Brand({ to = '/', compact = false }) {
  return (
    <Link to={to} className="brand" aria-label="JPL home">
      <svg className="brand-ball" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="#C8102E" />
        <path d="M7 9c5 4 13 4 18 0M7 23c5-4 13-4 18 0" stroke="#F4E9D8" strokeWidth="1.6" fill="none" strokeDasharray="1.8 1.8" />
      </svg>
      <span className="brand-word">JPL</span>
      {!compact && <span className="brand-sub">JCC Cricket Sports Meet</span>}
    </Link>
  )
}
