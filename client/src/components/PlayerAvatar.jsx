/**
 * PlayerAvatar — displays a player''s monogram tile with role colour accent.
 *
 * Props:
 *   player    - player object with at least { name, initials, playing_role, team? }
 *   size      - "sm" | "md" | "lg" | "hero"  (default "md")
 *   className - extra CSS class
 */
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
  const { outer, fontSize } = SIZES[size] || SIZES.md
  const role   = roleMeta(player.playing_role)
  const accent = player.team?.color || ROLE_COLORS[role.key] || '#f2c14e'

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
      }}
      aria-label={player.name}
      title={player.name}
    >
      <Initials
        name={player.name}
        initials={player.initials}
        size={size}
      />
    </span>
  )
}