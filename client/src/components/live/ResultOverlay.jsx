import { useMemo } from 'react'
import { Gavel, Ban, Sparkles, Trophy } from 'lucide-react'
import AnimatedNumber from '../AnimatedNumber'
import TeamMark from '../TeamMark'
import RoleIcon from '../RoleIcon'
import { formatINR, pad2, roleMeta } from '../../lib/format'

// Broadcast-quality responsive SOLD / UNSOLD moment overlay for laptops and mobile phones.
export default function ResultOverlay({ result, onDismiss }) {
  const particles = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    left: (i * 29) % 100,
    delay: (i % 8) * 0.15,
    dur: 2.4 + (i % 5) * 0.35,
    size: 4 + (i % 3) * 3,
  })), [])

  if (!result) return null
  const sold = result.type === 'SOLD'
  const team = sold ? {
    id: result.teamId,
    team_name: result.teamName,
    short_name: result.shortName,
    color: result.color,
    logo_url: result.logoUrl
  } : null

  const isForeign = result.country && result.country.trim().toLowerCase() !== 'india'

  return (
    <div
      className={`result ${sold ? 'result-sold' : 'result-unsold'}`}
      style={sold ? { '--team': result.color || '#f2c14e' } : undefined}
      role="alert"
      onClick={onDismiss}
    >
      {/* Dynamic celebratory particles for SOLD */}
      {sold && (
        <div className="result-particles" aria-hidden="true">
          {particles.map((p, i) => (
            <i
              key={i}
              style={{
                left: `${p.left}%`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.dur}s`,
                width: p.size,
                height: p.size,
              }}
            />
          ))}
        </div>
      )}

      {/* Background Initials Watermark */}
      <span className="result-watermark" aria-hidden="true">{result.initials}</span>

      {/* Main Glassmorphic Card Container */}
      <div className="result-card" onClick={(e) => e.stopPropagation()}>
        <div className="result-body">
          {/* Status Badge */}
          <div className={`result-status-badge ${sold ? 'status-sold' : 'status-unsold'}`}>
            {sold ? (
              <>
                <Gavel size={16} className="badge-icon" />
                <span>HAMMER DOWN · SOLD</span>
                <Sparkles size={14} className="badge-sparkle" />
              </>
            ) : (
              <>
                <Ban size={16} className="badge-icon" />
                <span>PASSED · UNSOLD</span>
              </>
            )}
          </div>

          <h1 className="result-word">{sold ? 'Sold' : 'Unsold'}</h1>

          {result.lot && (
            <p className="result-lot">Player #{pad2(result.lot.position)}</p>
          )}

          <div className="result-player-info">
            <h2 className="result-name">
              {result.playerName}
            </h2>
            <div className="result-meta-chips">
              <span className="result-role">
                <RoleIcon role={result.role} size={16} />
                {roleMeta(result.role).label}
              </span>
              {isForeign && <span className="badge-foreign">Overseas</span>}
              {result.is_uncapped && <span className="badge-uncapped">Uncapped</span>}
            </div>
          </div>

          {sold ? (
            <div className="result-sale-panel">
              <div className="result-team">
                <span className="label">Sold to</span>
                <div className="result-team-row">
                  <TeamMark team={team} size={58} className="result-team-logo" />
                  <b className="result-team-title">{result.teamName}</b>
                </div>
              </div>

              <div className="result-price-wrap">
                <span className="price-label">Winning Bid</span>
                <div className="result-price">
                  <AnimatedNumber
                    value={result.price}
                    from={Math.round(result.price * 0.6)}
                    duration={1100}
                    format={formatINR}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="result-unsold-panel">
              <p className="result-none">No successful bid received for this lot</p>
              <span className="result-none-sub">Will return to unallocated pool</span>
            </div>
          )}

          <button
            type="button"
            className="result-dismiss-btn"
            onClick={onDismiss}
            aria-label="Dismiss result overlay"
          >
            Tap or click anywhere to continue
          </button>
        </div>
      </div>
    </div>
  )
}
