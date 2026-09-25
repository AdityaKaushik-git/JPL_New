/**
 * The one currency formatter for the whole client.
 * formatINR(180000000) → "₹18,00,00,000"   (Indian digit grouping)
 * formatShort(17400000) → "₹1.74 Cr"       (compact, for strips and tight spaces)
 */
export function formatINR(value) {
  const n = Math.round(Number(value) || 0)
  return '₹' + n.toLocaleString('en-IN')
}

export function formatShort(value) {
  const n = Math.round(Number(value) || 0)
  if (n >= 10000000) return '₹' + trim(n / 10000000) + ' Cr'
  if (n >= 100000) return '₹' + trim(n / 100000) + ' L'
  if (n >= 1000) return '₹' + trim(n / 1000) + 'K'
  return '₹' + n
}

function trim(x) {
  const fixed = x >= 100 ? x.toFixed(0) : x.toFixed(2)
  return fixed.replace(/\.?0+$/, '')
}

export const pad2 = (n) => String(Math.max(0, Number(n) || 0)).padStart(2, '0')

export function toClock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const ROLE_META = {
  'Batsman': { label: 'Batter', short: 'BAT', key: 'batter' },
  'Bowler': { label: 'Bowler', short: 'BOWL', key: 'bowler' },
  'All-Rounder': { label: 'All-rounder', short: 'AR', key: 'allrounder' },
  'Wicket Keeper': { label: 'Wicketkeeper', short: 'WK', key: 'keeper' },
}

export function roleMeta(role) {
  return ROLE_META[role] || { label: role || 'Player', short: '—', key: 'batter' }
}

export function signed(n) {
  const v = Math.round(Number(n) || 0)
  return v > 0 ? `+${v}` : `${v}`
}

export function fmtDecimal(n, digits = 2) {
  const v = Number(n) || 0
  return v === 0 ? '—' : v.toFixed(digits)
}

export function oversFromBalls(balls) {
  const b = Number(balls) || 0
  return `${Math.floor(b / 6)}.${b % 6}`
}

export function dateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function readableOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#FFFFFF'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#0A1220' : '#FFFFFF'
}
