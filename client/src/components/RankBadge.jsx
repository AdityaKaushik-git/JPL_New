import { pad2 } from '../lib/format'

/** JPL rank as a scoreboard-style badge. Top 3 get medal tones. */
export default function RankBadge({ rank, label = 'JPL rank', size = 'md' }) {
  if (rank === null || rank === undefined) {
    return <span className={`rank-badge rank-${size} rank-none`}><small>{label}</small><b>NR</b></span>
  }
  const tier = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'plain'
  return (
    <span className={`rank-badge rank-${size} rank-${tier}`}>
      <small>{label}</small>
      <b>#{pad2(rank)}</b>
    </span>
  )
}
