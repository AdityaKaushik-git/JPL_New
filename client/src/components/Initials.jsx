import { initialsOf } from '../lib/format'

/** Player identity without a photograph: a monogram tile. */
export default function Initials({ name, initials, size = 'md', accent, className = '' }) {
  const text = initials || initialsOf(name)
  return (
    <span className={`initials initials-${size} ${className}`} style={accent ? { '--accent': accent } : undefined} aria-hidden="true">
      {text}
    </span>
  )
}
