import { Link } from 'react-router-dom'
import { Radio, ListOrdered, ArrowRight, Calendar, Clock, MapPin, Building2, Shield, Coins, Gavel, Trophy, Layers, CheckCircle2 } from 'lucide-react'
import PitchBackdrop from '../components/PitchBackdrop'
import RoleIcon from '../components/RoleIcon'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { formatINR } from '../lib/format'

// Public front door for JPL Auction.
export default function Landing() {
  const status = useAsync(() => api.getAuctionStatus(), [])
  const s = status.data
  const live = s && ['Live', 'Paused'].includes(s.status) && s.player

  return (
    <div className="landing">
      {/* Hero Section*/}
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

      {/* Event Details Bar*/}
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

      {/* Official Rules & Guidelines Section*/}
      <section className="landing-rules-section">
        <div className="landing-rules-head">
          <span className="label">Official Tournament Regulations</span>
          <h2>JPL Cricket Auction Rules & Guidelines</h2>
          <p className="muted">Official rules for participating franchises in the JCC Premiere League Auction.</p>
        </div>

        <div className="rules-grid">
          {/* Card 1: Team Purse & Squad Checklist*/}
          <div className="rule-card rule-card-highlight landing-fade-up delay-1">
            <div className="rule-card-header">
              <Coins className="rule-icon" size={22} />
              <h3>1. Team Purse & Squad Checklist</h3>
            </div>
            <ul className="rule-list">
              <li><span>Virtual Purse Budget:</span> <b>₹75 Crore</b></li>
              <li><span>Squad Capacity:</span> <b>Exactly 15 Players</b></li>
              <li><span>Team Size:</span> <b>4 Students</b> per franchise</li>
              <li><span>Foreign Players Cap:</span> <b>Max 4 Foreign Players</b></li>
              <li><span>Uncapped Players Requirement:</span> <b>Min 2 Uncapped Players</b></li>
            </ul>
            <div className="rule-checklist-box">
              <span className="checklist-title">Required Squad Composition (15 Total)</span>
              <div className="squad-roles-grid">
                <div className="squad-role-item">
                  <span className="role-lbl"><RoleIcon role="bat" size={13} /> Batsmen</span>
                  <b className="role-cap">5 Players</b>
                </div>
                <div className="squad-role-item">
                  <span className="role-lbl"><RoleIcon role="bowl" size={13} /> Bowlers</span>
                  <b className="role-cap">5 Players</b>
                </div>
                <div className="squad-role-item">
                  <span className="role-lbl"><RoleIcon role="wk" size={13} /> Keepers</span>
                  <b className="role-cap">2 Players</b>
                </div>
                <div className="squad-role-item">
                  <span className="role-lbl"><RoleIcon role="ar" size={13} /> All-Rounders</span>
                  <b className="role-cap">3 Players</b>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Bidding Increments Table*/}
          <div className="rule-card landing-fade-up delay-2">
            <div className="rule-card-header">
              <Gavel className="rule-icon" size={22} />
              <h3>2. Bidding Increment Ladder</h3>
            </div>
            <p className="rule-subtext">Minimum required bid increase per price range:</p>
            <div className="table-scroll increment-table-wrap">
              <table className="table rule-table">
                <thead>
                  <tr>
                    <th>Current Bid Range</th>
                    <th>Min Increase</th>
                    <th>Example Step</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>₹10 Lakh – ₹50 Lakh</td>
                    <td><b className="gold-text">₹5 Lakh</b></td>
                    <td>₹10L → ₹15L → ₹20L</td>
                  </tr>
                  <tr>
                    <td>₹50 Lakh – ₹1 Crore</td>
                    <td><b className="gold-text">₹10 Lakh</b></td>
                    <td>₹50L → ₹60L → ₹70L</td>
                  </tr>
                  <tr>
                    <td>₹1 Crore – ₹2 Crore</td>
                    <td><b className="gold-text">₹25 Lakh</b></td>
                    <td>₹1.00Cr → ₹1.25Cr</td>
                  </tr>
                  <tr>
                    <td>₹2 Crore – ₹5 Crore</td>
                    <td><b className="gold-text">₹50 Lakh</b></td>
                    <td>₹2.00Cr → ₹2.50Cr</td>
                  </tr>
                  <tr>
                    <td>₹5 Crore – ₹10 Crore</td>
                    <td><b className="gold-text">₹1 Crore</b></td>
                    <td>₹5Cr → ₹6Cr → ₹7Cr</td>
                  </tr>
                  <tr>
                    <td>₹10 Crore – ₹20 Crore</td>
                    <td><b className="gold-text">₹2 Crore</b></td>
                    <td>₹10Cr → ₹12Cr → ₹14Cr</td>
                  </tr>
                  <tr>
                    <td>Above ₹20 Crore</td>
                    <td><b className="gold-text">₹5 Crore</b></td>
                    <td>₹20Cr → ₹25Cr → ₹30Cr</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: Auction Set System & Unsold Round*/}
          <div className="rule-card landing-fade-up delay-3">
            <div className="rule-card-header">
              <Layers className="rule-icon" size={22} />
              <h3>3. Auction Set System & Unsold Rules</h3>
            </div>
            <ul className="rule-list">
              <li><span>Category Sets:</span> <b>Rank 1–10, 11–20, 21–30...</b></li>
              <li><span>Sequential Order:</span> <b>Batsmen → Bowlers → Keepers → All-Rounders</b></li>
              <li><span>Unsold Players:</span> <b>Marked Unsold if no bids</b></li>
              <li><span>Final Unsold Round:</span> <b>Returned for final re-bids</b></li>
            </ul>
            <div className="rule-note-box">
              <CheckCircle2 size={16} className="text-turf" />
              <span>Bidding requires valid purse floor balance, remaining role slots, max 4 foreign cap, and min 2 uncapped slots.</span>
            </div>
          </div>

          {/* Card 4: Winner & Tie-Breaker Criteria*/}
          <div className="rule-card landing-fade-up delay-4">
            <div className="rule-card-header">
              <Trophy className="rule-icon" size={22} />
              <h3>4. Winner & Tie-Breaker Criteria</h3>
            </div>
            <div className="winner-rule-box">
              <span className="winner-label"><Trophy size={16} /> Overall Champion</span>
              <p>The team with the <b>highest total ICC T20 ranking points</b> aggregated across its final 15-player squad.</p>
            </div>
            <div className="tiebreaker-list">
              <div className="tb-item">
                <span className="tb-tag">Tie-Breaker 1</span>
                <span>Team with the <b>higher remaining purse</b> is declared winner.</span>
              </div>
              <div className="tb-item">
                <span className="tb-tag">Tie-Breaker 2</span>
                <span>If purse is equal, comparing total <b>ICC ranking points of Batsmen</b>.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Direct Quick Links*/}
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

      {/* Footer with Creator Credits*/}
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
