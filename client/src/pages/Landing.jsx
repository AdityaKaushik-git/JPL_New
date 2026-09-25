import { Link } from 'react-router-dom'
import { Radio, Trophy, ListOrdered, Users } from 'lucide-react'
import PitchBackdrop from '../components/PitchBackdrop'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import TeamMark from '../components/TeamMark'
import { formatINR, formatShort } from '../lib/format'

/** Public front door. There is no sign-up here — franchises are created by the admin. */
export default function Landing() {
  const status = useAsync(() => api.getAuctionStatus(), [])
  const teams = useAsync(() => api.getFranchises(), [])
  const s = status.data
  const live = s && ['Live', 'Paused'].includes(s.status) && s.player

  return (
    <div className="landing">
      <section className="landing-hero">
        <PitchBackdrop className="hero-pitch" />
        <span className="landing-mark" aria-hidden="true">JPL</span>
        <div className="landing-copy">
          <p className="landing-kicker">JCC Cricket Sports Meet</p>
          <h1>The player auction, live.</h1>
          <p className="landing-lede">Franchises bid from an {formatINR(180000000)} purse to build squads of twelve. Follow every paddle on the live screen.</p>
          <div className="landing-cta">
            <Link to="/live" className="btn btn-primary btn-lg"><Radio size={18} /> Watch live</Link>
            <Link to="/login" className="btn btn-ghost btn-lg">Franchise sign in</Link>
          </div>
          {live && (
            <Link to="/live" className="now-playing">
              <i className="live-dot" /> On the block now: <b>{s.player.name}</b> · {s.currentBid ? formatINR(s.currentBid) : `base ${formatINR(s.player.base_price)}`}
            </Link>
          )}
        </div>
      </section>

      <section className="landing-links">
        <Link to="/rankings" className="landing-link"><Trophy size={22} /><b>Player rankings</b><span>JPL ratings across batters, bowlers, all-rounders and keepers.</span></Link>
        <Link to="/standings" className="landing-link"><Users size={22} /><b>Teams</b><span>Purses, spending and squads for every franchise.</span></Link>
        <Link to="/history" className="landing-link"><ListOrdered size={22} /><b>Results</b><span>Every player sold or unsold, with the final price.</span></Link>
      </section>

      {teams.data && teams.data.franchises.length > 0 && (
        <section className="landing-teams">
          {teams.data.franchises.filter(t => t.status !== 'disabled').map(t => (
            <div key={t.id} className="landing-team" style={{ '--team': t.color }}>
              <TeamMark team={t} size={40} /><b>{t.team_name}</b><span>{formatShort(t.remaining_purse)} · {t.squad_count}/{t.max_squad_size}</span>
            </div>
          ))}
        </section>
      )}
      <footer className="landing-foot">JPL · JCC Cricket Sports Meet</footer>
    </div>
  )
}
