// RoleSlots - displays squad composition with slot availability.
import RoleIcon from './RoleIcon'

const SLOTS = [
  { role: 'Batsman', count_key: 'batsmen_count', max: 5, label: 'Batsmen', short: 'BAT' },
  { role: 'Bowler', count_key: 'bowlers_count', max: 5, label: 'Bowlers', short: 'BOWL' },
  { role: 'All-Rounder', count_key: 'allrounders_count', max: 3, label: 'All-Rounders', short: 'AR' },
  { role: 'Wicket Keeper', count_key: 'keepers_count', max: 2, label: 'Keeper', short: 'WK' },
]

const INFO_SLOTS = [
  { key: 'indian_count',  max: 3, label: 'Indian', short: 'IND', title: 'Indian players (min 3)', isMin: true },
  { key: 'foreign_count', max: null, label: 'Overseas', short: 'OS', title: 'Overseas players (no limit)' },
]

export default function RoleSlots({ franchise, currentRole = null, compact = false }) {
  const f = franchise || {}
  
  return (
    <div className={`role-slots${compact ? ' role-slots-compact' : ''}`}>
      {SLOTS.map(s => {
        const used = Number(f[s.count_key] || 0)
        const full = used >= s.max
        const isCurrentRole = s.role === currentRole
        return (
          <div
            key={s.role}
            className={`role-slot${full ? ' is-full' : ''}${isCurrentRole ? ' is-current' : ''}`}
            title={`${s.label}: ${used} / ${s.max}`}
          >
            {!compact && <RoleIcon role={s.role} size={14} />}
            <span className="role-slot-label">{compact ? s.short : s.label}</span>
            <span className={`role-slot-count${full ? ' is-full' : ''}`}>
              {used}<span className="role-slot-max">/{s.max}</span>
            </span>
            {full && <span className="role-slot-full-badge">FULL</span>}
          </div>
        )
      })}
      {INFO_SLOTS.map(s => {
        const used = Number(f[s.key] || 0)
        const alert = s.isMin ? used < s.max : false
        return (
          <div
            key={s.key}
            className={`role-slot role-slot-info${alert ? ' is-warn' : ''}`}
            title={s.title}
          >
            {!compact && <span className="role-slot-icon">{s.isMin ? '🇮🇳' : '✈'}</span>}
            <span className="role-slot-label">{compact ? s.short : s.label}</span>
            <span className={`role-slot-count${alert ? ' is-warn' : ''}`}>
              {used}<span className="role-slot-max">{s.isMin ? `/${s.max}✓` : ''}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function canBidForRole(franchise, role) {
  const f = franchise || {}
  const checks = {
    'Batsman': () => Number(f.batsmen_count || 0) < 5,
    'Bowler': () => Number(f.bowlers_count || 0) < 5,
    'All-Rounder': () => Number(f.allrounders_count || 0) < 3,
    'Wicket Keeper': () => Number(f.keepers_count || 0) < 2,
  }
  return checks[role] ? checks[role]() : true
}

export function roleBlockMessage(franchise, role) {
  if (!franchise) return null
  if (!canBidForRole(franchise, role)) {
    const labels = {
      'Batsman': 'BATSMAN SLOT FULL',
      'Bowler': 'BOWLER SLOT FULL',
      'All-Rounder': 'ALL-ROUNDER SLOT FULL',
      'Wicket Keeper': 'WICKET-KEEPER SLOT FULL',
    }
    return labels[role] || 'Role slot full'
  }
  return null
}

// No limit on overseas players
export function canBidForeign() {
  return true
}

export function foreignBlockMessage() {
  return null
}

// Minimum 3 Indian players requirement lookahead
export function canBidIndianRule(franchise, isForeign, squad, maxSquad = 15) {
  if (!isForeign) return true
  const f = franchise || {}
  const indianNow = Number(f.indian_count || 0)
  const needed = Math.max(0, 3 - indianNow)
  const remainingSlotsAfterThis = maxSquad - (squad + 1)
  return remainingSlotsAfterThis >= needed
}

export function indianBlockMessage(franchise, isForeign, squad, maxSquad = 15) {
  if (!franchise || !isForeign) return null
  if (!canBidIndianRule(franchise, isForeign, squad, maxSquad)) {
    const indianNow = Number(franchise.indian_count || 0)
    const needed = Math.max(0, 3 - indianNow)
    const remainingSlotsAfterThis = maxSquad - (squad + 1)
    return `INDIAN MINIMUM — need ${needed} more Indian player(s) (${remainingSlotsAfterThis} slot(s) left)`
  }
  return null
}

// Backwards-compatible stubs
export function canBidUncapped() {
  return true
}

export function uncappedBlockMessage() {
  return null
}