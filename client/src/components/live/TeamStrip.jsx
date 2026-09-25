import { useEffect, useState } from 'react'
import TeamMark from '../TeamMark'
import { formatShort } from '../../lib/format'

/** Bottom strip: every franchise's purse and squad, with a subtle pulse when that team bids. */
export default function TeamStrip({ teams, pulse, leaderId }) {
  const [pulsing, setPulsing] = useState(null)
  useEffect(() => {
    if (!pulse) return
    setPulsing(pulse.teamId)
    const t = setTimeout(() => setPulsing(null), 900)
    return () => clearTimeout(t)
  }, [pulse])

  if (!teams || !teams.length) return null
  return (
    <section className="team-strip" aria-label="Team purses">
      {teams.filter(t => t.status !== 'disabled').map(t => {
        const full = t.squad_count >= t.max_squad_size
        return (
          <div key={t.id}
            className={`team-chip${pulsing === t.id ? ' is-pulse' : ''}${leaderId === t.id ? ' is-leading' : ''}${full ? ' is-full' : ''}`}
            style={{ '--team': t.color }}>
            <TeamMark team={t} size={34} />
            <div className="team-chip-text">
              <b>{t.short_name}</b>
              <span className="team-chip-purse">{formatShort(t.remaining_purse)}</span>
            </div>
            <div className="team-chip-squad" aria-label={`${t.squad_count} of ${t.max_squad_size} players`}>
              <span className="squad-count">{full ? 'Full' : `${t.squad_count}/${t.max_squad_size}`}</span>
              <span className="squad-pips" aria-hidden="true">
                {Array.from({ length: t.max_squad_size }).map((_, i) => <i key={i} className={i < t.squad_count ? 'on' : ''} />)}
              </span>
            </div>
          </div>
        )
      })}
    </section>
  )
}
