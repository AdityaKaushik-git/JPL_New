import { useState } from 'react'
import { readableOn } from '../lib/format'

/** Team logo (franchise logos are allowed — player photos are not), else a short-name tile. */
export default function TeamMark({ team, size = 40, className = '' }) {
  const [broken, setBroken] = useState(false)
  if (!team) return null
  const color = team.color || '#C8102E'
  const style = { '--team': color, width: size, height: size, fontSize: Math.max(10, size * 0.32) }
  if (team.logo_url && !broken) {
    return (
      <span className={`team-mark team-mark-logo ${className}`} style={style}>
        <img src={team.logo_url} alt="" loading="lazy" onError={() => setBroken(true)} />
      </span>
    )
  }
  return (
    <span className={`team-mark ${className}`} style={{ ...style, background: color, color: readableOn(color) }} aria-hidden="true">
      {team.short_name || '?'}
    </span>
  )
}
