/** Rank movement: ▲2 (climbed), ▼1 (dropped), – (no change / new). */
export default function Movement({ value, className = '' }) {
  const v = Math.round(Number(value) || 0)
  if (v > 0) return <span className={`move move-up ${className}`} aria-label={`Up ${v}`}>▲{v}</span>
  if (v < 0) return <span className={`move move-down ${className}`} aria-label={`Down ${-v}`}>▼{-v}</span>
  return <span className={`move move-flat ${className}`} aria-label="No change">–</span>
}

export function FormDelta({ value, className = '' }) {
  const v = Math.round(Number(value) || 0)
  const cls = v > 0 ? 'move-up' : v < 0 ? 'move-down' : 'move-flat'
  return <span className={`move ${cls} ${className}`}>{v > 0 ? `▲ +${v}` : v < 0 ? `▼ ${v}` : '± 0'}</span>
}
