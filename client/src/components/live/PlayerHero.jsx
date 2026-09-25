import PitchBackdrop from '../PitchBackdrop'
import RoleIcon from '../RoleIcon'
import RankBadge from '../RankBadge'
import StatGrid, { keyStatsFor } from '../StatGrid'
import { FormDelta } from '../Movement'
import { formatINR, pad2, roleMeta } from '../../lib/format'

/**
 * The centre of the broadcast: no photograph — the player's initials sit on the
 * pitch as an oversized watermark, and the data does the talking.
 * Keyed on auctionId by the parent so the entrance sequence replays per player.
 */
export default function PlayerHero({ player, lot, accent, compact = false }) {
  if (!player) return null
  const role = roleMeta(player.playing_role)
  const form = player.ranking_points - player.previous_ranking_points
  const isNew = player.current_rank === null || (player.previous_rank === null && form === 0)
  const number = lot ? lot.position : player.auction_order
  return (
    <section className={`hero${compact ? ' hero-compact' : ''}`} style={accent ? { '--accent': accent } : undefined} aria-label={`Now on the block: ${player.name}`}>
      <PitchBackdrop className="hero-pitch" />
      <span className="hero-watermark" aria-hidden="true">{player.initials}</span>

      <div className="hero-body">
        <p className="hero-lot seq seq-1">
          Player <b>#{pad2(number)}</b>
          {lot && <span className="hero-lot-total"> of {lot.total}</span>}
          {player.player_code && <span className="hero-code">{player.player_code}</span>}
        </p>

        <h1 className="hero-name seq seq-3">{player.name}</h1>

        <div className="hero-tags seq seq-4">
          <span className={`role-chip role-${role.key}`}><RoleIcon role={player.playing_role} size={22} /> {role.label}</span>
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
