import { Link } from 'react-router-dom'
import { Radio, ListOrdered, Shield, Zap, Award, Users, Wallet, ChevronRight, Gavel, CheckCircle2 } from 'lucide-react'
import PitchBackdrop from '../components/PitchBackdrop'
import TeamMark from '../components/TeamMark'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { formatINR, formatShort } from '../lib/format'

export default function Landing() {
  const status = useAsync(() => api.getAuctionStatus(), [])
  const franchisesRes = useAsync(() => api.getFranchises(), [])

  const s = status.data
  const franchises = franchisesRes.data?.franchises || []
  const live = s && ['Live', 'Paused'].includes(s.status) && s.player

  return (
    <div className="landing">
      {/* Hero Section */}
      <section className="landing-hero">
        <PitchBackdrop className="hero-pitch" />
        <span className="landing-mark" aria-hidden="true">JPL</span>
        <div className="landing-copy">
          <div className="landing-badge">
            <span className="pulse-dot" />
            <span>JCC CRICKET SPORTS MEET 2026</span>
          </div>
          <h1>The player auction, live.</h1>
          <p className="landing-lede">
            Experience real-time paddle bidding, live stream stage, and instant squad allocation for the Premier League.
          </p>
          <div className="landing-cta">
            <Link to="/live" className="btn btn-primary btn-lg">
              <Radio size={18} /> Watch live stage
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">
              Franchise sign in <ChevronRight size={16} />
            </Link>
          </div>
          {live && (
            <Link to="/live" className="now-playing">
              <i className="live-dot" /> On the block now: <b>{s.player.name}</b> · {s.currentBid ? formatINR(s.currentBid) : `base ${formatINR(s.player.base_price)}`}
            </Link>
          )}
        </div>
      </section>

      {/* Stats Quick Grid */}
      <section className="landing-stats-bar">
        <div className="landing-stat-item">
          <div className="stat-icon-wrap"><Users size={22} /></div>
          <div>
            <b>{franchises.length || 6} Franchises</b>
            <span>Competing teams</span>
          </div>
        </div>
        <div className="landing-stat-item">
          <div className="stat-icon-wrap"><Wallet size={22} /></div>
          <div>
            <b>{formatShort(750000000)}</b>
            <span>Purse per team</span>
          </div>
        </div>
        <div className="landing-stat-item">
          <div className="stat-icon-wrap"><Shield size={22} /></div>
          <div>
            <b>12 Players</b>
            <span>Max squad capacity</span>
          </div>
        </div>
        <div className="landing-stat-item">
          <div className="stat-icon-wrap"><Zap size={22} /></div>
          <div>
            <b>Real-Time</b>
            <span>WebSocket paddle engine</span>
          </div>
        </div>
      </section>

      {/* Franchises Showcase */}
      {franchises.length > 0 && (
        <section className="landing-section">
          <div className="landing-section-head">
            <span className="label">Participating Teams</span>
            <h2>Official JPL Franchises</h2>
            <p className="muted">The teams competing for player contracts in the live auction.</p>
          </div>
          <div className="landing-franchise-grid">
            {franchises.map(f => (
              <div key={f.id} className="landing-franchise-card" style={{ '--team': f.color }}>
                <TeamMark team={f} size={48} />
                <div className="landing-franchise-info">
                  <h3>{f.team_name}</h3>
                  <p className="muted">Owner: {f.owner_name}</p>
                </div>
                <div className="landing-franchise-meta">
                  <span className="gold-text">{formatShort(f.remaining_purse)} purse</span>
                  <span className="squad-tag">{f.squad_count}/{f.max_squad_size} players</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* How It Works Section */}
      <section className="landing-section landing-section-alt">
        <div className="landing-section-head">
          <span className="label">Auction Mechanics</span>
          <h2>How The JPL Auction Works</h2>
          <p className="muted">Built for maximum transparency, speed, and competitive strategy.</p>
        </div>
        <div className="landing-steps-grid">
          <div className="landing-step-card">
            <div className="step-num">01</div>
            <Gavel size={28} className="step-icon" />
            <h3>Dynamic Base Price Tiers</h3>
            <p>Players are rated across Batters, Bowlers, All-rounders & Keepers, establishing base price tiers from ₹1 Cr up to ₹4 Cr.</p>
          </div>
          <div className="landing-step-card">
            <div className="step-num">02</div>
            <Zap size={28} className="step-icon" />
            <h3>Instant Paddle Bids</h3>
            <p>Franchise owners bid live using high-speed WebSocket connections with real-time purse validation and instant outbid tracking.</p>
          </div>
          <div className="landing-step-card">
            <div className="step-num">03</div>
            <Award size={28} className="step-icon" />
            <h3>Roster & Purse Enforcement</h3>
            <p>The engine enforces squad caps (max 12), role composition, and purse floor reservations for remaining empty slots.</p>
          </div>
        </div>
      </section>

      {/* Platform Features Grid */}
      <section className="landing-section">
        <div className="landing-section-head">
          <span className="label">Platform Features</span>
          <h2>Designed For Tournament Excellence</h2>
        </div>
        <div className="landing-features-grid">
          <div className="feature-card">
            <CheckCircle2 className="feature-icon" size={20} />
            <div>
              <h4>Live Broadcast Screen</h4>
              <p>Full-screen stadium view featuring dynamic timer rings, sound effects, hammer animations, and leaderboards.</p>
            </div>
          </div>
          <div className="feature-card">
            <CheckCircle2 className="feature-icon" size={20} />
            <div>
              <h4>Real-Time Standings</h4>
              <p>Automated live rankings calculated from total ICC ranking points, batting stats, and bowling figures.</p>
            </div>
          </div>
          <div className="feature-card">
            <CheckCircle2 className="feature-icon" size={20} />
            <div>
              <h4>Complete Auction Logs</h4>
              <p>Detailed event log recording every bid attempt, price escalation, sold timestamp, and unsold player lot.</p>
            </div>
          </div>
          <div className="feature-card">
            <CheckCircle2 className="feature-icon" size={20} />
            <div>
              <h4>Multi-Device Control</h4>
              <p>Seamlessly optimized across mobile phones, tablets, broadcast monitors, and desktop control centers.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Action Links */}
      <section className="landing-links">
        <Link to="/live" className="landing-link">
          <Radio size={24} />
          <b>Live Broadcast Stage</b>
          <span>Watch the auction hammer live with audio effects & real-time bid updates.</span>
        </Link>
        <Link to="/history" className="landing-link">
          <ListOrdered size={24} />
          <b>Auction Results & History</b>
          <span>Browse all sold & unsold players with final purchase prices and team rosters.</span>
        </Link>
      </section>

      {/* Footer with Creator Credits */}
      <footer className="landing-foot">
        <div className="landing-foot-inner">
          <div className="landing-foot-brand">
            <b>JPL</b> · JCC Cricket Sports Meet 2026
          </div>
          <div className="landing-foot-credits">
            Designed by <strong>Aditya Kaushik</strong> and <strong>Arav Aswal</strong>
          </div>
        </div>
      </footer>
    </div>
  )
}
