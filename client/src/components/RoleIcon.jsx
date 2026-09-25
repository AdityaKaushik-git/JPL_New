/**
 * Cricket role glyphs drawn as tiny inline SVGs (no extra dependency —
 * lucide has no cricket-specific icons). They inherit `currentColor`.
 */
const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

function Bat() {
  return (
    <g {...common}>
      <path d="M14.5 3.5l6 6-9.2 9.2a2 2 0 0 1-2.8 0l-3.2-3.2a2 2 0 0 1 0-2.8z" />
      <path d="M5.3 18.7L2.5 21.5" />
      <path d="M11 7l6 6" opacity=".5" />
    </g>
  )
}

function Ball() {
  return (
    <g {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.2 6.2c3.2 3.2 3.2 8.4 0 11.6M17.8 6.2c-3.2 3.2-3.2 8.4 0 11.6" strokeDasharray="1.6 1.6" />
    </g>
  )
}

function AllRounder() {
  return (
    <g {...common}>
      <path d="M13 3.5l5 5-7.8 7.8a1.7 1.7 0 0 1-2.4 0l-2.6-2.6a1.7 1.7 0 0 1 0-2.4z" />
      <path d="M5.2 16.8L3 19" />
      <circle cx="18" cy="18" r="3.4" />
    </g>
  )
}

function Keeper() {
  return (
    <g {...common}>
      <path d="M7 7v14M12 7v14M17 7v14" />
      <path d="M6 5.5h5M13 5.5h5" strokeWidth="2.2" />
    </g>
  )
}

const MAP = { 'Batsman': Bat, 'Bowler': Ball, 'All-Rounder': AllRounder, 'Wicket Keeper': Keeper }

export default function RoleIcon({ role, size = 20, className = '', title }) {
  const Glyph = MAP[role] || Bat
  return (
    <svg className={`role-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <Glyph />
    </svg>
  )
}
