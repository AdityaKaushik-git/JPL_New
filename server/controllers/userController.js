// Endpoints for signed-in accounts.
const pool = require('../config/db');
const { toRupees } = require('../utils/money');
const { publicPlayer } = require('../services/serializers');
const { getFranchise, listFranchises } = require('../services/franchises');
const { squadOf } = require('./franchiseController');
const { shapeUser, USER_COLUMNS } = require('./authController');

exports.getTeam = async (req, res) => {
    try {
        if (req.user.role !== 'user') return res.status(403).json({ message: 'Only franchise owners have a squad.' });
        const franchise = await getFranchise(pool, req.user.id);
        res.json({ franchise, team: await squadOf(req.user.id) });
    } catch (error) {
        console.error('MY TEAM ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getBids = async (req, res) => {
    try {
        const [bids] = await pool.query(`
            SELECT b.id, b.bid_amount, b.created_at, p.id AS player_id, p.name AS player_name, p.playing_role,
                   CASE
                     WHEN ar.id IS NULL THEN 'Live'
                     WHEN ar.winning_user_id = b.user_id AND ar.winning_bid = b.bid_amount THEN 'Won'
                     ELSE 'Outbid'
                   END AS status
            FROM bids b
            JOIN auctions a ON b.auction_id = a.id
            JOIN players p ON a.player_id = p.id
            LEFT JOIN auction_results ar ON ar.auction_id = b.auction_id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC, b.id DESC
        `, [req.user.id]);
        res.json({ bids: bids.map(b => ({ ...b, bid_amount: toRupees(b.bid_amount) })) });
    } catch (error) {
        console.error('MY BIDS ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const [users] = await pool.query(`SELECT ${USER_COLUMNS}, created_at FROM users WHERE id = ?`, [req.user.id]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ user: { ...shapeUser(users[0]), created_at: users[0].created_at } });
    } catch (error) {
        console.error('PROFILE ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// Owners may edit their own name and mobile only.
exports.updateProfile = async (req, res) => {
    try {
        const fullName = String((req.body && req.body.full_name) || '').trim();
        const mobile = String((req.body && req.body.mobile) || '').replace(/\s/g, '');
        if (fullName.length < 2 || fullName.length > 100) return res.status(400).json({ message: 'Name must be 2–100 characters.' });
        if (mobile && !/^[0-9+]{7,15}$/.test(mobile)) return res.status(400).json({ message: 'Enter a valid mobile number.' });
        await pool.query('UPDATE users SET full_name = ?, mobile = ? WHERE id = ?', [fullName, mobile || null, req.user.id]);
        const [users] = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [req.user.id]);
        res.json({ user: shapeUser(users[0]) });
    } catch (error) {
        console.error('UPDATE PROFILE ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const { id, role } = req.user;

        if (role === 'user') {
            const franchise = await getFranchise(pool, id);
            if (!franchise) return res.status(404).json({ message: 'Franchise not found' });
            const [[agg]] = await pool.query(
                `SELECT COUNT(*) AS cnt, COALESCE(AVG(purchase_price), 0) AS avg_price, COALESCE(MAX(purchase_price), 0) AS max_price
                 FROM teams WHERE user_id = ?`, [id]
            );
            const [recentBids] = await pool.query(`
                SELECT b.bid_amount, b.created_at, p.name AS player_name,
                       CASE WHEN ar.id IS NULL THEN 'Live'
                            WHEN ar.winning_user_id = b.user_id AND ar.winning_bid = b.bid_amount THEN 'Won'
                            ELSE 'Outbid' END AS status
                FROM bids b
                JOIN auctions a ON b.auction_id = a.id
                JOIN players p ON a.player_id = p.id
                LEFT JOIN auction_results ar ON ar.auction_id = b.auction_id
                WHERE b.user_id = ?
                ORDER BY b.id DESC LIMIT 6
            `, [id]);
            const squad = await squadOf(id);
            const roleMix = squad.reduce((acc, p) => { acc[p.playing_role] = (acc[p.playing_role] || 0) + 1; return acc; }, {});

            return res.json({
                franchise,
                averagePurchase: toRupees(agg.avg_price),
                highestPurchase: toRupees(agg.max_price),
                squad,
                roleMix,
                recentBids: recentBids.map(b => ({ ...b, bid_amount: toRupees(b.bid_amount) })),
                // backwards-compatible keys
                purse: franchise.remaining_purse,
                playersBought: franchise.squad_count,
                totalSpent: franchise.total_spent,
            });
        }

        if (role === 'player') {
            const [userRows] = await pool.query('SELECT enrollment_number FROM users WHERE id = ?', [id]);
            if (!userRows.length) return res.json({ player: null });
            const [rows] = await pool.query(
                `SELECT p.*, t.purchase_price AS winning_bid, t.user_id AS team_id
                 FROM players p LEFT JOIN teams t ON t.player_id = p.id
                 WHERE p.enrollment_number = ?`, [userRows[0].enrollment_number]
            );
            if (!rows.length) return res.json({ player: null });
            const r = rows[0];
            const team = r.team_id ? await getFranchise(pool, r.team_id) : null;
            return res.json({
                player: publicPlayer(r, {
                    base_price_updates_count: Number(r.base_price_updates_count) || 0,
                    sold_price: r.winning_bid === null ? null : toRupees(r.winning_bid),
                    team,
                }),
            });
        }

        return res.json({});
    } catch (error) {
        console.error('DASHBOARD ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getPlayerProfile = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT enrollment_number FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        const [players] = await pool.query('SELECT * FROM players WHERE enrollment_number = ?', [users[0].enrollment_number]);
        if (players.length === 0) return res.status(404).json({ message: 'Player not found' });
        res.json({ player: publicPlayer(players[0], { base_price_updates_count: Number(players[0].base_price_updates_count) || 0 }) });
    } catch (error) {
        console.error('PLAYER PROFILE ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// Existing rule kept: a player login may adjust its own base price twice, only while Available.
exports.updatePlayerProfile = async (req, res) => {
    try {
        if (req.user.role !== 'player') return res.status(403).json({ message: 'Only player accounts can do this.' });
        const basePrice = Number(req.body && req.body.base_price);
        if (!Number.isInteger(basePrice) || basePrice < 1000 || basePrice > 5000000) {
            return res.status(400).json({ message: 'Base price must be a whole amount between ₹1,000 and ₹50,00,000.' });
        }
        const [users] = await pool.query('SELECT enrollment_number FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });

        const [result] = await pool.query(
            `UPDATE players SET base_price = ?, base_price_updates_count = base_price_updates_count + 1
             WHERE enrollment_number = ? AND base_price_updates_count < 2 AND status = 'Available'`,
            [basePrice, users[0].enrollment_number]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: 'Base price can be changed at most twice, and only while you are Available.' });
        }
        res.json({ message: 'Base price updated' });
    } catch (error) {
        console.error('UPDATE PLAYER PROFILE ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getStandings = async (req, res) => {
    try {
        const franchises = await listFranchises(pool);
        const standings = franchises
            .map(f => ({
                ...f,
                // backwards-compatible keys
                owner_name: f.owner_name,
                purse: f.remaining_purse,
                players_count: f.squad_count,
            }))
            .sort((a, b) => {
                const ptsDiff = (Number(b.total_player_points) || 0) - (Number(a.total_player_points) || 0);
                if (ptsDiff !== 0) return ptsDiff;
                const purseDiff = (Number(b.remaining_purse) || 0) - (Number(a.remaining_purse) || 0);
                if (purseDiff !== 0) return purseDiff;
                return (Number(b.batsmen_points) || 0) - (Number(a.batsmen_points) || 0);
            });
        res.json({ standings });
    } catch (error) {
        console.error('STANDINGS ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};
