const pool = require('../config/db');
const hub = require('../sockets/hub');
const { toRupees } = require('../utils/money');
const { initialsOf } = require('../services/serializers');

/** Current auction state (same shape as the auction:stateUpdate socket event). */
exports.getStatus = async (req, res) => {
    try {
        const state = hub.getState();
        if (state) return res.json(state);
        const [auctions] = await pool.query("SELECT id, status FROM auctions WHERE status IN ('Live', 'Paused') ORDER BY id DESC LIMIT 1");
        if (auctions.length === 0) return res.json({ status: 'Pending' });
        res.json({ status: auctions[0].status, auctionId: auctions[0].id });
    } catch (error) {
        console.error('AUCTION STATUS ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Public auction history — every SOLD / UNSOLD result, newest first. */
exports.getHistory = async (req, res) => {
    try {
        const [results] = await pool.query(`
            SELECT ar.id, ar.auction_id, ar.player_id, ar.status, ar.winning_bid, ar.completed_at,
                   p.name AS player_name, p.playing_role, p.player_code, p.base_price, p.current_rank, p.ranking_points,
                   u.id AS team_id, u.team_name, u.team_short_name, u.team_color,
                   (SELECT COUNT(*) FROM bids b WHERE b.auction_id = ar.auction_id) AS bid_count
            FROM auction_results ar
            JOIN players p ON ar.player_id = p.id
            LEFT JOIN users u ON ar.winning_user_id = u.id
            ORDER BY ar.completed_at DESC, ar.id DESC
        `);
        res.json({
            history: results.map(r => ({
                id: r.id,
                auction_id: r.auction_id,
                player_id: r.player_id,
                player_name: r.player_name,
                initials: initialsOf(r.player_name),
                playing_role: r.playing_role,
                player_code: r.player_code,
                base_price: toRupees(r.base_price),
                current_rank: r.current_rank,
                ranking_points: Number(r.ranking_points) || 0,
                status: r.status,
                winning_bid: r.winning_bid === null ? null : toRupees(r.winning_bid),
                bid_count: Number(r.bid_count) || 0,
                completed_at: r.completed_at,
                team: r.team_id ? { id: r.team_id, team_name: r.team_name, short_name: r.team_short_name, color: r.team_color } : null,
                // backwards-compatible field names
                user_name: r.team_name,
            })),
        });
    } catch (error) {
        console.error('AUCTION HISTORY ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};
