// RoleSlots - displays squad composition with slot availability.
import RoleIcon from './RoleIcon'

const SLOTS = [
  { role: 'Batsman', count_key: 'batsmen_count', max: 5, label: 'Batsmen', short: 'BAT' },
  { role: 'Bowler', count_key: 'bowlers_count', max: 5, label: 'Bowlers', short: 'BOWL' },
  { role: 'All-Rounder', count_key: 'allrounders_count', max: 3, label: 'All-Rounders', short: 'AR' },
  { role: 'Wicket Keeper', count_key: 'keepers_count', max: 2, label: 'Keeper', short: 'WK' },
]

const INFO_SLOTS = [
  { key: 'foreign_count',  max: 4, label: 'Foreign', short: 'FOR', title: 'Overseas players (max 4)' },
  { key: 'uncapped_count', max: 2, label: 'Uncapped Indian', short: 'UNC', title: 'Uncapped Indian players (min 2)', isMin: true },
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
        const alert = s.isMin ? used < s.max : used >= s.max
        return (
          <div
            key={s.key}
            className={`role-slot role-slot-info${alert ? (s.isMin ? ' is-warn' : ' is-full') : ''}`}
            title={s.title}
          >
            {!compact && <span className="role-slot-icon">{s.isMin ? '↑' : '⚑'}</span>}
            <span className="role-slot-label">{compact ? s.short : s.label}</span>
            <span className={`role-slot-count${alert ? (s.isMin ? ' is-warn' : ' is-full') : ''}`}>
              {used}<span className="role-slot-max">{s.isMin ? `/${s.max}✓` : `/${s.max}`}</span>
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

export function canBidForeign(franchise, isForeign) {
  if (!isForeign) return true
  const f = franchise || {}
  const foreignCount = Number(f.foreign_count || 0)
  if (foreignCount >= 4) return false
  if (foreignCount >= 2) {
    // 3rd & 4th foreign player fill a Batsman slot space
    return Number(f.batsmen_count || 0) < 5
  }
  return true
}

export function canBidUncapped(franchise, isUncapped, squadFull) {
  if (isUncapped) return true
  const uncapped = Number((franchise || {}).uncapped_count || 0)
  return !(squadFull && uncapped < 2)
}

export function foreignBlockMessage(franchise, isForeign) {
  if (!franchise || !isForeign) return null
  const f = franchise || {}
  const foreignCount = Number(f.foreign_count || 0)
  if (foreignCount >= 4) return 'FOREIGN LIMIT — max 4 overseas players per squad'
  if (foreignCount >= 2 && Number(f.batsmen_count || 0) >= 5) {
    return 'BATSMAN SLOT FULL — 3rd/4th foreign player fills Batsman slot space'
  }
  return null
}

export function uncappedBlockMessage(franchise, isUncapped, squadFull) {
  if (!franchise || isUncapped) return null
  if (!canBidUncapped(franchise, isUncapped, squadFull)) {
    const needed = 2 - Number(franchise.uncapped_count || 0)
    return `UNCAPPED INDIAN REQUIRED — need ${needed} more Uncapped Indian player(s)`
  }
  return null
}