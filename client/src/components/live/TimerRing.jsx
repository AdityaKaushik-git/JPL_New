import { pad2 } from '../../lib/format'

// Server-driven countdown.
export default function TimerRing({ timeLeft, total, status, size = 'lg' }) {
  const t = Math.max(0, Number(timeLeft) || 0)
  const max = Math.max(1, Number(total) || 1)
  const r = 44
  const c = 2 * Math.PI * r
  const ratio = Math.min(1, t / max)
  const live = status === 'Live'
  const urgent = live && t > 0 && t <= 5
  const cls = ['timer-ring', `timer-${size}`, urgent ? 'is-urgent' : '', !live ? 'is-idle' : '', t === 0 && live ? 'is-zero' : ''].join(' ')
  return (
    <div className={cls} role="timer" aria-live="off" aria-label={`${t} seconds left`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="timer-track" cx="50" cy="50" r={r} />
        <circle className="timer-arc" cx="50" cy="50" r={r}
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} transform="rotate(-90 50 50)" />
      </svg>
      <div className="timer-readout">
        <span className="timer-digits">{pad2(Math.floor(t / 60))}:{pad2(t % 60)}</span>
        <span className="timer-caption">{status === 'Paused' ? 'Paused' : status === 'Processing' ? 'Closing' : live ? 'Time left' : 'Timer'}</span>
      </div>
    </div>
  )
}
