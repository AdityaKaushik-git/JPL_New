/**
 * Admin-only operations: franchises, players, rankings and auction history.
 * Every route here is behind authMiddleware + adminMiddleware.
 */
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const hub = require('../sockets/hub');
const { adminPlayer, publicFranchise } = require('../services/serializers');
const { validatePlayer } = require('../services/playerFields');
const { recalculateRankings } = require('../services/ranking');
const {
    createFranchise,
    validateFranchiseInput,
    validatePassword,
    FRANCHISE_COLUMNS,
} = require('../services/franchises');
const { toRupees } = require('../utils/money');
const { sendStartAuctionOtp, verifyStartAuctionOtp, TARGET_EMAIL } = require('../services/emailService');

function sendError(res, error, label) {
    if (error && error.status) {
        return res.status(error.status).json({ message: error.message, errors: error.errors || undefined });
    }
    console.error(`${label} ERROR:`, error && error.message);
    return res.status(500).json({ message: 'Server error' });
}

function idParam(req) {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
}

async function afterPlayerChange() {
    await recalculateRankings(pool);
    hub.notifyPlayersChanged();
}

/**
 * Reverses a completed sale inside an open transaction: refunds the purse,
 * reduces spend and squad count, and removes the player from the roster.
 */
async function refundSale(connection, record) {
    const amount = toRupees(record.winning_bid);
    await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [record.winning_user_id]);
    await connection.query(
        `UPDATE users SET purse = purse + ?, total_spent = GREATEST(total_spent - ?, 0),
                squad_count = GREATEST(squad_count - 1, 0) WHERE id = ?`,
        [amount, amount, record.winning_user_id]
    );
    await connection.query('DELETE FROM teams WHERE player_id = ? AND user_id = ?', [record.player_id, record.winning_user_id]);

    // Note: To be perfectly consistent, role counts, foreign_count, and uncapped_count should also be updated.
    // However, the system runs an auto-reconciliation on role/foreign/uncapped counts 
    // in migrate.js. For live safety, we'll explicitly force a sync or decrement here.
    const [players] = await connection.query('SELECT playing_role, country, is_uncapped FROM players WHERE id = ?', [record.player_id]);
    if (players.length) {
        const p = players[0];
        const roleMap = { 'Batsman': 'batsmen_count', 'Bowler': 'bowlers_count', 'All-Rounder': 'allrounders_count', 'Wicket Keeper': 'keepers_count' };
        const col = roleMap[p.playing_role];
        if (col) {
            await connection.query(`UPDATE users SET ${col} = GREATEST(${col} - 1, 0) WHERE id = ?`, [record.winning_user_id]);
        }
        const isForeign = p.country && p.country.trim().toLowerCase() !== 'india';
        if (isForeign) {
            await connection.query('UPDATE users SET foreign_count = GREATEST(foreign_count - 1, 0) WHERE id = ?', [record.winning_user_id]);
        }
        if (p.is_uncapped) {
            await connection.query('UPDATE users SET uncapped_count = GREATEST(uncapped_count - 1, 0) WHERE id = ?', [record.winning_user_id]);
        }
    }
}

// ---------------------------------------------------------------------------
// Accounts & stats
// ---------------------------------------------------------------------------
exports.getUsers = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT id, full_name, enrollment_number, email, mobile, role, team_name, team_short_name, status,
                    purse, starting_purse, total_spent, squad_count, max_squad_size, created_at
             FROM users WHERE role <> 'admin' ORDER BY role, team_name, full_name`
        );
        res.json({
            users: users.map(u => ({
                ...u,
                purse: toRupees(u.purse),
                starting_purse: toRupees(u.starting_purse),
                total_spent: toRupees(u.total_spent),
            })),
        });
    } catch (error) {
        sendError(res, error, 'GET USERS');
    }
};

exports.getStats = async (req, res) => {
    try {
        const [[counts]] = await pool.query(`
            SELECT COUNT(*) AS total,
                   SUM(status = 'Sold') AS sold,
                   SUM(status = 'Unsold') AS unsold,
                   SUM(status = 'Available') AS available,
                   SUM(status = 'In Auction') AS in_auction
            FROM players`);
        const [[teams]] = await pool.query(`
            SELECT COUNT(*) AS franchises, COALESCE(SUM(total_spent), 0) AS spent, COALESCE(SUM(purse), 0) AS remaining
            FROM users WHERE role = 'user'`);
        const [[top]] = await pool.query("SELECT COALESCE(MAX(winning_bid), 0) AS highest FROM auction_results WHERE status = 'Sold'");
        res.json({
            totalPlayers: Number(counts.total) || 0,
            soldPlayers: Number(counts.sold) || 0,
            unsoldPlayers: Number(counts.unsold) || 0,
            availablePlayers: Number(counts.available) || 0,
            inAuction: Number(counts.in_auction) || 0,
            activeBidders: Number(teams.franchises) || 0,
            franchises: Number(teams.franchises) || 0,
            totalSpent: toRupees(teams.spent),
            totalRemaining: toRupees(teams.remaining),
            highestSale: toRupees(top.highest),
        });
    } catch (error) {
        sendError(res, error, 'GET STATS');
    }
};

// ---------------------------------------------------------------------------
// Franchises — only the admin can create them. Purse and squad limits are
// assigned by the server (₹18,00,00,000 and 12 players) and cannot be edited.
// ---------------------------------------------------------------------------
exports.getFranchises = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT ${FRANCHISE_COLUMNS}, enrollment_number, email, created_at FROM users WHERE role = 'user' ORDER BY team_name, id`
        );
        res.json({
            franchises: rows.map(r => ({
                ...publicFranchise(r),
                login_id: r.enrollment_number,
                email: r.email,
                created_at: r.created_at,
            })),
        });
    } catch (error) {
        sendError(res, error, 'GET FRANCHISES');
    }
};

exports.createFranchise = async (req, res) => {
    try {
        // Purse / squad fields in the body are ignored on purpose.
        const franchise = await createFranchise(pool, req.body);
        await hub.notifyTeamsChanged();
        res.status(201).json({ message: `${franchise.team_name} created with a ₹18,00,00,000 purse.`, franchise });
    } catch (error) {
        sendError(res, error, 'CREATE FRANCHISE');
    }
};

exports.updateFranchise = async (req, res) => {
    try {
        const id = idParam(req);
        if (!id) return res.status(400).json({ message: 'Invalid franchise id' });
        const { values, errors } = validateFranchiseInput(req.body, { requirePassword: false });
        delete errors.login_id;
        delete values.enrollment_number;
        delete values.email;
        delete values.password;
        if (Object.keys(errors).length) return res.status(400).json({ message: 'Please fix the highlighted fields.', errors });

        const [dupes] = await pool.query(
            `SELECT id FROM users WHERE role = 'user' AND id <> ? AND (team_name = ? OR team_short_name = ?)`,
            [id, values.team_name, values.team_short_name]
        );
        if (dupes.length) return res.status(409).json({ message: 'Another team already uses this name or short name.' });

        const fields = ['full_name = ?', 'team_name = ?', 'team_short_name = ?'];
        const params = [values.full_name, values.team_name, values.team_short_name];
        if (values.team_color) { fields.push('team_color = ?'); params.push(values.team_color); }
        if (req.body.remove_logo) { fields.push('logo = NULL'); }
        else if (values.logo) { fields.push('logo = ?'); params.push(values.logo); }
        params.push(id);

        const [result] = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ? AND role = 'user'`, params);
        if (!result.affectedRows) return res.status(404).json({ message: 'Franchise not found' });
        await hub.notifyTeamsChanged();
        res.json({ message: 'Franchise updated' });
    } catch (error) {
        sendError(res, error, 'UPDATE FRANCHISE');
    }
};

exports.setFranchiseStatus = async (req, res) => {
    try {
        const id = idParam(req);
        const status = req.body && req.body.status;
        if (!id || !['active', 'disabled'].includes(status)) {
            return res.status(400).json({ message: "status must be 'active' or 'disabled'" });
        }
        const [result] = await pool.query("UPDATE users SET status = ? WHERE id = ? AND role = 'user'", [status, id]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Franchise not found' });
        await hub.notifyTeamsChanged();
        res.json({ message: status === 'active' ? 'Franchise enabled' : 'Franchise disabled' });
    } catch (error) {
        sendError(res, error, 'FRANCHISE STATUS');
    }
};

exports.resetFranchisePassword = async (req, res) => {
    try {
        const id = idParam(req);
        if (!id) return res.status(400).json({ message: 'Invalid franchise id' });
        const pwError = validatePassword(req.body && req.body.password);
        if (pwError) return res.status(400).json({ message: pwError });
        const hash = await bcrypt.hash(String(req.body.password), 10);
        const [result] = await pool.query("UPDATE users SET password_hash = ? WHERE id = ? AND role = 'user'", [hash, id]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Franchise not found' });
        res.json({ message: 'Password updated' });
    } catch (error) {
        sendError(res, error, 'RESET PASSWORD');
    }
};

// ---------------------------------------------------------------------------
// Players (no photos — player identity is data only)
// ---------------------------------------------------------------------------
exports.getPlayers = async (req, res) => {
    try {
        const [players] = await pool.query('SELECT * FROM players ORDER BY COALESCE(auction_order, id), id');
        res.json({ players: players.map(adminPlayer) });
    } catch (error) {
        sendError(res, error, 'GET PLAYERS');
    }
};

exports.addPlayer = async (req, res) => {
    try {
        const { values, errors } = validatePlayer(req.body, false);
        if (errors.length) return res.status(400).json({ message: errors.join('. ') });

        const [existing] = await pool.query('SELECT id FROM players WHERE enrollment_number = ?', [values.enrollment_number]);
        if (existing.length) {
            return res.status(409).json({ message: `A player with ID "${values.enrollment_number}" already exists.` });
        }

        if (values.auction_order === null || values.auction_order === undefined) {
            const [[{ nextOrder }]] = await pool.query('SELECT COALESCE(MAX(auction_order), 0) + 1 AS nextOrder FROM players');
            values.auction_order = Number(nextOrder);
        }

        const columns = Object.keys(values);
        const [result] = await pool.query(
            `INSERT INTO players (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
            columns.map(c => values[c])
        );
        await pool.query("UPDATE players SET player_code = CONCAT('JPL', LPAD(id, 3, '0')) WHERE id = ?", [result.insertId]);
        await afterPlayerChange();
        res.status(201).json({ message: 'Player added', id: result.insertId });
    } catch (error) {
        sendError(res, error, 'ADD PLAYER');
    }
};

exports.updatePlayer = async (req, res) => {
    try {
        const id = idParam(req);
        if (!id) return res.status(400).json({ message: 'Invalid player id' });
        if (hub.activePlayerId() === id) {
            return res.status(409).json({ message: 'This player is on the auction block. Close the lot before editing.' });
        }
        const { values, errors } = validatePlayer(req.body, true);
        if (errors.length) return res.status(400).json({ message: errors.join('. ') });
        const columns = Object.keys(values);
        if (!columns.length) return res.status(400).json({ message: 'Nothing to update' });

        if (values.enrollment_number) {
            const [dupe] = await pool.query('SELECT id FROM players WHERE enrollment_number = ? AND id <> ?', [values.enrollment_number, id]);
            if (dupe.length) return res.status(409).json({ message: `Another player already uses ID "${values.enrollment_number}".` });
        }

        const [result] = await pool.query(
            `UPDATE players SET ${columns.map(c => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
            [...columns.map(c => values[c]), id]
        );
        if (!result.affectedRows) return res.status(404).json({ message: 'Player not found' });
        await afterPlayerChange();
        res.json({ message: 'Player updated' });
    } catch (error) {
        sendError(res, error, 'UPDATE PLAYER');
    }
};

exports.deletePlayer = async (req, res) => {
    const id = idParam(req);
    if (!id) return res.status(400).json({ message: 'Invalid player id' });
    if (hub.activePlayerId() === id) {
        return res.status(409).json({ message: 'This player is on the auction block. Close the lot before deleting.' });
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [sold] = await connection.query(
            "SELECT * FROM auction_results WHERE player_id = ? AND status = 'Sold' ORDER BY id DESC LIMIT 1 FOR UPDATE", [id]
        );
        if (sold.length) await refundSale(connection, sold[0]);
        await connection.query('DELETE FROM teams WHERE player_id = ?', [id]);
        await connection.query('DELETE FROM auction_results WHERE player_id = ?', [id]);
        const [auctions] = await connection.query('SELECT id FROM auctions WHERE player_id = ?', [id]);
        if (auctions.length) {
            await connection.query('DELETE FROM bids WHERE auction_id IN (?)', [auctions.map(a => a.id)]);
        }
        await connection.query('DELETE FROM auctions WHERE player_id = ?', [id]);
        await connection.query('DELETE FROM ranking_history WHERE player_id = ?', [id]);
        await connection.query('DELETE FROM player_matches WHERE player_id = ?', [id]);
        const [result] = await connection.query('DELETE FROM players WHERE id = ?', [id]);
        if (!result.affectedRows) {
            await connection.rollback();
            return res.status(404).json({ message: 'Player not found' });
        }
        await connection.commit();
        await afterPlayerChange();
        await hub.notifyTeamsChanged();
        res.json({ message: 'Player deleted' });
    } catch (error) {
        await connection.rollback();
        sendError(res, error, 'DELETE PLAYER');
    } finally {
        connection.release();
    }
};

/**
 * Manual status reset. Only 'Available' and 'Unsold' may be set here —
 * 'In Auction' and 'Sold' are produced exclusively by the live auction engine.
 * Resetting a Sold player refunds the franchise and removes the player from its squad.
 */
exports.updatePlayerStatus = async (req, res) => {
    const id = idParam(req);
    const status = req.body && req.body.status;
    if (!id) return res.status(400).json({ message: 'Invalid player id' });
    if (!['Available', 'Unsold'].includes(status)) {
        return res.status(400).json({ message: "Status can only be reset to 'Available' or 'Unsold'. Sales happen in the live auction." });
    }
    if (hub.activePlayerId() === id) {
        return res.status(409).json({ message: 'This player is on the auction block. Close the lot first.' });
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [players] = await connection.query('SELECT id, status FROM players WHERE id = ? FOR UPDATE', [id]);
        if (!players.length) {
            await connection.rollback();
            return res.status(404).json({ message: 'Player not found' });
        }

        const [records] = await connection.query(
            'SELECT * FROM auction_results WHERE player_id = ? ORDER BY completed_at DESC, id DESC LIMIT 1 FOR UPDATE', [id]
        );
        if (records.length) {
            const record = records[0];
            if (record.status === 'Sold') await refundSale(connection, record);
            await connection.query('DELETE FROM auction_results WHERE id = ?', [record.id]);
            await connection.query('DELETE FROM bids WHERE auction_id = ?', [record.auction_id]);
            await connection.query('DELETE FROM auctions WHERE id = ?', [record.auction_id]);
        }
        // Clean any dangling open auction rows for this player (e.g. after a crash).
        const [open] = await connection.query("SELECT id FROM auctions WHERE player_id = ? AND status <> 'Completed'", [id]);
        if (open.length) {
            await connection.query('DELETE FROM bids WHERE auction_id IN (?)', [open.map(a => a.id)]);
            await connection.query('DELETE FROM auctions WHERE id IN (?)', [open.map(a => a.id)]);
        }

        await connection.query('UPDATE players SET status = ? WHERE id = ?', [status, id]);
        await connection.commit();
        hub.notifyPlayersChanged();
        await hub.notifyTeamsChanged();
        res.json({ message: `Player reset to ${status}` });
    } catch (error) {
        await connection.rollback();
        sendError(res, error, 'UPDATE PLAYER STATUS');
    } finally {
        connection.release();
    }
};

exports.recalculateRankings = async (req, res) => {
    try {
        const result = await recalculateRankings(pool);
        hub.notifyPlayersChanged();
        res.json({ message: `Rankings recalculated — ${result.ranked} ranked players, ${result.changed} changed.`, ...result });
    } catch (error) {
        sendError(res, error, 'RECALCULATE RANKINGS');
    }
};

// Match log (per-match lines shown on the player profile). Career totals remain
// the admin-maintained source for rankings.
exports.addPlayerMatch = async (req, res) => {
    try {
        const id = idParam(req);
        if (!id) return res.status(400).json({ message: 'Invalid player id' });
        const b = req.body || {};
        const label = String(b.match_label || '').trim();
        if (!label || label.length > 100) return res.status(400).json({ message: 'Match label is required (max 100 characters).' });
        const date = b.match_date ? String(b.match_date) : null;
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'Match date must be YYYY-MM-DD.' });
        const ints = ['runs', 'balls_faced', 'wickets', 'balls_bowled', 'runs_conceded', 'catches', 'stumpings'];
        const vals = {};
        for (const k of ints) {
            const v = b[k] === undefined || b[k] === '' ? 0 : Number(b[k]);
            if (!Number.isInteger(v) || v < 0 || v > 1000) return res.status(400).json({ message: `${k} must be a whole number 0–1000.` });
            vals[k] = v;
        }
        const [players] = await pool.query('SELECT id FROM players WHERE id = ?', [id]);
        if (!players.length) return res.status(404).json({ message: 'Player not found' });
        await pool.query(
            `INSERT INTO player_matches (player_id, match_label, match_date, ${ints.join(', ')})
             VALUES (?, ?, ?, ${ints.map(() => '?').join(', ')})`,
            [id, label, date, ...ints.map(k => vals[k])]
        );
        hub.notifyPlayersChanged();
        res.status(201).json({ message: 'Match added' });
    } catch (error) {
        sendError(res, error, 'ADD MATCH');
    }
};

exports.deletePlayerMatch = async (req, res) => {
    try {
        const matchId = Number(req.params.matchId);
        const id = idParam(req);
        if (!id || !Number.isInteger(matchId)) return res.status(400).json({ message: 'Invalid id' });
        const [result] = await pool.query('DELETE FROM player_matches WHERE id = ? AND player_id = ?', [matchId, id]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Match not found' });
        hub.notifyPlayersChanged();
        res.json({ message: 'Match removed' });
    } catch (error) {
        sendError(res, error, 'DELETE MATCH');
    }
};

// ---------------------------------------------------------------------------
// Auction history
// ---------------------------------------------------------------------------
exports.getAuctionHistory = async (req, res) => {
    try {
        const [history] = await pool.query(`
            SELECT ar.id,
                   COALESCE(p.name, ar.activity_note, 'System Activity Log') AS player_name,
                   p.playing_role,
                   COALESCE(u.team_name, 'System Admin') AS winner_name,
                   u.team_short_name,
                   ar.winning_bid,
                   ar.status,
                   ar.activity_note,
                   ar.completed_at
            FROM auction_results ar
            LEFT JOIN players p ON ar.player_id = p.id
            LEFT JOIN users u ON u.id = ar.winning_user_id
            ORDER BY ar.completed_at DESC, ar.id DESC
        `);
        res.json({
            history: history.map(h => ({
                ...h,
                winning_bid: h.winning_bid === null ? null : toRupees(h.winning_bid),
            })),
        });
    } catch (error) {
        sendError(res, error, 'GET AUCTION HISTORY');
    }
};

exports.deleteAuctionHistoryRecord = async (req, res) => {
    const historyId = idParam(req);
    if (!historyId) return res.status(400).json({ message: 'Invalid history id' });
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [records] = await connection.query('SELECT * FROM auction_results WHERE id = ? FOR UPDATE', [historyId]);
        if (!records.length) {
            await connection.rollback();
            return res.status(404).json({ message: 'History record not found' });
        }
        const record = records[0];
        if (record.player_id) {
            if (hub.activePlayerId() === record.player_id) {
                await connection.rollback();
                return res.status(409).json({ message: 'This player is on the auction block right now.' });
            }
            if (record.status === 'Sold') await refundSale(connection, record);
            await connection.query("UPDATE players SET status = 'Available' WHERE id = ?", [record.player_id]);
            if (record.auction_id) {
                await connection.query('DELETE FROM bids WHERE auction_id = ?', [record.auction_id]);
                await connection.query('DELETE FROM auctions WHERE id = ?', [record.auction_id]);
            }
        }
        await connection.query('DELETE FROM auction_results WHERE id = ?', [historyId]);
        await connection.commit();

        hub.notifyPlayersChanged();
        await hub.notifyTeamsChanged();
        res.json({ message: 'Result removed.' });
    } catch (error) {
        await connection.rollback();
        sendError(res, error, 'DELETE AUCTION HISTORY');
    } finally {
        connection.release();
    }
};

exports.getAuctionState = async (req, res) => {
    res.json(hub.getState() || { status: 'Pending' });
};

exports.requestStartAuctionOtp = async (req, res) => {
    try {
        const result = await sendStartAuctionOtp();
        res.json({
            message: `OTP sent to ${TARGET_EMAIL}. Enter the code to authorize starting a fresh auction.`,
            email: TARGET_EMAIL,
            isSentViaSmtp: result.isSentViaSmtp,
            devOtp: result.devOtp,
        });
    } catch (error) {
        sendError(res, error, 'REQUEST START OTP');
    }
};

exports.verifyStartAuctionOtp = async (req, res) => {
    const { otp } = req.body || {};
    if (!otp) return res.status(400).json({ message: 'OTP code is required.' });

    const verification = verifyStartAuctionOtp(otp);
    if (!verification.valid) {
        return res.status(400).json({ message: verification.message });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Release all sold / in-auction players back to Available
        await connection.query("UPDATE players SET status = 'Available'");

        // 2. Clear all previous auction rosters & history
        await connection.query("DELETE FROM teams");
        await connection.query("DELETE FROM bids");
        await connection.query("DELETE FROM auctions");

        // 3. Reset all bidder / franchise users to default state & starting purse
        await connection.query(`
            UPDATE users
            SET purse = starting_purse,
                total_spent = 0,
                squad_count = 0,
                batsmen_count = 0,
                bowlers_count = 0,
                allrounders_count = 0,
                keepers_count = 0,
                foreign_count = 0,
                uncapped_count = 0
            WHERE role = 'user'
        `);

        // 4. Log activity entry in auction_results
        await connection.query(
            "INSERT INTO auction_results (status, activity_note) VALUES ('ActivityLog', 'START AUCTION: New auction session started & all bidder purses/rosters reset via OTP verification')"
        );

        await connection.commit();

        // 5. Trigger ranking recalculation & reset socket engine state
        await recalculateRankings(pool);
        await hub.resetAndStartAuction();

        res.json({
            message: 'OTP verified successfully! All bidder balances and rosters have been reset for a brand new auction session.',
        });
    } catch (error) {
        await connection.rollback();
        sendError(res, error, 'VERIFY START OTP');
    } finally {
        connection.release();
    }
};

exports.deleteAllBidders = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [users] = await connection.query("SELECT id, team_name FROM users WHERE role = 'user'");
        const count = users.length;

        if (count === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'No bidder accounts exist in the database.' });
        }

        // 1. Release all players back to Available
        await connection.query("UPDATE players SET status = 'Available'");

        // 2. Safely remove foreign key references
        await connection.query("SET FOREIGN_KEY_CHECKS = 0");
        await connection.query("UPDATE auction_results SET winning_user_id = NULL WHERE winning_user_id IN (SELECT id FROM users WHERE role = 'user')");
        await connection.query("UPDATE auctions SET highest_bidder_id = NULL");
        await connection.query("DELETE FROM bids");
        await connection.query("DELETE FROM teams");

        // 3. Delete all bidder accounts from users table
        await connection.query("DELETE FROM users WHERE role = 'user'");
        await connection.query("SET FOREIGN_KEY_CHECKS = 1");

        // 4. Log activity in auction history
        await connection.query(
            "INSERT INTO auction_results (status, activity_note) VALUES ('ActivityLog', ?)",
            [`DELETE ALL BIDDERS: Disabled and deleted all ${count} bidder account(s) from database by Admin`]
        );

        await connection.commit();

        const sessionRegistry = require('../services/sessionRegistry');
        for (const u of users) {
            sessionRegistry.removeSession(u.id);
        }

        await hub.notifyTeamsChanged();
        hub.notifyPlayersChanged();

        res.json({
            message: `Successfully disabled and deleted all ${count} bidder account(s) from the database. Activity logged in Auction History.`,
            count,
        });
    } catch (error) {
        await connection.rollback();
        sendError(res, error, 'DELETE ALL BIDDERS');
    } finally {
        connection.release();
    }
};

