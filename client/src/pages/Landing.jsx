import { Link } from 'react-router-dom'
import { Radio, ListOrdered, ArrowRight, Calendar, Clock, MapPin, Building2, Shield, Coins, Gavel } from 'lucide-react'
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
        <div className="hero-glow-orb orb-1" />
        <div className="hero-glow-orb orb-2" />
        <span className="landing-mark" aria-hidden="true">JPL</span>
        
        <div className="landing-copy">
          <div className="landing-badge landing-fade-up">
            <span className="pulse-ring-wrap">
              <i />
              <i />
            </span>
            <span>JCC PREMIERE LEAGUE (JPL) AUCTION</span>
          </div>
          <h1 className="landing-fade-up delay-1">The player auction, live.</h1>
          <p className="landing-lede landing-fade-up delay-2">
            Sports Club, Jagannath Community College (JCC) — Jagannath University, Delhi NCR | Bahadurgarh.
          </p>
          <div className="landing-cta landing-fade-up delay-3">
            <Link to="/live" className="btn btn-primary btn-lg glow-on-hover">
              <Radio size={18} /> Watch live stage
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">
              Franchise sign in <ArrowRight size={16} />
            </Link>
          </div>
          {live && (
            <Link to="/live" className="now-playing landing-fade-up delay-4">
              <i className="live-dot" /> On the block now: <b>{s.player.name}</b> · {s.currentBid ? formatINR(s.currentBid) : `base ${formatINR(s.player.base_price)}`}
            </Link>
          )}
        </div>
      </section>

      {/* Event Details Bar */}
      <section className="landing-event-bar">
        <div className="event-detail-card landing-fade-up delay-1">
          <Calendar className="event-icon" size={24} />
          <div>
            <small>Auction Date</small>
            <b>15th October 2026</b>
          </div>
        </div>
        <div className="event-detail-card landing-fade-up delay-2">
          <Clock className="event-icon" size={24} />
          <div>
            <small>Start Time</small>
            <b>10:30 AM Onwards</b>
          </div>
        </div>
        <div className="event-detail-card landing-fade-up delay-3">
          <MapPin className="event-icon" size={24} />
          <div>
            <small>Venue</small>
            <b>Auditorium, JCC</b>
          </div>
        </div>
        <div className="event-detail-card landing-fade-up delay-4">
          <Building2 className="event-icon" size={24} />
          <div>
            <small>Organizer & University</small>
            <b>Sports Club, JCC · Jagannath University</b>
          </div>
        </div>
      </section>

      {/* Official Rules & Format Section */}
      <section className="landing-rules-section">
        <div className="landing-rules-head">
          <span className="label">Official Event Rules</span>
          <h2>JPL Auction Guidelines & Format</h2>
          <p className="muted">Official rules for participating franchises in the JCC Premiere League Auction.</p>
        </div>

        <div className="rules-grid">
          {/* Card 1: Budget & Team Size */}
          <div className="rule-card landing-fade-up delay-1">
            <div className="rule-card-header">
              <Coins className="rule-icon" size={22} />
              <h3>Budget & Franchise Structure</h3>
            </div>
            <ul className="rule-list">
              <li><span>Franchise Budget:</span> <b>₹75 Crore</b></li>
              <li><span>Team Size:</span> <b>4 Students</b> per team</li>
              <li><span>Bidding Mode:</span> <b>On-Spot Bidding in Lakhs</b></li>
              <li><span>Auctioneer:</span> <b>Official JCC Quick Auction</b></li>
            </ul>
          </div>

          {/* Card 2: Squad Composition */}
          <div className="rule-card rule-card-highlight landing-fade-up delay-2">
            <div className="rule-card-header">
              <Shield className="rule-icon" size={22} />
              <h3>Squad Composition (Max 15)</h3>
            </div>
            <p className="rule-subtext">Each team can have up to 15 players:</p>
            <div className="squad-roles-grid">
              <div className="squad-role-item">
                <span className="role-lbl">Batsmen</span>
                <b className="role-cap">Max 5</b>
              </div>
              <div className="squad-role-item">
                <span className="role-lbl">Bowlers</span>
                <b className="role-cap">Max 5</b>
              </div>
              <div className="squad-role-item">
                <span className="role-lbl">Wicketkeepers</span>
                <b className="role-cap">Max 2</b>
              </div>
              <div className="squad-role-item">
                <span className="role-lbl">All-Rounders</span>
                <b className="role-cap">Max 3</b>
              </div>
            </div>
          </div>

          {/* Card 3: Live Bidding System */}
          <div className="rule-card landing-fade-up delay-3">
            <div className="rule-card-header">
              <Gavel className="rule-icon" size={22} />
              <h3>Live Bidding Engine</h3>
            </div>
            <ul className="rule-list">
              <li><span>Real-time Sync:</span> <b>WebSocket Digital Paddles</b></li>
              <li><span>Purse Floor:</span> <b>Automatic Minimum Base Reservation</b></li>
              <li><span>Live Broadcast:</span> <b>Auditorium Stage Screen Sync</b></li>
              <li><span>Record Tracking:</span> <b>Instant Contract & Squad Assignment</b></li>
            </ul>
          </div>
        </div>
      </section>

      {/* Direct Quick Links */}
      <section className="landing-links">
        <Link to="/live" className="landing-link landing-fade-up delay-1">
          <Radio size={24} />
          <b>Live Broadcast Stage</b>
          <span>Watch the live auction stage with real-time bid updates and leaderboards.</span>
        </Link>
        <Link to="/history" className="landing-link landing-fade-up delay-2">
          <ListOrdered size={24} />
          <b>Results & History</b>
          <span>Browse completed player sales and final auction results.</span>
        </Link>
      </section>

      {/* Footer with Creator Credits */}
      <footer className="landing-foot">
        <div className="landing-foot-inner">
          <span className="landing-foot-brand">
            <b>JPL 2026</b> · Sports Club, JCC (Jagannath University, Delhi NCR | Bahadurgarh)
          </span>
          <span className="landing-foot-credits">
            Designed by <strong>Aditya Kaushik</strong> and <strong>Arav Aswal</strong>
          </span>
        </div>
      </footer>
    </div>
  )
}
