import { useState } from 'react'
import { Trophy, Coins, Shield, Sparkles, Award } from 'lucide-react'
import PitchBackdrop from '../PitchBackdrop'
import RoleIcon from '../RoleIcon'
import { formatINR, pad2, roleMeta } from '../../lib/format'

// The centre of the broadcast: displays player showcase, key metrics, and photo spotlight.
export default function PlayerHero({ player, lot, accent, compact = false }) {
  if (!player) return null
  const [imgError, setImgError] = useState(false)
  const role = roleMeta(player.playing_role)
  const number = lot ? lot.position : player.auction_order
  const isForeign = player.country && player.country.trim().toLowerCase() !== 'india'
  const photoUrl = player.id ? `/api/players/${player.id}/photo?v=2` : (player.image_url || player.image)

  return (
    <section 
      className={`hero${compact ? ' hero-compact' : ''}`} 
      style={accent ? { '--accent': accent } : undefined} 
      aria-label={`Now on the block: ${player.name}`}
    >
      <PitchBackdrop className="hero-pitch" />
      <div className="hero-glow-orb hero-orb-accent" />
      
      <div className="hero-body">
        {/* Top Header Row: Lot, Category, and Rank */}
        <div className="hero-lot-bar seq seq-1">
          <div className="hero-lot-info">
            <span className="hero-lot-badge">
              LOT <b>#{pad2(number)}</b>
              {lot && <span className="hero-lot-total"> / {pad2(lot.total)}</span>}
            </span>
            {player.set_label && <span className="hero-set-pill">{player.set_label}</span>}
            {player.player_code && <span className="hero-code-pill">{player.player_code}</span>}
          </div>
          {player.current_rank && (
            <div className="hero-rank-pill">
              <Award size={15} className="rank-award-icon" />
              <span>OVERALL RANK <b>#{player.current_rank}</b></span>
            </div>
          )}
        </div>

        {/* Central Spotlight: Player Name, Badges, and Photo */}
        <div className="hero-main-row">
          <div className="hero-text-col">
            <h1 className="hero-name seq seq-2">
              {player.name}
            </h1>

            {/* Badges & Meta Chips */}
            <div className="hero-tags seq seq-3">
              <span className={`role-chip role-${role.key}`}>
                <RoleIcon role={player.playing_role} size={18} />
                <b>{role.label}</b>
              </span>
              {isForeign ? (
                <span className="badge-chip badge-overseas">
                  <span className="chip-indicator" /> Overseas · {player.country}
                </span>
              ) : (
                <span className="badge-chip badge-indian">
                  <span className="chip-indicator" /> Indian Player
                </span>
              )}
              {player.is_uncapped && (
                <span className="badge-chip badge-uncapped-pill">
                  <Sparkles size={13} /> Uncapped
                </span>
              )}
              {player.batting_style && (
                <span className="badge-chip badge-skill">{player.batting_style}</span>
              )}
              {player.bowling_style && (
                <span className="badge-chip badge-skill">{player.bowling_style}</span>
              )}
            </div>
          </div>

          {/* Photo Showcase */}
          <div className="hero-photo-stage seq seq-2">
            <div className="photo-backdrop-ring" />
            {photoUrl && !imgError ? (
              <div className="hero-photo-frame">
                <img
                  src={photoUrl}
                  alt={player.name}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="hero-avatar-image"
                />
                <div className="photo-inner-shadow" />
                <div className="photo-role-crest" title={role.label}>
                  <RoleIcon role={player.playing_role} size={18} />
                </div>
              </div>
            ) : (
              <div className="hero-photo-frame hero-initials-frame">
                <span className="hero-initials-text">{player.initials}</span>
                <div className="photo-role-crest" title={role.label}>
                  <RoleIcon role={player.playing_role} size={18} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Key Auction Metrics Ribbon */}
        <div className="hero-metrics-ribbon seq seq-4">
          <div className="metric-box metric-points-box">
            <div className="metric-box-head">
              <Trophy size={16} className="metric-gold-icon" />
              <small>ICC Ranking Points</small>
            </div>
            <div className="metric-box-body">
              <b className="metric-big-number">{player.ranking_points || 0}</b>
              <span className="metric-points-tag">PTS</span>
            </div>
            <span className="metric-box-foot">Champion Tie-Breaker Rating</span>
          </div>

          <div className="metric-box metric-base-box">
            <div className="metric-box-head">
              <Coins size={16} className="metric-gold-icon" />
              <small>Opening Base Price</small>
            </div>
            <div className="metric-box-body">
              <b className="metric-big-price">{formatINR(player.base_price)}</b>
            </div>
            <span className="metric-box-foot">Floor Bidding Threshold</span>
          </div>

          {(player.category_rank || player.set_label) && (
            <div className="metric-box metric-bracket-box">
              <div className="metric-box-head">
                <Shield size={16} className="metric-gold-icon" />
                <small>Role Category Bracket</small>
              </div>
              <div className="metric-box-body">
                <b className="metric-big-bracket">
                  {player.category_rank ? `#${player.category_rank} ${role.short || role.label}` : (player.set_label || 'Standard')}
                </b>
              </div>
              <span className="metric-box-foot">
                {player.set_label ? `${player.set_label} Queue` : 'Category Standing'}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
