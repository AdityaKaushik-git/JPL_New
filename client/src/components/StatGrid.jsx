// Compact statistic tiles.
export default function StatGrid({ items, className = '', size = 'md' }) {
  return (
    <dl className={`stat-grid stat-grid-${size} ${className}`}>
      {items.map((it) => (
        <div key={it.label} className={`stat-tile${it.emphasis ? ' stat-tile-em' : ''}`}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
          {it.hint && <span className="stat-hint">{it.hint}</span>}
        </div>
      ))}
    </dl>
  )
}

// The six most telling numbers for a role, used on the live screen and cards.
export function keyStatsFor(p) {
  if (!p) return []
  const avg = (v) => (Number(v) ? Number(v).toFixed(2) : '—')
  const sr = (v) => (Number(v) ? Number(v).toFixed(1) : '—')
  const bat = [
    { label: 'Matches', value: p.matches },
    { label: 'Runs', value: p.runs, emphasis: true },
    { label: 'Average', value: avg(p.batting_average) },
    { label: 'Strike rate', value: sr(p.strike_rate) },
    { label: '50s / 100s', value: `${p.fifties} / ${p.hundreds}` },
    { label: 'Highest', value: p.highest_score || '—' },
  ]
  const bowl = [
    { label: 'Matches', value: p.matches },
    { label: 'Wickets', value: p.wickets, emphasis: true },
    { label: 'Economy', value: avg(p.economy) },
    { label: 'Average', value: avg(p.bowling_average) },
    { label: 'Strike rate', value: sr(p.bowling_strike_rate) },
    { label: 'Best', value: p.best_bowling || '—' },
  ]
  switch (p.playing_role) {
    case 'Bowler': return bowl
    case 'All-Rounder': return [
      { label: 'Matches', value: p.matches },
      { label: 'Runs', value: p.runs, emphasis: true },
      { label: 'Strike rate', value: sr(p.strike_rate) },
      { label: 'Wickets', value: p.wickets, emphasis: true },
      { label: 'Economy', value: avg(p.economy) },
      { label: 'Best', value: p.best_bowling || '—' },
    ]
    case 'Wicket Keeper': return [
      { label: 'Matches', value: p.matches },
      { label: 'Runs', value: p.runs, emphasis: true },
      { label: 'Average', value: avg(p.batting_average) },
      { label: 'Strike rate', value: sr(p.strike_rate) },
      { label: 'Catches', value: p.catches },
      { label: 'Stumpings', value: p.stumpings, emphasis: true },
    ]
    default: return bat
  }
}
