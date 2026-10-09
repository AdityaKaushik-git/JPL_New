import { useMemo } from 'react'
import AnimatedNumber from '../AnimatedNumber'
import TeamMark from '../TeamMark'
import RoleIcon from '../RoleIcon'
import { formatINR, pad2, roleMeta } from '../../lib/format'

/** Full-screen SOLD / UNSOLD moment. Particles exist only while this is on screen. */
export default function ResultOverlay({ result, onDismiss }) {
  const particles = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 7) * 0.18,
    dur: 2.6 + (i % 5) * 0.35,
    size: 3 + (i % 3) * 2,
  })), [])

  if (!result) return null
  const sold = result.type === 'SOLD'
  const team = sold ? { id: result.teamId, team_name: result.teamName, short_name: result.shortName, color: result.color, logo_url: result.logoUrl } : null

  const isForeign = result.country && result.country.trim().toLowerCase() !== 'india'
  return (
    <div className={`result ${sold ? 'result-sold' : 'result-unsold'}`} style={sold ? { '--team': result.color } : undefined}
      role="alert" onClick={onDismiss}>
      {sold && (
        <div className="result-particles" aria-hidden="true">
          {particles.map((p, i) => (
            <i key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, width: p.size, height: p.size }} />
          ))}
        </div>
      )}
      <span className="result-watermark" aria-hidden="true">{result.initials}</span>
      <div className="result-body">
        <p className="result-word">{sold ? 'Sold' : 'Unsold'}</p>
        {result.lot && <p className="result-lot">Player #{pad2(result.lot.position)}</p>}
        <h2 className="result-name">
          {result.playerName}
          {isForeign && <span className="badge-foreign">✈ Overseas</span>}
          {result.is_uncapped && <span className="badge-uncapped">⭐ Uncapped</span>}
        </h2>
        <p className="result-role"><RoleIcon role={result.role} size={20} /> {roleMeta(result.role).label}</p>
        {sold ? (
          <>
            <div className="result-team">
              <span className="label">Sold to</span>
              <div className="result-team-row">
                <TeamMark team={team} size={72} />
                <b>{result.teamName}</b>
              </div>
            </div>
            <div className="result-price">
              <AnimatedNumber value={result.price} from={Math.round(result.price * 0.6)} duration={1100} format={formatINR} />
            </div>
          </>
        ) : (
          <p className="result-none">No successful bid</p>
        )}
      </div>
    </div>
  )
}
