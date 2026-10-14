import { useState, useMemo } from 'react'
import {
  Trophy,
  Award,
  Medal,
  Crown,
  Sparkles,
  Activity,
  Eye,
  EyeOff,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Users,
  Wallet
} from 'lucide-react'
import TeamMark from '../TeamMark'
import { formatINR, formatShort } from '../../lib/format'

// Broadcast-quality responsive Declared Results and Live Rankings View for laptops and mobile phones.
export default function LiveRankingsView({
  teams = [],
  onSelectTeam,
  isDeclared = true,
  isAdmin = false,
  showRankings = false,
  onToggleRankings,
  initialView = 'declared',
}) {
  const [viewMode, setViewMode] = useState(initialView || 'declared')

  // Sort active teams according to official tie-breaker rules:
  // 1. Total ICC Ranking Points (descending)
  // 2. Remaining Purse (descending)
  // 3. Batsmen Ranking Points (descending)
  // 4. Squad Count (descending)
  // 5. Team Name (alphabetical)
  const sortedTeams = useMemo(() => {
    return [...teams]
      .filter(t => t && t.status !== 'disabled')
      .sort((a, b) => {
        const ptsA = Number(a.total_player_points || 0)
        const ptsB = Number(b.total_player_points || 0)
        if (ptsB !== ptsA) return ptsB - ptsA

        const purseA = Number(a.remaining_purse || 0)
        const purseB = Number(b.remaining_purse || 0)
        if (purseB !== purseA) return purseB - purseA

        const batA = Number(a.batsmen_points || 0)
        const batB = Number(b.batsmen_points || 0)
        if (batB !== batA) return batB - batA

        const squadA = Number(a.squad_count || 0)
        const squadB = Number(b.squad_count || 0)
        if (squadB !== squadA) return squadB - squadA

        return (a.team_name || '').localeCompare(b.team_name || '')
      })
  }, [teams])

  // Rule: franchises must complete 15 players to qualify. Incomplete squads are disqualified and excluded from declared result.
  const qualifiedTeams = useMemo(() => {
    return sortedTeams.filter(t => (Number(t.squad_count) || 0) >= 15)
  }, [sortedTeams])

  const disqualifiedTeams = useMemo(() => {
    return sortedTeams.filter(t => (Number(t.squad_count) || 0) < 15)
  }, [sortedTeams])

  const activeTeams = viewMode === 'declared' ? qualifiedTeams : sortedTeams
  const champion = activeTeams[0]
  const runnerUp = activeTeams[1]
  const thirdPlace = activeTeams[2]

  return (
    <div className="live-rankings-wrapper">
      {/* Background ambient animation glow */}
      <div className="rankings-ambient-glow" aria-hidden="true" />

      {/* Header Title Banner */}
      <header className="rankings-hero-head">
        <div className="rankings-title-badge">
          <Sparkles size={14} className="sparkle-icon" />
          <span>{isDeclared ? 'OFFICIAL AUCTION RESULTS DECLARED' : 'LIVE AUCTION RANKINGS'}</span>
          <Sparkles size={14} className="sparkle-icon" />
        </div>

        <h1 className="rankings-main-title">
          <Trophy size={36} className="trophy-gold" />
          {viewMode === 'declared' ? 'Official Declared Results' : 'Live Rankings Leaderboard'}
        </h1>

        <p className="rankings-subtitle">
          {viewMode === 'declared'
            ? 'Official championship standings. Franchises must complete all 15 player slots to qualify.'
            : 'Real-time standings based on total ICC player ranking points.'}
        </p>

        {/* View Switcher Tabs & Admin Control */}
        <div className="rankings-toolbar">
          <div className="rankings-tabs">
            <button
              type="button"
              onClick={() => setViewMode('declared')}
              className={`rankings-tab-btn ${viewMode === 'declared' ? 'is-active' : ''}`}
            >
              <Trophy size={15} />
              <span>Official Declared Results</span>
              <span className="tab-pill">{qualifiedTeams.length} Qualified</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('live')}
              className={`rankings-tab-btn ${viewMode === 'live' ? 'is-active' : ''}`}
            >
              <Activity size={15} />
              <span>Live Rankings</span>
              <span className="tab-pill">{sortedTeams.length} Franchises</span>
            </button>
          </div>

          {isAdmin && onToggleRankings && (
            <button
              type="button"
              className={`btn btn-sm ${showRankings ? 'btn-success' : 'btn-ghost'}`}
              onClick={onToggleRankings}
              title="Toggle public visibility of declared results"
            >
              {showRankings ? <Eye size={15} /> : <EyeOff size={15} />}
              <span>Declare Result: {showRankings ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Top 3 Champions Podium (if we have teams in active view) */}
      {activeTeams.length > 0 && (
        <section className="podium-section" aria-label="Top 3 Standings Podium">
          <div className="podium-container">
            {/* 2nd Place (Left on Laptop, 2nd on Mobile) */}
            {runnerUp && (
              <div
                className="podium-card podium-2"
                onClick={() => onSelectTeam && onSelectTeam(runnerUp)}
                style={{ '--team-color': runnerUp.color || '#94a3b8' }}
                role="button"
                tabIndex={0}
                aria-label={`Rank 2: ${runnerUp.team_name}`}
              >
                <div className="podium-badge badge-silver">
                  <Medal size={15} /> RANK #2
                </div>
                <div className="podium-team-logo">
                  <TeamMark team={runnerUp} size={48} />
                </div>
                <h3 className="podium-team-name">{runnerUp.team_name}</h3>
                <p className="podium-owner">{runnerUp.owner_name}</p>

                <div className="podium-score">
                  <span className="score-val">
                    {(Number(runnerUp.total_player_points) || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="score-lbl">Total ICC Points</span>
                </div>

                <div className="podium-substats">
                  <span>Purse: {formatShort(runnerUp.remaining_purse)}</span>
                  <span>Squad: {runnerUp.squad_count}/{runnerUp.max_squad_size || 15}</span>
                </div>
              </div>
            )}

            {/* 1st Place (Center elevated on Laptop, 1st on Mobile) */}
            {champion && (
              <div
                className="podium-card podium-1"
                onClick={() => onSelectTeam && onSelectTeam(champion)}
                style={{ '--team-color': champion.color || '#f2c14e' }}
                role="button"
                tabIndex={0}
                aria-label={`Champion Rank 1: ${champion.team_name}`}
              >
                <div className="champion-crown" aria-hidden="true">
                  <Crown size={32} className="crown-icon" />
                </div>
                <div className="podium-badge badge-gold">
                  <Trophy size={16} /> CHAMPION #1
                </div>
                <div className="podium-team-logo logo-champ">
                  <TeamMark team={champion} size={64} />
                </div>
                <h2 className="podium-team-name champ-name">{champion.team_name}</h2>
                <p className="podium-owner">{champion.owner_name}</p>

                <div className="podium-score score-champ">
                  <span className="score-val">
                    {(Number(champion.total_player_points) || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="score-lbl">Championship ICC Points</span>
                </div>

                <div className="podium-substats">
                  <span>Purse: {formatShort(champion.remaining_purse)}</span>
                  <span>Squad: {champion.squad_count}/{champion.max_squad_size || 15}</span>
                  <span>Bat Pts: {(Number(champion.batsmen_points) || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            {/* 3rd Place (Right on Laptop, 3rd on Mobile) */}
            {thirdPlace && (
              <div
                className="podium-card podium-3"
                onClick={() => onSelectTeam && onSelectTeam(thirdPlace)}
                style={{ '--team-color': thirdPlace.color || '#f97316' }}
                role="button"
                tabIndex={0}
                aria-label={`Rank 3: ${thirdPlace.team_name}`}
              >
                <div className="podium-badge badge-bronze">
                  <Award size={15} /> RANK #3
                </div>
                <div className="podium-team-logo">
                  <TeamMark team={thirdPlace} size={48} />
                </div>
                <h3 className="podium-team-name">{thirdPlace.team_name}</h3>
                <p className="podium-owner">{thirdPlace.owner_name}</p>

                <div className="podium-score">
                  <span className="score-val">
                    {(Number(thirdPlace.total_player_points) || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="score-lbl">Total ICC Points</span>
                </div>

                <div className="podium-substats">
                  <span>Purse: {formatShort(thirdPlace.remaining_purse)}</span>
                  <span>Squad: {thirdPlace.squad_count}/{thirdPlace.max_squad_size || 15}</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main Leaderboard Section */}
      <section className="rankings-table-card">
        <div className="table-card-head">
          <div className="table-head-info">
            <h3>
              {viewMode === 'declared'
                ? `Qualified Franchises Leaderboard (${qualifiedTeams.length})`
                : `Complete Franchise Leaderboard (${sortedTeams.length})`}
            </h3>
            <span className="muted-hint">
              Tap or click any franchise to inspect full squad and bidding breakdown
            </span>
          </div>

          <div className="table-head-legend">
            <span className="legend-chip">
              <CheckCircle2 size={13} className="text-success" />
              <span>Rule: 15 Squad Slots Required</span>
            </span>
          </div>
        </div>

        {/* Empty Qualified State (if declared mode and no qualified yet) */}
        {viewMode === 'declared' && qualifiedTeams.length === 0 ? (
          <div className="rankings-empty-state">
            <AlertTriangle size={36} className="text-warning" />
            <h4>No Qualified Franchises in Official Results Yet</h4>
            <p>
              According to tournament rules, every franchise must complete all 15 player slots to be ranked in the declared results.
              Any franchise with fewer than 15 players is termed disqualified.
            </p>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setViewMode('live')}
            >
              <Activity size={14} /> Switch to Live Rankings to View Real-Time Standings
            </button>
          </div>
        ) : (
          /* Responsive Cards List for Laptops & Mobile Phones */
          <div className="rankings-list" role="list">
            {activeTeams.map((t, idx) => {
              const rank = idx + 1
              const is1st = rank === 1
              const is2nd = rank === 2
              const is3rd = rank === 3

              let rankBadgeClass = 'rank-badge'
              if (is1st) rankBadgeClass += ' is-gold'
              else if (is2nd) rankBadgeClass += ' is-silver'
              else if (is3rd) rankBadgeClass += ' is-bronze'

              return (
                <div
                  key={t.id}
                  className={`ranking-card ${is1st ? 'is-champ-card' : ''} ${is2nd ? 'is-silver-card' : ''} ${is3rd ? 'is-bronze-card' : ''}`}
                  style={{ '--team': t.color || 'var(--brand)' }}
                  onClick={() => onSelectTeam && onSelectTeam(t)}
                  role="listitem"
                  tabIndex={0}
                >
                  {/* Left: Rank & Team Identity */}
                  <div className="rc-left">
                    <div className={rankBadgeClass}>
                      {is1st ? (
                        <Trophy size={16} className="trophy-gold" />
                      ) : is2nd ? (
                        <Medal size={16} />
                      ) : is3rd ? (
                        <Award size={16} />
                      ) : (
                        `#${rank}`
                      )}
                    </div>

                    <div className="rc-logo">
                      <TeamMark team={t} size={44} />
                    </div>

                    <div className="rc-info">
                      <div className="rc-name-row">
                        <h4 className="rc-name">{t.team_name}</h4>
                        {is1st && viewMode === 'declared' && (
                          <span className="rc-champ-tag">CHAMPION</span>
                        )}
                        {t.short_name && (
                          <span className="rc-short-tag">{t.short_name}</span>
                        )}
                      </div>
                      <span className="rc-owner">{t.owner_name}</span>
                    </div>
                  </div>

                  {/* Center: Squad Composition Breakdown */}
                  <div className="rc-composition">
                    <span className="rc-chip" title="Batsmen">
                      BAT: <b>{t.batsmen_count || 0}</b>
                    </span>
                    <span className="rc-chip" title="Bowlers">
                      BOWL: <b>{t.bowlers_count || 0}</b>
                    </span>
                    <span className="rc-chip" title="All-Rounders">
                      AR: <b>{t.allrounders_count || 0}</b>
                    </span>
                    <span className="rc-chip" title="Wicket Keepers">
                      WK: <b>{t.keepers_count || 0}</b>
                    </span>
                    <span className="rc-chip" title="Indian Players (Min 3 required)">
                      IND: <b>{t.indian_count || 0}/3</b>
                    </span>
                    <span className="rc-chip" title="Overseas Players">
                      OS: <b>{t.foreign_count || 0}</b>
                    </span>
                  </div>

                  {/* Right: Purse, Squad count, & Points */}
                  <div className="rc-stats">
                    <div className="rc-stat-item purse-item">
                      <span className="rc-stat-val">{formatShort(t.remaining_purse)}</span>
                      <span className="rc-stat-label">Purse Left</span>
                    </div>

                    <div className={`rc-stat-item squad-item ${t.squad_count >= 15 ? 'is-complete' : 'is-pending'}`}>
                      <span className="rc-stat-val">{t.squad_count}/{t.max_squad_size || 15}</span>
                      <span className="rc-stat-label">Squad</span>
                    </div>

                    <div className="rc-points-box">
                      <span className="rc-points-val">
                        {(Number(t.total_player_points) || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="rc-points-label">Total ICC Points</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Disqualified Section (in Declared View) */}
        {viewMode === 'declared' && disqualifiedTeams.length > 0 && (
          <div className="disqualified-section">
            <div className="disqualified-header">
              <div className="disqualified-badge">
                <Ban size={14} />
                <span>DISQUALIFIED FRANCHISES ({disqualifiedTeams.length})</span>
              </div>
              <p className="disqualified-desc">
                Tournament qualification rule: Each franchise must complete all 15 player slots to be eligible for official declared results.
                The franchises below have fewer than 15 players and are excluded from tournament podium standings.
              </p>
            </div>

            <div className="disqualified-list" role="list">
              {disqualifiedTeams.map(t => (
                <div
                  key={t.id}
                  className="disqualified-card"
                  onClick={() => onSelectTeam && onSelectTeam(t)}
                  role="listitem"
                  tabIndex={0}
                >
                  <div className="dq-left">
                    <span className="dq-rank-tag">DISQUALIFIED</span>
                    <div className="dq-logo">
                      <TeamMark team={t} size={38} />
                    </div>
                    <div className="dq-info">
                      <h4 className="dq-name">{t.team_name}</h4>
                      <span className="dq-owner">{t.owner_name}</span>
                    </div>
                  </div>

                  <div className="dq-warning-badge">
                    <AlertTriangle size={14} />
                    <span>Incomplete Squad: {t.squad_count || 0}/15 Players</span>
                  </div>

                  <div className="dq-stats">
                    <div className="dq-stat">
                      <span className="dq-stat-val">{formatShort(t.remaining_purse)}</span>
                      <span className="dq-stat-label">Purse Left</span>
                    </div>
                    <div className="dq-points">
                      <span className="dq-pts-val">
                        {(Number(t.total_player_points) || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="dq-pts-label">Points (Excluded)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
