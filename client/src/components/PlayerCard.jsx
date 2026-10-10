import { Link } from 'react-router-dom'
import PlayerAvatar from './PlayerAvatar'
import RoleIcon from './RoleIcon'
import RankBadge from './RankBadge'
import { formatINR, roleMeta } from '../lib/format'

export default function PlayerCard({ player, accent, priceLabel = 'Purchased', price }) {
  const role = roleMeta(player.playing_role)
  const isForeign = player.country && player.country.trim().toLowerCase() !== 'india'
  return (
    <Link to={`/players/${player.id}`} className="player-card" style={accent ? { '--accent': accent } : undefined}>
      <span className="player-card-mono" aria-hidden="true">{player.initials}</span>
      <div className="player-card-top">
        <PlayerAvatar player={player} size="lg" />
        <RankBadge rank={player.current_rank} size="sm" />
      </div>
      <h3 className="player-card-name">
        {player.name}
        {isForeign && <span className="badge-foreign">Overseas</span>}
        {player.is_uncapped && <span className="badge-uncapped">Uncapped</span>}
      </h3>
      <p className="player-card-role"><RoleIcon role={player.playing_role} size={16} /> {role.label}</p>
      <div className="player-card-meta">
        <span><b>{player.ranking_points}</b> pts</span>
        <span>Form <b>{player.form_points}</b></span>
      </div>
      {price !== undefined && price !== null && (
        <div className="player-card-price">
          <small>{priceLabel}</small>
          <strong>{formatINR(price)}</strong>
        </div>
      )}
    </Link>
  )
}
