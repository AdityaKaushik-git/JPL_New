import { Link } from 'react-router-dom'
import { Radio, ListOrdered, ArrowRight } from 'lucide-react'
import PitchBackdrop from '../components/PitchBackdrop'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { formatINR } from '../lib/format'

/** Public front door for JPL Auction. */
export default function Landing() {
  const status = useAsync(() => api.getAuctionStatus(), [])
  const s = status.data
  const live = s && ['Live', 'Paused'].includes(s.status) && s.player

  return (
    <div className="landing">
      {/* Hero Section */}
      <section className="landing-hero">
        <PitchBackdrop className="hero-pitch" />
        <span className="landing-mark" aria-hidden="true">JPL</span>
        <div className="landing-copy">
          <p className="landing-kicker">JCC CRICKET SPORTS MEET</p>
          <h1>The player auction, live.</h1>
          <p className="landing-lede">
            Follow every paddle live on the screen or sign in as a franchise to place bids.
          </p>
          <div className="landing-cta">
            <Link to="/live" className="btn btn-primary btn-lg">
              <Radio size={18} /> Watch live
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">
              Franchise sign in <ArrowRight size={16} />
            </Link>
          </div>
          {live && (
            <Link to="/live" className="now-playing">
              <i className="live-dot" /> On the block now: <b>{s.player.name}</b> · {s.currentBid ? formatINR(s.currentBid) : `base ${formatINR(s.player.base_price)}`}
            </Link>
          )}
        </div>
      </section>

      {/* Direct Quick Links */}
      <section className="landing-links">
        <Link to="/live" className="landing-link">
          <Radio size={24} />
          <b>Live Broadcast Stage</b>
          <span>Watch the live auction hammer with real-time bid updates and leaderboards.</span>
        </Link>
        <Link to="/history" className="landing-link">
          <ListOrdered size={24} />
          <b>Results & History</b>
          <span>Browse completed player sales and final auction results.</span>
        </Link>
      </section>

      {/* Footer with Creator Credits */}
      <footer className="landing-foot">
        <div className="landing-foot-inner">
          <span className="landing-foot-brand"><b>JPL</b> · JCC Cricket Sports Meet</span>
          <span className="landing-foot-credits">Designed by <strong>Aditya Kaushik</strong> and <strong>Arav Aswal</strong></span>
        </div>
      </footer>
    </div>
  )
}
