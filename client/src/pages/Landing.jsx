import { Link } from 'react-router-dom'
import { Radio, Trophy, ListOrdered } from 'lucide-react'
import PitchBackdrop from '../components/PitchBackdrop'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { formatINR } from '../lib/format'

/** Public front door. There is no sign-up here — franchises are created by the admin. */
export default function Landing() {
  const status = useAsync(() => api.getAuctionStatus(), [])
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
          <p className="landing-lede">Follow every paddle live on the screen or sign in as a franchise to place bids.</p>
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
        <Link to="/history" className="landing-link"><ListOrdered size={22} /><b>Results</b><span>Every player sold or unsold, with the final price.</span></Link>
      </section>

      <footer className="landing-foot">JPL · JCC Cricket Sports Meet</footer>
    </div>
  )
}

