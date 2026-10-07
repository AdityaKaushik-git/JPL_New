import { useMemo } from 'react'
import { Trophy, Award, Medal, Crown, Sparkles } from 'lucide-react'
import TeamMark from '../TeamMark'
import { formatINR, formatShort } from '../../lib/format'

/**
 * Broadcast-quality animated Live Rankings & Final Standings View.
 * Displays the podium for top 3 teams and a full animated leaderboard.
 * Perfectly scaled for mobile, tablet, laptop, and desktop viewports.
 * No emojis — clean SVG icons & typography.
 */
export default function LiveRankingsView({ teams = [], onSelectTeam }) {
  // Sort teams according to official tie-breaker rules:
  // 1. Total ICC Ranking Points (descending)
  // 2. Remaining Purse (descending)
  // 3. Batsmen Ranking Points (descending)
  const rankedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      const ptsA = Number(a.total_player_points || 0)
      const ptsB = Number(b.total_player_points || 0)
      if (ptsB !== ptsA) return ptsB - ptsA

      const purseA = Number(a.remaining_purse || 0)
      const purseB = Number(b.remaining_purse || 0)
      if (purseB !== purseA) return purseB - purseA

      const batA = Number(a.batsmen_points || 0)
      const batB = Number(b.batsmen_points || 0)
      return batB - batA
    })
  }, [teams])

  const champion = rankedTeams[0]
  const runnerUp = rankedTeams[1]
  const thirdPlace = rankedTeams[2]

  return (
    <div className="live-rankings-wrapper">
      {/* Background ambient animation glow */}
      <div className="rankings-ambient-glow" />

      {/* Header Title Banner */}
      <div className="rankings-hero-head">
        <div className="rankings-title-badge">
          <Sparkles size={14} className="sparkle-icon" />
          <span>OFFICIAL AUCTION STANDINGS & RANKINGS</span>
          <Sparkles size={14} className="sparkle-icon" />
        </div>
        <h1 className="rankings-main-title">
          <Trophy size={32} className="trophy-gold" />
          JPL Champions & Ranking Standings
        </h1>
        <p className="rankings-subtitle">
          Official ICC T20 Points & Franchise Leaderboard
        </p>
      </div>

      {/* Podium Showcase for Top 3 */}
      {rankedTeams.length > 0 && (
        <div className="podium-container">
          {/* 2nd Place */}
          {runnerUp && (
            <div
              className="podium-card podium-2"
              onClick={() => onSelectTeam && onSelectTeam(runnerUp.id)}
              style={{ '--team-color': runnerUp.color }}
            >
              <div className="podium-badge badge-silver">
                <Medal size={16} /> RANK #2
              </div>
              <div className="podium-team-logo">
                <TeamMark team={runnerUp} size={52} />
              </div>
              <h3 className="podium-team-name">{runnerUp.team_name}</h3>
              <p className="podium-owner">{runnerUp.owner_name}</p>
              <div className="podium-score">
                <span className="score-val">
                  {(Number(runnerUp.total_player_points) || 0).toLocaleString('en-IN')}
                </span>
                <span className="score-lbl">ICC Points</span>
              </div>
              <div className="podium-substats">
                <span>Purse: {formatShort(runnerUp.remaining_purse)}</span>
                <span>Bat Pts: {(Number(runnerUp.batsmen_points) || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          {/* 1st Place (Champion) */}
          {champion && (
            <div
              className="podium-card podium-1"
              onClick={() => onSelectTeam && onSelectTeam(champion.id)}
              style={{ '--team-color': champion.color }}
            >
              <div className="champion-crown">
                <Crown size={30} className="crown-icon" />
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
                <span className="score-lbl">Total ICC Points</span>
              </div>
              <div className="podium-substats">
                <span>Purse: {formatShort(champion.remaining_purse)}</span>
                <span>Squad: {champion.squad_count} / {champion.max_squad_size}</span>
                <span>Bat Pts: {(Number(champion.batsmen_points) || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {thirdPlace && (
            <div
              className="podium-card podium-3"
              onClick={() => onSelectTeam && onSelectTeam(thirdPlace.id)}
              style={{ '--team-color': thirdPlace.color }}
            >
              <div className="podium-badge badge-bronze">
                <Award size={16} /> RANK #3
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
                <span className="score-lbl">ICC Points</span>
              </div>
              <div className="podium-substats">
                <span>Purse: {formatShort(thirdPlace.remaining_purse)}</span>
                <span>Bat Pts: {(Number(thirdPlace.batsmen_points) || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="rankings-table-card">
        <div className="table-card-head">
          <h3>Full Franchise Standings ({rankedTeams.length})</h3>
          <span className="muted-hint">Click any franchise to view full squad & breakdown</span>
        </div>

        <div className="rankings-table-wrap">
          <table className="table rankings-table">
            <thead>
              <tr>
                <th className="num-col">Rank</th>
                <th>Franchise</th>
                <th>Owner</th>
                <th className="num-col">ICC Points</th>
                <th className="num-col">Purse Left (TB1)</th>
                <th className="num-col">Batsmen Pts (TB2)</th>
                <th className="num-col">Squad</th>
              </tr>
            </thead>
            <tbody>
              {rankedTeams.map((t, idx) => {
                const rank = idx + 1
                const isTop3 = rank <= 3
                return (
                  <tr
                    key={t.id}
                    className={`rank-row ${isTop3 ? `top-rank-${rank}` : ''}`}
                    onClick={() => onSelectTeam && onSelectTeam(t.id)}
                  >
                    <td className="num-col rank-number-cell">
                      <span className={`rank-pill rank-pill-${rank}`}>
                        {rank === 1 ? (
                          <Trophy size={13} className="trophy-gold" />
                        ) : rank === 2 ? (
                          <Medal size={13} />
                        ) : rank === 3 ? (
                          <Award size={13} />
                        ) : (
                          `#${rank}`
                        )}
                      </span>
                    </td>
                    <td>
                      <span className="team-cell">
                        <TeamMark team={t} size={28} />
                        <div>
                          <b>{t.team_name}</b>
                          <span className="chip-sm muted">{t.short_name}</span>
                        </div>
                      </span>
                    </td>
                    <td>{t.owner_name}</td>
                    <td className="num-col points-highlight">
                      <b>{(Number(t.total_player_points) || 0).toLocaleString('en-IN')}</b>
                    </td>
                    <td className="num-col">{formatShort(t.remaining_purse)}</td>
                    <td className="num-col">{(Number(t.batsmen_points) || 0).toLocaleString('en-IN')}</td>
                    <td className={`num-col ${t.squad_count >= t.max_squad_size ? 'text-success' : 'muted'}`}>
                      {t.squad_count} / {t.max_squad_size}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
