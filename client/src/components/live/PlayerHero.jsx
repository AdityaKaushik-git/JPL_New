import { useState } from 'react'
import PitchBackdrop from '../PitchBackdrop'
import RoleIcon from '../RoleIcon'
import RankBadge from '../RankBadge'
import StatGrid, { keyStatsFor } from '../StatGrid'
import { FormDelta } from '../Movement'
import { formatINR, pad2, roleMeta } from '../../lib/format'

/**
 * The centre of the broadcast: displays player photo if available (or initials watermark),
 * along with player stats, auction lot details and pricing.
 */
export default function PlayerHero({ player, lot, accent, compact = false }) {
  if (!player) return null
  const [imgError, setImgError] = useState(false)
  const role = roleMeta(player.playing_role)
  const form = player.ranking_points - player.previous_ranking_points
  const isNew = player.current_rank === null || (player.previous_rank === null && form === 0)
  const number = lot ? lot.position : player.auction_order
  const isForeign = player.country && player.country.trim().toLowerCase() !== 'india'
  const photoUrl = player.id ? `/api/players/${player.id}/photo?v=2` : (player.image_url || player.image)

  return (
    <section className={`hero${compact ? ' hero-compact' : ''}`} style={accent ? { '--accent': accent } : undefined} aria-label={`Now on the block: ${player.name}`}>
      <PitchBackdrop className="hero-pitch" />
      
      {photoUrl && !imgError ? (
        <div className="hero-photo-container seq seq-2" style={{
          position: 'absolute',
          right: compact ? '1.5rem' : '3rem',
          top: compact ? '1rem' : '2rem',
          width: compact ? '5rem' : 'min(25vw, 12rem)',
          aspectRatio: '1/1',
          borderRadius: '50%',
          border: '3px solid var(--accent, var(--gold))',
          boxShadow: '0 0 25px rgba(242, 193, 78, 0.3)',
          overflow: 'hidden',
          zIndex: 3,
          background: '#0f172a'
        }}>
          <img
            src={photoUrl}
            alt={player.name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <span className="hero-watermark" aria-hidden="true">{player.initials}</span>
      )}

      <div className="hero-body">
        <p className="hero-lot seq seq-1">
          Player <b>#{pad2(number)}</b>
          {lot && <span className="hero-lot-total"> of {lot.total}</span>}
          {player.player_code && <span className="hero-code">{player.player_code}</span>}
        </p>

        <h1 className="hero-name seq seq-3">
          {player.name}
          {isForeign && <span className="badge-foreign">{player.country}</span>}
          {player.is_uncapped && <span className="badge-uncapped">Uncapped</span>}
        </h1>

        <div className="hero-tags seq seq-4">
          <span className={`role-chip role-${role.key}`}><RoleIcon role={player.playing_role} size={22} /> {role.label}</span>
          {isForeign && <span className="hero-style" style={{ color: '#38bdf8', fontWeight: 600 }}>Overseas ({player.country})</span>}
          {player.is_uncapped && <span className="hero-style" style={{ color: '#fbbf24', fontWeight: 600 }}>Uncapped</span>}
          {player.batting_style && <span className="hero-style">{player.batting_style}</span>}
          {player.bowling_style && <span className="hero-style">{player.bowling_style}</span>}
        </div>

        <div className="hero-rank seq seq-5">
          <RankBadge rank={player.current_rank} size="lg" />
          <div className="hero-points">
            <b>{player.ranking_points}</b>
            <small>ranking points</small>
          </div>
          <div className="hero-form">
            <small>Form</small>
            {isNew ? <span className="form-new">New</span> : <FormDelta value={form} />}
          </div>
          <div className="hero-base">
            <small>Base price</small>
            <b>{formatINR(player.base_price)}</b>
          </div>
        </div>

        {!compact && (
          <div className="seq seq-6">
            <StatGrid items={keyStatsFor(player)} size="broadcast" className="hero-stats" />
          </div>
        )}
      </div>
    </section>
  )
}
