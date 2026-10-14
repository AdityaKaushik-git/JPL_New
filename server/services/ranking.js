// ============================================================================

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

// Derived statistics computed from raw counts.
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

// Returns { points, batting, bowling, allround, keeping } for one player.
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

// Auto base price from JPL ranking points (transparent, documented formula).
function basePriceFromPoints(points) {
    const p = Math.round(Number(points) || 0);
    if (p >= 900) return 40000000; // ₹4 Cr
    if (p >= 800) return 30000000; // ₹3 Cr
    if (p >= 700) return 20000000; // ₹2 Cr
    if (p >= 600) return 15000000; // ₹1.5 Cr
    if (p >= 500) return 10000000; // ₹1 Cr
    if (p >= 400) return  5000000; // ₹50 L
    if (p >= 300) return  2500000; // ₹25 L
    if (p >= 200) return  1000000; // ₹10 L
    if (p >= 100) return   500000; // ₹5 L
    if (p >= 1)   return   200000; // ₹2 L
    return 100000;                 // ₹1 L (unranked minimum)
}

function sortForRank(a, b) {
    return (b.newPoints - a.newPoints)
        || (num(b.form_points) - num(a.form_points))
        || (num(b.matches) - num(a.matches))
        || String(a.name).localeCompare(String(b.name));
}

// Fisher-Yates array shuffle helper
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Builds the player auction queue following the 10-player role slot rule:
// Set 1: 10 random Batsmen, 10 random Bowlers, 10 random Wicket Keepers, 10 random All-Rounders
// Set 2: next 10 random Batsmen, 10 Bowlers, 10 Keepers, 10 All-Rounders, etc.
function buildSlotOrderedQueue(players, { randomize = true } = {}) {
    const roleSeq = ['Batsman', 'Bowler', 'Wicket Keeper', 'All-Rounder'];

    // If an auction is partially underway (some players Sold, Unsold, or In Auction),
    // preserve those finished/in-action players at their existing order, and randomize remaining Available players.
    // When all players are Available (fresh or reset session), all players are ordered 1 to N.
    const nonAvailable = players.filter(p => p.status && p.status !== 'Available');
    const available = players.filter(p => !p.status || p.status === 'Available');

    nonAvailable.sort((a, b) => Number(a.auction_order ?? a.id) - Number(b.auction_order ?? b.id));

    // Group available players by role
    const byRole = {};
    for (const role of roleSeq) {
        byRole[role] = [];
    }
    const otherAvailable = [];

    for (const p of available) {
        if (byRole[p.playing_role]) {
            byRole[p.playing_role].push(p);
        } else {
            otherAvailable.push(p);
        }
    }

    // Shuffle players within each role randomly (or preserve order if randomize=false)
    for (const role of roleSeq) {
        byRole[role] = randomize ? shuffleArray(byRole[role]) : byRole[role];
    }
    const orderedOthers = randomize ? shuffleArray(otherAvailable) : otherAvailable;

    const maxLen = Math.max(
        byRole['Batsman'].length,
        byRole['Bowler'].length,
        byRole['Wicket Keeper'].length,
        byRole['All-Rounder'].length
    );
    const maxSets = Math.max(1, Math.ceil(maxLen / 10));

    const setOrdered = [];
    for (let s = 0; s < maxSets; s++) {
        const start = s * 10;
        const end = start + 10;
        for (const role of roleSeq) {
            const list = byRole[role] || [];
            const chunk = list.slice(start, end);
            setOrdered.push(...chunk);
        }
    }

    const setIds = new Set(setOrdered.map(p => p.id));
    const remainingAvailable = available.filter(p => !setIds.has(p.id));
    const finalAvailable = [...setOrdered, ...orderedOthers, ...remainingAvailable];

    const finalOrdered = [...nonAvailable, ...finalAvailable];
    const orderMap = new Map();
    finalOrdered.forEach((p, idx) => {
        orderMap.set(p.id, idx + 1);
    });

    return orderMap;
}

// Recomputes derived stats, points and ranks for every player inside one
async function recalculateRankings(pool, existingConnection = null, options = {}) {
    const { randomizeQueue = false } = (typeof options === 'boolean' ? { randomizeQueue: options } : options) || {};
    const connection = existingConnection || await pool.getConnection();
    const ownTransaction = !existingConnection;
    try {
        if (ownTransaction) await connection.beginTransaction();

        const [players] = await connection.query('SELECT * FROM players FOR UPDATE');

        for (const p of players) {
            const derived = deriveStats(p);
            Object.assign(p, derived);
            // Preserve official/Excel points if base_price_auto is 0 or if custom points exist
            p.newPoints = (Number(p.base_price_auto) === 0 && num(p.ranking_points) > 0)
                ? num(p.ranking_points)
                : computePoints(p).points;
            p.ranked = num(p.newPoints) > 0 || num(p.matches) > 0;
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

        // Auction Set Ordering (Rule 5 with Randomization):
        // Follows the slot rule (10 Batsmen, 10 Bowlers, 10 Wicket Keepers, 10 All-Rounders per set),
        // with players in each role randomized when randomizeQueue is true.
        let newAuctionOrderMap;
        const allHaveOrder = players.every(p => p.auction_order !== null && p.auction_order !== undefined && Number(p.auction_order) > 0);
        if (!randomizeQueue && allHaveOrder) {
            newAuctionOrderMap = new Map(players.map(p => [p.id, Number(p.auction_order)]));
        } else {
            newAuctionOrderMap = buildSlotOrderedQueue(players, { randomize: true });
        }

        let changed = 0;
        for (const p of players) {
            const newRank = p.ranked ? p.newRank : null;
            const newCatRank = p.ranked ? p.newCategoryRank : null;
            const newAuctionOrder = newAuctionOrderMap.get(p.id) || p.auction_order || p.id;
            const oldRank = p.current_rank === null ? null : num(p.current_rank);
            const oldCatRank = p.category_rank === null ? null : num(p.category_rank);
            const oldPoints = num(p.ranking_points);

            const pointsChanged = oldPoints !== p.newPoints;
            const firstRanking = oldRank === null && newRank !== null && oldPoints === 0;
            const rankChanged = oldRank !== newRank;
            const catRankChanged = oldCatRank !== newCatRank;

            const previousPoints = firstRanking ? p.newPoints
                : pointsChanged ? oldPoints : num(p.previous_ranking_points);
            const previousRank = rankChanged ? oldRank : (p.previous_rank === null ? null : num(p.previous_rank));
            const previousCatRank = catRankChanged ? oldCatRank : (p.previous_category_rank === null ? null : num(p.previous_category_rank));

            // Auto base price — only update if the column exists and base_price_auto = 1
            const autoPrice = basePriceFromPoints(p.newPoints);
            const shouldUpdatePrice = p.base_price_auto === undefined || Number(p.base_price_auto) === 1;

            if (shouldUpdatePrice) {
                await connection.query(
                    `UPDATE players SET
                        batting_average = ?, strike_rate = ?, economy = ?, bowling_average = ?, bowling_strike_rate = ?,
                        ranking_points = ?, previous_ranking_points = ?,
                        current_rank = ?, previous_rank = ?,
                        category_rank = ?, previous_category_rank = ?,
                        auction_order = ?,
                        base_price = ?
                     WHERE id = ?`,
                    [
                        p.batting_average, p.strike_rate, p.economy, p.bowling_average, p.bowling_strike_rate,
                        p.newPoints, previousPoints,
                        newRank, previousRank,
                        newCatRank, previousCatRank,
                        newAuctionOrder,
                        autoPrice,
                        p.id,
                    ]
                );
            } else {
                await connection.query(
                    `UPDATE players SET
                        batting_average = ?, strike_rate = ?, economy = ?, bowling_average = ?, bowling_strike_rate = ?,
                        ranking_points = ?, previous_ranking_points = ?,
                        current_rank = ?, previous_rank = ?,
                        category_rank = ?, previous_category_rank = ?,
                        auction_order = ?
                     WHERE id = ?`,
                    [
                        p.batting_average, p.strike_rate, p.economy, p.bowling_average, p.bowling_strike_rate,
                        p.newPoints, previousPoints,
                        newRank, previousRank,
                        newCatRank, previousCatRank,
                        newAuctionOrder,
                        p.id,
                    ]
                );
            }

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
    basePriceFromPoints,
    shuffleArray,
    buildSlotOrderedQueue,
    recalculateRankings,
};
