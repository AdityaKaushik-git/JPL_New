/**
 * ============================================================================
 *  JPL PLAYER RANKING — original rating model for the JCC Cricket Sports Meet
 * ============================================================================
 *
 *  Inspired by the idea of professional cricket rankings, but NOT an official
 *  ICC ranking and NOT the ICC formula. Every number below is JPL's own and is
 *  deliberately simple so anyone can audit it.
 *
 *  All component scores are on a 0–1000 scale. A player's final points are a
 *  weighted blend of components for their playing role, then adjusted for
 *  experience (small samples are pulled down) and match impact.
 *
 *  Helper curves
 *  -------------
 *    sat(x, k)          = 1000 × (1 − e^(−x / k))     saturating volume curve:
 *                                                      rewards more runs/wickets,
 *                                                      with diminishing returns.
 *    lin(x, lo, hi)     = 1000 × clamp((x − lo)/(hi − lo), 0, 1)
 *    inv(x, best, worst)= 1000 × clamp((worst − x)/(worst − best), 0, 1)
 *                                                      for "lower is better" stats.
 *
 *  BATTING score (B)
 *  -----------------
 *    runs        sat(runs, 400)                          weight 0.30
 *    average     lin(batting_average, 0, 50)             weight 0.20
 *    strike rate lin(strike_rate, 80, 180)               weight 0.20
 *    milestones  lin(fifties + 2 × hundreds, 0, 6)       weight 0.10
 *    form        form_points × 10   (form_points 0–100)  weight 0.20
 *
 *  BOWLING score (W)
 *  -----------------
 *    wickets     sat(wickets, 20)                        weight 0.25
 *    average     inv(bowling_average, 10, 40)            weight 0.15
 *    economy     inv(economy, 5, 11)                     weight 0.15
 *    strike rate inv(bowling_strike_rate, 10, 30)        weight 0.10
 *    wkts/match  lin(wickets / matches, 0, 2.5)          weight 0.10
 *    hauls       lin(3w + 2 × 4w + 3 × 5w hauls, 0, 6)    weight 0.05
 *    form        form_points × 10                        weight 0.20
 *    (average / economy / strike-rate components are 0 until the player has
 *     bowled at least 6 balls, so a single cheap over cannot top the table.)
 *
 *  ALL-ROUNDER score (AR)
 *    AR = √(B × W)  — geometric mean. It rewards genuine balance: a player who
 *    is excellent at one skill and poor at the other scores lower than one who
 *    is solid at both.
 *
 *  WICKETKEEPER score (WK)
 *    keeping   = sat(catches + 1.5 × stumpings, 12)
 *    WK        = 0.65 × B + 0.35 × keeping
 *
 *  Final points
 *  ------------
 *    base        = role score (Batsman → B, Bowler → W,
 *                  All-Rounder → AR, Wicket Keeper → WK)
 *    experience  = 0.55 + 0.45 × min(1, matches / 6)
 *                  (a player with 6+ matches gets full credit)
 *    impact      = min(60, 15 × player_of_match)
 *    points      = round(base × experience + impact), capped at 1000
 *
 *  Players with 0 matches are UNRANKED (points 0, rank NULL).
 *
 *  Ranks
 *  -----
 *    current_rank         position among all ranked players (overall)
 *    category_rank        position among ranked players with the same role
 *    Ties are broken by: points, then form_points, then matches, then name.
 *
 *  Movement
 *  --------
 *    When a player's rank changes, previous_rank keeps the old value.
 *    When a player's points change, previous_ranking_points keeps the old value.
 *    movement = previous_rank − current_rank   (positive = climbed)
 *    form     = ranking_points − previous_ranking_points
 *    A player's first ranking sets previous_ranking_points = ranking_points
 *    (form 0), because there is no earlier rating to compare against.
 *    Every change is also written to ranking_history for the profile chart.
 * ============================================================================
 */

const ROLE_CATEGORY = {
    'Batsman': 'BATTERS',
    'Bowler': 'BOWLERS',
    'All-Rounder': 'ALL-ROUNDERS',
    'Wicket Keeper': 'WICKETKEEPERS',
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sat = (x, k) => 1000 * (1 - Math.exp(-Math.max(0, x) / k));
const lin = (x, lo, hi) => 1000 * clamp((x - lo) / (hi - lo), 0, 1);
const inv = (x, best, worst) => 1000 * clamp((worst - x) / (worst - best), 0, 1);

/** Derived statistics computed from raw counts. Returns rounded numbers. */
function deriveStats(p) {
    const innings = num(p.innings);
    const notOuts = num(p.not_outs);
    const runs = num(p.runs);
    const balls = num(p.balls_faced);
    const ballsBowled = num(p.balls_bowled);
    const runsConceded = num(p.runs_conceded);
    const wickets = num(p.wickets);

    const dismissals = innings - notOuts;
    const battingAverage = dismissals > 0 ? runs / dismissals : (innings > 0 ? runs : 0);
    const strikeRate = balls > 0 ? (runs / balls) * 100 : 0;
    const economy = ballsBowled > 0 ? runsConceded / (ballsBowled / 6) : 0;
    const bowlingAverage = wickets > 0 ? runsConceded / wickets : 0;
    const bowlingStrikeRate = wickets > 0 ? ballsBowled / wickets : 0;

    return {
        batting_average: round2(battingAverage),
        strike_rate: round2(strikeRate),
        economy: round2(economy),
        bowling_average: round2(bowlingAverage),
        bowling_strike_rate: round2(bowlingStrikeRate),
    };
}

function round2(x) { return Math.round(x * 100) / 100; }

function battingScore(p) {
    const d = deriveStats(p);
    const form = clamp(num(p.form_points), 0, 100) * 10;
    return 0.30 * sat(num(p.runs), 400)
        + 0.20 * lin(d.batting_average, 0, 50)
        + 0.20 * (num(p.balls_faced) > 0 ? lin(d.strike_rate, 80, 180) : 0)
        + 0.10 * lin(num(p.fifties) + 2 * num(p.hundreds), 0, 6)
        + 0.20 * form;
}

function bowlingScore(p) {
    const d = deriveStats(p);
    const matches = num(p.matches);
    const wickets = num(p.wickets);
    const bowled = num(p.balls_bowled) >= 6;
    const form = clamp(num(p.form_points), 0, 100) * 10;
    const hauls = num(p.three_wkt_hauls) + 2 * num(p.four_wkt_hauls) + 3 * num(p.five_wkt_hauls);
    return 0.25 * sat(wickets, 20)
        + 0.15 * (bowled && wickets > 0 ? inv(d.bowling_average, 10, 40) : 0)
        + 0.15 * (bowled ? inv(d.economy, 5, 11) : 0)
        + 0.10 * (bowled && wickets > 0 ? inv(d.bowling_strike_rate, 10, 30) : 0)
        + 0.10 * (matches > 0 ? lin(wickets / matches, 0, 2.5) : 0)
        + 0.05 * lin(hauls, 0, 6)
        + 0.20 * form;
}

function keepingScore(p) {
    return sat(num(p.catches) + 1.5 * num(p.stumpings), 12);
}

/** Returns { points, batting, bowling, allround, keeping } for one player. */
function computePoints(p) {
    const matches = num(p.matches);
    const B = battingScore(p);
    const W = bowlingScore(p);
    const AR = Math.sqrt(B * W);
    const K = keepingScore(p);
    const WK = 0.65 * B + 0.35 * K;

    if (matches <= 0) {
        return { points: 0, batting: 0, bowling: 0, allround: 0, keeping: 0 };
    }

    let base;
    switch (p.playing_role) {
        case 'Bowler': base = W; break;
        case 'All-Rounder': base = AR; break;
        case 'Wicket Keeper': base = WK; break;
        case 'Batsman':
        default: base = B; break;
    }

    const experience = 0.55 + 0.45 * Math.min(1, matches / 6);
    const impact = Math.min(60, 15 * num(p.player_of_match));
    const points = Math.min(1000, Math.round(base * experience + impact));

    return {
        points,
        batting: Math.round(B),
        bowling: Math.round(W),
        allround: Math.round(AR),
        keeping: Math.round(K),
    };
}

function sortForRank(a, b) {
    return (b.newPoints - a.newPoints)
        || (num(b.form_points) - num(a.form_points))
        || (num(b.matches) - num(a.matches))
        || String(a.name).localeCompare(String(b.name));
}

/**
 * Recomputes derived stats, points and ranks for every player inside one
 * transaction and records history rows for anything that changed.
 * Accepts an optional existing connection (already in a transaction).
 */
async function recalculateRankings(pool, existingConnection = null) {
    const connection = existingConnection || await pool.getConnection();
    const ownTransaction = !existingConnection;
    try {
        if (ownTransaction) await connection.beginTransaction();

        const [players] = await connection.query('SELECT * FROM players FOR UPDATE');

        for (const p of players) {
            const derived = deriveStats(p);
            Object.assign(p, derived);
            p.newPoints = computePoints(p).points;
            p.ranked = num(p.matches) > 0;
        }

        const ranked = players.filter(p => p.ranked).sort(sortForRank);
        ranked.forEach((p, i) => { p.newRank = i + 1; });

        const byCategory = {};
        for (const p of ranked) {
            const cat = p.playing_role;
            byCategory[cat] = byCategory[cat] || [];
            byCategory[cat].push(p);
        }
        Object.values(byCategory).forEach(list => list.forEach((p, i) => { p.newCategoryRank = i + 1; }));

        let changed = 0;
        for (const p of players) {
            const newRank = p.ranked ? p.newRank : null;
            const newCatRank = p.ranked ? p.newCategoryRank : null;
            const oldRank = p.current_rank === null ? null : num(p.current_rank);
            const oldCatRank = p.category_rank === null ? null : num(p.category_rank);
            const oldPoints = num(p.ranking_points);

            const pointsChanged = oldPoints !== p.newPoints;
            // First time a player is ranked there is no earlier rating to compare with,
            // so the baseline becomes the new rating (form = 0, shown as "new").
            const firstRanking = oldRank === null && newRank !== null && oldPoints === 0;
            const rankChanged = oldRank !== newRank;
            const catRankChanged = oldCatRank !== newCatRank;

            const previousPoints = firstRanking ? p.newPoints
                : pointsChanged ? oldPoints : num(p.previous_ranking_points);
            const previousRank = rankChanged ? oldRank : (p.previous_rank === null ? null : num(p.previous_rank));
            const previousCatRank = catRankChanged ? oldCatRank : (p.previous_category_rank === null ? null : num(p.previous_category_rank));

            await connection.query(
                `UPDATE players SET
                    batting_average = ?, strike_rate = ?, economy = ?, bowling_average = ?, bowling_strike_rate = ?,
                    ranking_points = ?, previous_ranking_points = ?,
                    current_rank = ?, previous_rank = ?,
                    category_rank = ?, previous_category_rank = ?
                 WHERE id = ?`,
                [
                    p.batting_average, p.strike_rate, p.economy, p.bowling_average, p.bowling_strike_rate,
                    p.newPoints, previousPoints,
                    newRank, previousRank,
                    newCatRank, previousCatRank,
                    p.id,
                ]
            );

            if (pointsChanged || rankChanged || catRankChanged) {
                changed++;
                await connection.query(
                    'INSERT INTO ranking_history (player_id, ranking_points, overall_rank, category_rank) VALUES (?, ?, ?, ?)',
                    [p.id, p.newPoints, newRank, newCatRank]
                );
            }
        }

        if (ownTransaction) await connection.commit();
        return { players: players.length, ranked: ranked.length, changed };
    } catch (err) {
        if (ownTransaction) await connection.rollback();
        throw err;
    } finally {
        if (ownTransaction) connection.release();
    }
}

module.exports = {
    ROLE_CATEGORY,
    deriveStats,
    computePoints,
    battingScore,
    bowlingScore,
    keepingScore,
    recalculateRankings,
};
