// PlayerAvatar — displays a player's photo or monogram tile with role colour accent.
import { useState } from 'react'
import Initials from './Initials'
import { roleMeta } from '../lib/format'

const SIZES = {
  sm:   { outer: '2.4rem',  fontSize: '0.7rem'  },
  md:   { outer: '3.2rem',  fontSize: '0.9rem'  },
  lg:   { outer: '4.5rem',  fontSize: '1.2rem'  },
  hero: { outer: '7rem',    fontSize: '1.8rem'  },
}

// Role accent colours (kept here so they are co-located with the component)
const ROLE_COLORS = {
  batsman:    '#f2c14e',
  batter:     '#f2c14e',
  bowler:     '#4ecbf2',
  allrounder: '#a78bfa',
  keeper:     '#4ef29a',
}

export default function PlayerAvatar({ player, size = 'md', className = '' }) {
  if (!player) return null
  const [imgError, setImgError] = useState(false)
  const { outer, fontSize } = SIZES[size] || SIZES.md
  const role   = roleMeta(player.playing_role)
  const accent = player.team?.color || ROLE_COLORS[role.key] || '#f2c14e'
  const photoUrl = player.image_url || player.image || (player.id ? `/api/players/${player.id}/photo` : null)

  return (
    <span
      className={`player-avatar player-avatar-${size} ${className}`}
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:          outer,
        height:         outer,
        borderRadius:   '50%',
        background:     `radial-gradient(circle at 35% 35%, color-mix(in srgb, ${accent} 40%, #1a1f2e), #10131c)`,
        border:         `2px solid ${accent}`,
        boxShadow:      `0 0 18px color-mix(in srgb, ${accent} 30%, transparent)`,
        flexShrink:     0,
        fontSize,
        fontWeight:     800,
        letterSpacing:  '-0.02em',
        color:          '#fff',
        userSelect:     'none',
        overflow:       'hidden',
        position:       'relative',
      }}
      aria-label={player.name}
      title={player.name}
    >
      {photoUrl && !imgError ? (
        <img
          src={photoUrl}
          alt={player.name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
          }}
        />
      ) : (
        <Initials
          name={player.name}
          initials={player.initials}
          size={size}
        />
      )}
    </span>
  )
}