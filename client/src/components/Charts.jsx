/** Small dependency-free SVG charts for profiles. */

export function LineChart({ points, height = 180, label, valueKey = 'y', format = (v) => v }) {
  if (!points || points.length < 2) {
    return <p className="chart-empty">Not enough ranking updates yet to draw a trend.</p>
  }
  const w = 600, h = height, pad = 28
  const ys = points.map(p => p[valueKey])
  const min = Math.min(...ys), max = Math.max(...ys)
  const span = max - min || 1
  const x = (i) => pad + (i * (w - pad * 2)) / (points.length - 1)
  const y = (v) => h - pad - ((v - min) / span) * (h - pad * 2)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[valueKey]).toFixed(1)}`).join(' ')
  const area = `${d} L${x(points.length - 1)},${h - pad} L${x(0)},${h - pad} Z`
  const last = points[points.length - 1]
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} className="chart-axis" />
        <path d={area} className="chart-area" />
        <path d={d} className="chart-line" />
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p[valueKey])} r={i === points.length - 1 ? 5 : 3} className="chart-dot" />)}
        <text x={x(points.length - 1)} y={y(last[valueKey]) - 12} textAnchor="end" className="chart-label">{format(last[valueKey])}</text>
        <text x={pad} y={pad - 10} className="chart-tick">{format(max)}</text>
        <text x={pad} y={h - 8} className="chart-tick">{format(min)}</text>
      </svg>
    </figure>
  )
}

export function BarChart({ bars, height = 170, label }) {
  if (!bars || !bars.length) return <p className="chart-empty">No matches logged yet.</p>
  const w = 600, h = height, pad = 24
  const max = Math.max(1, ...bars.map(b => b.value))
  const bw = (w - pad * 2) / bars.length
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} className="chart-axis" />
        {bars.map((b, i) => {
          const bh = ((h - pad * 2) * b.value) / max
          return (
            <g key={i}>
              <rect x={pad + i * bw + bw * 0.18} y={h - pad - bh} width={bw * 0.64} height={Math.max(1, bh)} rx="3" className={b.accent ? 'chart-bar chart-bar-accent' : 'chart-bar'} />
              <text x={pad + i * bw + bw / 2} y={h - pad - bh - 6} textAnchor="middle" className="chart-label-sm">{b.value}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
