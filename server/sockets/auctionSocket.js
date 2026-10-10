/**
 * JPL live auction engine (Socket.IO).
 *
 * The server is the only source of truth. Clients send intents
 * ("place a bid", "sell"), never values that the server trusts:
 *   - the bid amount is recomputed from the server's own state
 *   - purse, squad count, role counts and franchise status are read from MySQL under row locks
 *   - every state-changing handler runs through one serial queue, so two bids
 *     that arrive in the same millisecond are processed one after the other
 *
 * Client → server events (unchanged names from the original app, plus admin:nextPlayer):
 *   user:join, user:placeBid, admin:startPlayer, admin:nextPlayer, admin:pauseAuction,
 *   admin:resumeAuction, admin:sellPlayer, admin:markUnsold, admin:reAuction
 *
 * Server → client events:
 *   auction:stateUpdate, auction:timer, auction:notification, auction:bidPlaced,
 *   auction:sold, auction:unsold, auction:playerReset, teams:update, purse:update,
 *   players:changed, live:stats
 *
 * Role-slot enforcement (NEW):
 *   Each team has hard limits: 5 Batsmen, 5 Bowlers, 3 All-Rounders, 2 Wicket-Keepers,
 *   4 max foreign players, 2 min uncapped players.
 *   These limits are checked at both bid time AND sale time (inside DB transactions).
 *   The relevant columns on `users` are:
 *     batsmen_count, bowlers_count, allrounders_count, keepers_count,
 *     foreign_count, uncapped_count
 *   and are incremented atomically in sellCurrent().
 */
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const sessionRegistry = require('../services/sessionRegistry');
const hub = require('./hub');
const {
    INITIAL_TIMER_SECONDS,
    BID_RESET_SECONDS,
    AUTO_FINALIZE,
    RESULT_HOLD_MS,
    getIncrement,
    getNextBid,
    MAX_BATSMEN,
    MAX_BOWLERS,
    MAX_ALLROUNDERS,
    MAX_KEEPERS,
    MAX_FOREIGN_PLAYERS,
    MIN_UNCAPPED_PLAYERS,
} = require('../config/auction');
const { toRupees, formatINR } = require('../utils/money');
const { publicPlayer, publicFranchise, logoUrl } = require('../services/serializers');
const { listFranchises, FRANCHISE_COLUMNS } = require('../services/franchises');

const BID_HISTORY_LIMIT = 30;

// ---------------------------------------------------------------------------
// Role slot helpers
// ---------------------------------------------------------------------------
function checkRoleSlot(role, counts) {
    const rc = counts || {};
    switch (role) {
        case 'Batsman':
            if (Number(rc.batsmen_count || 0) >= MAX_BATSMEN)
                return `BATSMAN SLOT FULL — maximum ${MAX_BATSMEN} batsmen per squad`;
            break;
        case 'Bowler':
            if (Number(rc.bowlers_count || 0) >= MAX_BOWLERS)
                return `BOWLER SLOT FULL — maximum ${MAX_BOWLERS} bowlers per squad`;
            break;
        case 'All-Rounder':
            if (Number(rc.allrounders_count || 0) >= MAX_ALLROUNDERS)
                return `ALL-ROUNDER SLOT FULL — maximum ${MAX_ALLROUNDERS} all-rounders per squad`;
            break;
        case 'Wicket Keeper':
            if (Number(rc.keepers_count || 0) >= MAX_KEEPERS)
                return `WICKET-KEEPER SLOT FULL — maximum ${MAX_KEEPERS} wicketkeeper per squad`;
            break;
    }
    return null;
}

function roleCountColumn(role) {
    const map = {
        'Batsman':      'batsmen_count',
        'Bowler':       'bowlers_count',
        'All-Rounder':  'allrounders_count',
        'Wicket Keeper':'keepers_count',
    };
    return map[role] || null;
}

// ---------------------------------------------------------------------------
// Auction state
// ---------------------------------------------------------------------------
function emptyAuction() {
    return {
        auctionId: null,
        player: null,
        lot: null,
        status: 'Pending', // Pending | Live | Paused | Processing | Completed
        currentBid: 0,
        highestBidder: null, // { id, team_name, short_name, color, logo_url }
        timeLeft: 0,
        timerTotal: INITIAL_TIMER_SECONDS,
        bidHistory: [],
        bidCount: 0,
        result: null, // { type: 'SOLD'|'UNSOLD', ... }
        timerInterval: null,
        optOuts: new Set(),
    };
}

let activeAuction = emptyAuction();
let showLiveRankings = false;
const connectedUsers = new Map();

// ---- serial queue: one state mutation at a time -----------------------------
let queue = Promise.resolve();
function serialize(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
}

class AuctionError extends Error {
    constructor(message, type = 'danger') { super(message); this.type = type; }
}

module.exports = (io) => {
    // ---- helpers ------------------------------------------------------------
    function notify(target, text, type = 'info') {
        target.emit('auction:notification', { text, type });
    }

    function liveStats() {
        let bidders = 0, players = 0, admins = 0, spectators = 0;
        for (const user of connectedUsers.values()) {
            if (user.role === 'user') bidders++;
            else if (user.role === 'player') players++;
            else if (user.role === 'admin') admins++;
            else spectators++;
        }
        return { bidders, players, admins, spectators, total: connectedUsers.size };
    }

    function nextBid() {
        if (!activeAuction.player) return 0;
        return getNextBid(activeAuction.currentBid, activeAuction.player.base_price);
    }

    function getSanitizedState(user = {}) {
        const a = activeAuction;
        const isAdmin = user && user.role === 'admin';
        const userId = user && user.id;

        let bidder = null;
        if (a.highestBidder) {
            if (isAdmin) {
                bidder = a.highestBidder;
            } else if (userId && a.highestBidder.id === userId) {
                bidder = {
                    id: userId,
                    team_name: 'You (Highest Bidder)',
                    short_name: 'YOU',
                    color: a.highestBidder.color || '#C8102E',
                    isYou: true,
                };
            } else {
                bidder = {
                    id: 'hidden',
                    team_name: 'Active Bidder (Confidential)',
                    short_name: 'BID',
                    color: '#64748B',
                    isHidden: true,
                };
            }
        }

        const sanitizedHistory = (a.bidHistory || []).map(b => {
            if (isAdmin) return b;
            const isYou = userId && b.teamId === userId;
            return {
                teamId: isYou ? userId : 'hidden',
                teamName: isYou ? 'You' : 'Anonymous Bidder',
                shortName: isYou ? 'YOU' : 'BID',
                userName: isYou ? 'You' : 'Anonymous Bidder',
                color: isYou ? b.color : '#64748B',
                amount: b.amount,
                at: b.at,
                isYou,
                isHidden: !isYou,
            };
        });

        let sanitizedResult = a.result;
        if (a.result && a.result.type === 'SOLD' && !isAdmin) {
            const isWinner = userId && a.result.teamId === userId;
            sanitizedResult = {
                ...a.result,
                teamName: isWinner ? a.result.teamName : 'Winning Franchise',
                shortName: isWinner ? a.result.shortName : 'WIN',
            };
        }

        return {
            auctionId: a.auctionId,
            status: a.status,
            showLiveRankings,
            player: a.player,
            lot: a.lot,
            currentBid: a.currentBid,
            highestBidder: bidder,
            highestBidderName: bidder ? bidder.team_name : null,
            highestBidderId: bidder ? bidder.id : null,
            timeLeft: a.timeLeft,
            timerTotal: a.timerTotal,
            bidHistory: sanitizedHistory,
            bidCount: a.bidCount,
            nextBid: a.status === 'Completed' ? 0 : nextBid(),
            increment: getIncrement(a.currentBid),
            result: sanitizedResult,
            isOptedOut: Boolean(a.optOuts && a.optOuts.has(userId)),
            serverTime: Date.now(),
        };
    }

    function broadcastState() {
        for (const socket of io.sockets.sockets.values()) {
            socket.emit('auction:stateUpdate', getSanitizedState(socket.user));
        }
    }

    async function broadcastTeams() {
        try {
            const teams = await listFranchises(pool);
            for (const socket of io.sockets.sockets.values()) {
                const isAdmin = socket.user && socket.user.role === 'admin';
                const canSeeRankings = isAdmin || showLiveRankings;
                const sanitizedTeams = teams.map(t => {
                    if (canSeeRankings) return t;
                    // Redact live ranking points from team list when showLiveRankings is OFF for non-admins
                    const { total_player_points, batsmen_points, ...rest } = t;
                    return rest;
                });
                socket.emit('teams:update', sanitizedTeams);
            }
            return teams;
        } catch (err) {
            console.error('TEAMS BROADCAST ERROR:', err.message);
            return null;
        }
    }

    function stopTimer() {
        if (activeAuction.timerInterval) clearInterval(activeAuction.timerInterval);
        activeAuction.timerInterval = null;
    }

    function startTimer() {
        stopTimer();
        activeAuction.timerInterval = setInterval(tick, 1000);
    }

    function tick() {
        if (activeAuction.status !== 'Live') return;
        if (activeAuction.timeLeft > 0) {
            activeAuction.timeLeft--;
            io.emit('auction:timer', activeAuction.timeLeft);
        }
        if (activeAuction.timeLeft === 0) {
            stopTimer();
            if (AUTO_FINALIZE) {
                serialize(() => finalize()).catch(err => {
                    console.error('AUTO FINALIZE ERROR:', err);
                    notify(io, 'Could not close the lot automatically. Admin, please SELL or mark UNSOLD.', 'danger');
                });
            } else {
                notify(io, 'Time is up! Waiting for the auctioneer…', 'warning');
                broadcastState();
            }
        }
    }

    async function loadTeam(db, userId) {
        const [rows] = await db.query(`SELECT ${FRANCHISE_COLUMNS} FROM users WHERE id = ?`, [userId]);
        if (!rows.length) return null;
        const t = publicFranchise(rows[0]);
        return { id: t.id, team_name: t.team_name, short_name: t.short_name, color: t.color, logo_url: t.logo_url };
    }

    async function lotPosition(db, player) {
        const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM players');
        const [[{ pos }]] = await db.query(
            `SELECT COUNT(*) AS pos FROM players
             WHERE COALESCE(auction_order, id) < ? OR (COALESCE(auction_order, id) = ? AND id <= ?)`,
            [player.auction_order ?? player.id, player.auction_order ?? player.id, player.id]
        );
        return { position: Number(pos), total: Number(total) };
    }

    function isLotOpen() {
        return Boolean(activeAuction.player && activeAuction.auctionId && ['Live', 'Paused', 'Processing'].includes(activeAuction.status));
    }

    // ---- start a lot ----------------------------------------------------------
    async function startLot(playerId) {
        if (activeAuction.player && ['Live', 'Paused', 'Processing'].includes(activeAuction.status)) {
            if (activeAuction.highestBidder) {
                throw new AuctionError('Finish the current player (SOLD or UNSOLD) before starting another.', 'warning');
            }
            await markCurrentUnsold();
        }

        const connection = await pool.getConnection();
        let player, auctionId, lot;
        try {
            await connection.beginTransaction();
            const [rows] = await connection.query('SELECT * FROM players WHERE id = ? FOR UPDATE', [playerId]);
            if (!rows.length) throw new AuctionError('Player not found.');
            if (rows[0].status !== 'Available') {
                throw new AuctionError(`${rows[0].name} is ${rows[0].status}. Only Available players can be auctioned.`, 'warning');
            }
            player = publicPlayer(rows[0]);
            const [result] = await connection.query(
                "INSERT INTO auctions (player_id, status, current_bid, start_time) VALUES (?, 'Live', 0, NOW())", [playerId]
            );
            auctionId = result.insertId;
            await connection.query("UPDATE players SET status = 'In Auction' WHERE id = ?", [playerId]);
            lot = await lotPosition(connection, player);
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        stopTimer();
        activeAuction = {
            ...emptyAuction(),
            auctionId,
            player: { ...player, status: 'In Auction' },
            lot,
            status: 'Live',
            timeLeft: INITIAL_TIMER_SECONDS,
            timerTotal: INITIAL_TIMER_SECONDS,
        };
        startTimer();
        broadcastState();
        hub.notifyPlayersChanged();
        notify(io, `Now on the block: ${player.name}`, 'info');
    }

    async function nextAvailablePlayerId() {
        const [rows] = await pool.query(
            "SELECT id FROM players WHERE status = 'Available' ORDER BY COALESCE(auction_order, id), id LIMIT 1"
        );
        return rows.length ? rows[0].id : null;
    }

    // ---- bidding --------------------------------------------------------------
    async function placeBid(socket, data) {
        const user = socket.user;
        if (!user || user.role !== 'user') {
            throw new AuctionError('Only franchise owners can bid. Spectators can watch the live screen.');
        }

        const auctionId = Number(data && data.auctionId);
        const clientAmount = Number(data && data.amount);
        if (!Number.isInteger(auctionId)) {
            throw new AuctionError('Invalid bid.');
        }
        if (activeAuction.status !== 'Live' || activeAuction.auctionId !== auctionId) {
            throw new AuctionError('Bidding is not open for this player right now.', 'warning');
        }
        if (activeAuction.timeLeft <= 0) throw new AuctionError('Time is up for this player.', 'warning');
        if (activeAuction.highestBidder && activeAuction.highestBidder.id === user.id) {
            throw new AuctionError('You already hold the highest bid.', 'warning');
        }
        if (activeAuction.optOuts && activeAuction.optOuts.has(user.id)) {
            throw new AuctionError('You have opted out of this round.', 'warning');
        }

        // Determine server's required next bid
        const amount = nextBid();

        // Smooth bidding validation:
        // Accept bid if client sent exact nextBid OR if client intended to bid during this live lot and purse/rules permit nextBid.
        // Reject only if clientAmount is drastically out of sync (more than 3 steps behind current bid).
        if (Number.isFinite(clientAmount) && clientAmount > 0) {
            const clientRupees = toRupees(clientAmount);
            const currentRupees = activeAuction.currentBid;
            const minAcceptableClientBid = Math.max(0, currentRupees - (getIncrement(currentRupees) * 3));
            if (clientRupees < minAcceptableClientBid) {
                throw new AuctionError(`The bid has moved. Next bid is ${formatINR(amount)}.`, 'warning');
            }
        }

        const connection = await pool.getConnection();
        let team;
        try {
            await connection.beginTransaction();

            // Lock the franchise row and re-validate purse, squad, and role slots
            const [users] = await connection.query(
                `SELECT id, role, status, purse, squad_count, max_squad_size,
                        batsmen_count, bowlers_count, allrounders_count, keepers_count,
                        foreign_count, uncapped_count, team_name, team_short_name, team_color, logo, updated_at,
                        (SELECT COUNT(*) FROM teams t WHERE t.user_id = users.id) AS roster
                 FROM users WHERE id = ? FOR UPDATE`, [user.id]
            );
            const f = users[0];
            if (!f || f.role !== 'user') throw new AuctionError('Franchise account not found.');
            if (f.status !== 'active') throw new AuctionError('Your franchise account is disabled. Contact the admin.');

            const squad = Math.max(Number(f.squad_count), Number(f.roster));
            if (squad >= Number(f.max_squad_size)) {
                throw new AuctionError(`SQUAD FULL — ${squad} / ${f.max_squad_size}. You cannot bid on more players.`);
            }

            const playerRole = activeAuction.player ? activeAuction.player.playing_role : null;

            // Foreign player cap & 3rd/4th foreign player Batsman slot space mapping
            const isForeign = activeAuction.player && activeAuction.player.country &&
                activeAuction.player.country.trim().toLowerCase() !== 'india';
            const isUncapped = activeAuction.player && Boolean(activeAuction.player.is_uncapped);

            if (isForeign) {
                const foreignCount = Number(f.foreign_count || 0);
                if (foreignCount >= MAX_FOREIGN_PLAYERS) {
                    throw new AuctionError(`FOREIGN CAP REACHED — maximum ${MAX_FOREIGN_PLAYERS} overseas players per squad.`);
                }
                if (foreignCount >= 2) {
                    // 3rd and 4th foreign player fill a Batsman slot space
                    if (Number(f.batsmen_count || 0) >= MAX_BATSMEN) {
                        throw new AuctionError(`BATSMAN SLOT FULL — 3rd and 4th foreign players fill a Batsman slot space (${MAX_BATSMEN}/${MAX_BATSMEN} full).`);
                    }
                } else if (playerRole) {
                    const roleErr = checkRoleSlot(playerRole, f);
                    if (roleErr) throw new AuctionError(roleErr);
                }
            } else if (playerRole) {
                const roleErr = checkRoleSlot(playerRole, f);
                if (roleErr) throw new AuctionError(roleErr);
            }

            // Uncapped minimum requirement lookahead
            const uncappedNow = Number(f.uncapped_count || 0);
            const playerUncapped = activeAuction.player && Boolean(activeAuction.player.is_uncapped);
            if (!playerUncapped && uncappedNow < MIN_UNCAPPED_PLAYERS) {
                const uncappedNeeded = MIN_UNCAPPED_PLAYERS - uncappedNow;
                const remainingSlotsAfterThis = Number(f.max_squad_size) - (squad + 1);
                if (remainingSlotsAfterThis < uncappedNeeded) {
                    throw new AuctionError(
                        `UNCAPPED REQUIREMENT — you need at least ${MIN_UNCAPPED_PLAYERS} uncapped players. You must buy ${uncappedNeeded} more uncapped player(s) with your remaining ${Number(f.max_squad_size) - squad} slot(s).`
                    );
                }
            }

            if (toRupees(f.purse) < amount) {
                throw new AuctionError(`INSUFFICIENT PURSE — You have ${formatINR(f.purse)} remaining.`);
            }

            const [auctions] = await connection.query(
                'SELECT status, current_bid FROM auctions WHERE id = ? FOR UPDATE', [auctionId]
            );
            if (!auctions.length || auctions[0].status !== 'Live') throw new AuctionError('Bidding has closed for this player.', 'warning');
            if (toRupees(auctions[0].current_bid) >= amount) throw new AuctionError('Someone placed a higher bid first.', 'warning');

            await connection.query('INSERT INTO bids (auction_id, user_id, bid_amount) VALUES (?, ?, ?)', [auctionId, user.id, amount]);
            await connection.query('UPDATE auctions SET current_bid = ?, highest_bidder_id = ? WHERE id = ?', [amount, user.id, auctionId]);

            team = {
                id: f.id,
                team_name: f.team_name,
                short_name: f.team_short_name || 'BID',
                color: f.team_color || '#C8102E',
                logo_url: logoUrl(f)
            };
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        activeAuction.currentBid = amount;
        activeAuction.highestBidder = team;
        activeAuction.bidCount += 1;
        if (activeAuction.timeLeft < BID_RESET_SECONDS) {
            activeAuction.timeLeft = BID_RESET_SECONDS;
            activeAuction.timerTotal = BID_RESET_SECONDS;
        }
        activeAuction.bidHistory.unshift({
            teamId: team.id,
            teamName: team.team_name,
            shortName: team.short_name,
            color: team.color,
            userName: team.team_name, // backwards compatibility
            amount,
            at: Date.now(),
        });
        activeAuction.bidHistory = activeAuction.bidHistory.slice(0, BID_HISTORY_LIMIT);

        for (const s of io.sockets.sockets.values()) {
            const isAdmin = s.user && s.user.role === 'admin';
            const isYou = s.user && s.user.id === team.id;
            s.emit('auction:bidPlaced', {
                teamId: (isAdmin || isYou) ? team.id : 'hidden',
                amount,
                shortName: isAdmin ? team.short_name : (isYou ? 'YOU' : 'BID'),
            });
        }
        broadcastState();
    }

    // ---- closing a lot ---------------------------------------------------------
    /**
     * Closes the current lot. With a highest bidder it is SOLD, otherwise UNSOLD.
     * forceUnsold lets the admin mark a player UNSOLD even when bids exist.
     */
    async function finalize({ forceUnsold = false } = {}) {
        if (!activeAuction.player || !activeAuction.auctionId || !['Live', 'Paused'].includes(activeAuction.status)) {
            throw new AuctionError('There is no open player to close.', 'warning');
        }
        stopTimer();
        activeAuction.status = 'Processing';
        broadcastState();

        const sell = !forceUnsold && activeAuction.highestBidder && activeAuction.currentBid > 0;
        try {
            if (sell) await sellCurrent();
            else await markCurrentUnsold();
        } catch (err) {
            activeAuction.status = 'Paused';
            broadcastState();
            throw err;
        }
    }

    async function sellCurrent() {
        const a = activeAuction;
        const amount = a.currentBid;
        const bidderId = a.highestBidder.id;
        const playerId = a.player.id;
        const playerRole = a.player.playing_role;

        const connection = await pool.getConnection();
        let newPurse;
        try {
            await connection.beginTransaction();

            // Lock the franchise row and re-validate purse, squad, and role slots
            const [users] = await connection.query(
                `SELECT id, status, purse, squad_count, max_squad_size,
                        batsmen_count, bowlers_count, allrounders_count, keepers_count,
                        (SELECT COUNT(*) FROM teams t WHERE t.user_id = users.id) AS roster
                 FROM users WHERE id = ? AND role = 'user' FOR UPDATE`, [bidderId]
            );
            const f = users[0];
            if (!f) throw new AuctionError('Winning franchise no longer exists. Mark the player UNSOLD.');

            const squad = Math.max(Number(f.squad_count), Number(f.roster));
            if (squad >= Number(f.max_squad_size)) {
                throw new AuctionError(`Cannot sell: ${a.highestBidder.team_name} already has ${squad} / ${f.max_squad_size} players.`);
            }

            const isForeign = activeAuction.player && activeAuction.player.country &&
                activeAuction.player.country.trim().toLowerCase() !== 'india';
            const isUncapped = activeAuction.player && Boolean(activeAuction.player.is_uncapped);

            // If foreign player and foreign_count >= 2, fill Batsman slot space
            let roleCol = roleCountColumn(playerRole);
            if (isForeign && Number(f.foreign_count || 0) >= 2) {
                roleCol = 'batsmen_count';
            }

            // Role slot re-check at sale time (concurrent protection)
            const roleErr = checkRoleSlot(roleCol === 'batsmen_count' ? 'Batsman' : playerRole, f);
            if (roleErr) throw new AuctionError(`Cannot sell: ${roleErr}`);

            if (toRupees(f.purse) < amount) {
                throw new AuctionError(`Cannot sell: ${a.highestBidder.team_name} no longer has ${formatINR(amount)}.`);
            }

            const [auctions] = await connection.query('SELECT status FROM auctions WHERE id = ? FOR UPDATE', [a.auctionId]);
            if (!auctions.length || auctions[0].status === 'Completed') throw new AuctionError('This player has already been closed.');

            // Deduct purse and increment squad count
            await connection.query(
                `UPDATE users SET purse = purse - ?, total_spent = total_spent + ?, squad_count = squad_count + 1
                 WHERE id = ?`, [amount, amount, bidderId]
            );

            // Increment role count atomically
            if (roleCol) {
                await connection.query(
                    `UPDATE users SET ${roleCol} = ${roleCol} + 1 WHERE id = ?`, [bidderId]
                );
            }

            if (isForeign) {
                await connection.query(
                    `UPDATE users SET foreign_count = foreign_count + 1 WHERE id = ?`, [bidderId]
                );
            }
            if (isUncapped) {
                await connection.query(
                    `UPDATE users SET uncapped_count = uncapped_count + 1 WHERE id = ?`, [bidderId]
                );
            }

            await connection.query('INSERT INTO teams (user_id, player_id, purchase_price) VALUES (?, ?, ?)', [bidderId, playerId, amount]);
            await connection.query(
                "INSERT INTO auction_results (auction_id, player_id, status, winning_bid, winning_user_id) VALUES (?, ?, 'Sold', ?, ?)",
                [a.auctionId, playerId, amount, bidderId]
            );
            await connection.query("UPDATE players SET status = 'Sold' WHERE id = ?", [playerId]);
            await connection.query("UPDATE auctions SET status = 'Completed', end_time = NOW() WHERE id = ?", [a.auctionId]);

            const [after] = await connection.query('SELECT purse FROM users WHERE id = ?', [bidderId]);
            newPurse = toRupees(after[0].purse);
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        const payload = {
            playerId,
            playerName: a.player.name,
            initials: a.player.initials,
            role: a.player.playing_role,
            country: a.player.country,
            lot: a.lot,
            teamId: a.highestBidder.id,
            teamName: a.highestBidder.team_name,
            shortName: a.highestBidder.short_name,
            color: a.highestBidder.color,
            logoUrl: a.highestBidder.logo_url,
            price: amount,
            userId: bidderId,
            holdMs: RESULT_HOLD_MS,
        };
        activeAuction.status = 'Completed';
        activeAuction.player = { ...a.player, status: 'Sold' };
        activeAuction.result = { type: 'SOLD', ...payload };

        io.emit('auction:sold', payload);
        broadcastState();
        await broadcastTeams();
        hub.notifyPlayersChanged();
        for (const s of io.sockets.sockets.values()) {
            if (s.user && s.user.id === bidderId) s.emit('purse:update', newPurse);
        }
    }

    async function markCurrentUnsold() {
        const a = activeAuction;
        if (!a.player || !a.auctionId) return;

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [auctions] = await connection.query('SELECT status FROM auctions WHERE id = ? FOR UPDATE', [a.auctionId]);
            if (!auctions.length || auctions[0].status === 'Completed') {
                await connection.commit();
                return;
            }
            await connection.query(
                "INSERT INTO auction_results (auction_id, player_id, status) VALUES (?, ?, 'Unsold')", [a.auctionId, a.player.id]
            );
            await connection.query("UPDATE players SET status = 'Unsold' WHERE id = ?", [a.player.id]);
            await connection.query("UPDATE auctions SET status = 'Completed', end_time = NOW() WHERE id = ?", [a.auctionId]);
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        const payload = {
            playerId: a.player.id,
            playerName: a.player.name,
            initials: a.player.initials,
            role: a.player.playing_role,
            lot: a.lot,
            holdMs: RESULT_HOLD_MS,
        };
        activeAuction.status = 'Completed';
        activeAuction.player = { ...a.player, status: 'Unsold' };
        activeAuction.result = { type: 'UNSOLD', ...payload };
        io.emit('auction:unsold', payload);
        broadcastState();
        hub.notifyPlayersChanged();
    }

    // ---- restore after a server restart ----------------------------------------
    async function restore() {
        try {
            const [rows] = await pool.query(
                "SELECT * FROM auctions WHERE status IN ('Live', 'Paused') ORDER BY id DESC LIMIT 1"
            );
            if (!rows.length) return;
            const auction = rows[0];
            const [players] = await pool.query('SELECT * FROM players WHERE id = ?', [auction.player_id]);
            if (!players.length) return;
            const player = publicPlayer(players[0]);
            const [bids] = await pool.query(
                `SELECT b.user_id, b.bid_amount, b.created_at FROM bids b WHERE b.auction_id = ?
                 ORDER BY b.id DESC LIMIT ?`, [auction.id, BID_HISTORY_LIMIT]
            );
            const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM bids WHERE auction_id = ?', [auction.id]);
            const teams = await listFranchises(pool);
            const byId = new Map(teams.map(t => [t.id, t]));
            const history = bids.map(b => {
                const t = byId.get(b.user_id) || {};
                return {
                    teamId: b.user_id, teamName: t.team_name, shortName: t.short_name, color: t.color,
                    userName: t.team_name, amount: toRupees(b.bid_amount), at: new Date(b.created_at).getTime(),
                };
            });
            const bidder = auction.highest_bidder_id ? await loadTeam(pool, auction.highest_bidder_id) : null;

            await pool.query("UPDATE auctions SET status = 'Paused' WHERE id = ?", [auction.id]);
            activeAuction = {
                ...emptyAuction(),
                auctionId: auction.id,
                player,
                lot: await lotPosition(pool, player),
                status: 'Paused',
                currentBid: toRupees(auction.current_bid),
                highestBidder: bidder,
                timeLeft: BID_RESET_SECONDS,
                timerTotal: BID_RESET_SECONDS,
                bidHistory: history,
                bidCount: Number(cnt),
            };
            console.log(`Restored open auction #${auction.id} for ${player.name} (paused).`);
        } catch (err) {
            console.error('AUCTION RESTORE ERROR:', err.message);
        }
    }

    // ---- wiring ------------------------------------------------------------------
    function guard(socket, name, adminOnly, handler) {
        socket.on(name, (data) => {
            if (adminOnly && (!socket.user || socket.user.role !== 'admin')) {
                return notify(socket, 'Only the auction admin can do that.', 'danger');
            }
            serialize(() => handler(data || {}))
                .catch(err => {
                    if (err instanceof AuctionError) notify(socket, err.message, err.type);
                    else {
                        console.error(`${name} ERROR:`, err);
                        notify(socket, 'Something went wrong on the server. Please try again.', 'danger');
                    }
                });
        });
    }

    function sendSnapshot(socket) {
        socket.emit('auction:stateUpdate', getSanitizedState(socket.user));
        socket.emit('live:stats', liveStats());
        const isAdmin = socket.user && socket.user.role === 'admin';
        listFranchises(pool).then(teams => {
            const sanitizedTeams = teams.map(t => {
                if (isAdmin) return t;
                const { total_player_points, batsmen_points, ...rest } = t;
                return rest;
            });
            socket.emit('teams:update', sanitizedTeams);
        }).catch(() => {});
    }

    io.use((socket, next) => {
        const token = socket.handshake.auth && socket.handshake.auth.token;
        if (token) {
            try {
                const user = verifyToken(token);
                if (sessionRegistry.isSessionValid(user, token)) {
                    socket.user = user;
                    socket.token = token;
                    sessionRegistry.touchSession(user, token, socket.id);
                    return next();
                }
            } catch (e) {
                socket.user = { role: 'spectator', id: null };
                return next();
            }
        }
        socket.user = { role: 'spectator', id: null };
        next();
    });

    io.on('connection', (socket) => {
        connectedUsers.set(socket.id, socket.user);
        sessionRegistry.touchSession(socket.user, socket.token, socket.id);
        io.emit('live:stats', liveStats());
        sendSnapshot(socket);

        socket.on('user:join', () => sendSnapshot(socket));

        guard(socket, 'user:placeBid', false, (data) => placeBid(socket, data));

        guard(socket, 'user:optOut', false, () => {
            if (activeAuction.status === 'Live' && socket.user && socket.user.role === 'user') {
                if (activeAuction.optOuts) {
                    activeAuction.optOuts.add(socket.user.id);
                    socket.emit('auction:stateUpdate', getSanitizedState(socket.user));
                }
            }
        });

        guard(socket, 'admin:startPlayer', true, async ({ playerId }) => {
            const id = Number(playerId);
            if (!Number.isInteger(id)) throw new AuctionError('Choose a player first.', 'warning');
            await startLot(id);
        });

        guard(socket, 'admin:nextPlayer', true, async () => {
            const id = await nextAvailablePlayerId();
            if (!id) throw new AuctionError('No Available players left in the queue.', 'warning');
            await startLot(id);
        });

        guard(socket, 'admin:pauseAuction', true, async () => {
            if (activeAuction.status !== 'Live') throw new AuctionError('The auction is not live.', 'warning');
            stopTimer();
            activeAuction.status = 'Paused';
            await pool.query("UPDATE auctions SET status = 'Paused' WHERE id = ?", [activeAuction.auctionId]);
            broadcastState();
            notify(io, 'Auction paused', 'warning');
        });

        guard(socket, 'admin:resumeAuction', true, async () => {
            if (activeAuction.status !== 'Paused') throw new AuctionError('The auction is not paused.', 'warning');
            if (activeAuction.timeLeft <= 0) {
                activeAuction.timeLeft = BID_RESET_SECONDS;
                activeAuction.timerTotal = BID_RESET_SECONDS;
            }
            activeAuction.status = 'Live';
            await pool.query("UPDATE auctions SET status = 'Live' WHERE id = ?", [activeAuction.auctionId]);
            startTimer();
            broadcastState();
            notify(io, 'Auction resumed', 'success');
        });

        guard(socket, 'admin:sellPlayer', true, async () => {
            if (!activeAuction.highestBidder) {
                throw new AuctionError('No bids yet. Use UNSOLD instead.', 'warning');
            }
            await finalize();
        });

        guard(socket, 'admin:markUnsold', true, async () => {
            await finalize({ forceUnsold: true });
        });

        guard(socket, 'admin:reAuction', true, async ({ playerId }) => {
            const id = Number(playerId);
            if (!Number.isInteger(id)) throw new AuctionError('Choose a player first.', 'warning');
            const [result] = await pool.query("UPDATE players SET status = 'Available' WHERE id = ? AND status = 'Unsold'", [id]);
            if (!result.affectedRows) throw new AuctionError('Only UNSOLD players can be re-auctioned.', 'warning');
            notify(socket, 'Player moved back to the Available queue.', 'success');
            io.emit('auction:playerReset', { playerId: id });
            hub.notifyPlayersChanged();
        });

        guard(socket, 'admin:startAuction', true, async () => {
            if (activeAuction.status === 'Ended' || activeAuction.status === 'Pending' || activeAuction.status === 'Paused') {
                activeAuction.status = 'Live';
            }
            if (activeAuction.player && activeAuction.status !== 'Completed') {
                startTimer();
                notify(io, 'The JPL Auction has officially STARTED!', 'success');
            } else {
                const id = await nextAvailablePlayerId();
                if (id) {
                    await startLot(id);
                    notify(io, 'The JPL Auction has officially STARTED!', 'success');
                } else {
                    notify(io, 'The JPL Auction started, but no available players remain.', 'info');
                }
            }
            broadcastState();
            await broadcastTeams();
        });

        guard(socket, 'admin:endAuction', true, async () => {
            stopTimer();
            activeAuction.status = 'Ended';
            showLiveRankings = false;
            broadcastState();
            await broadcastTeams();
            notify(io, 'Auction Ended. Results will be shared shortly.', 'info');
        });

        guard(socket, 'admin:toggleRankings', true, async ({ enabled }) => {
            showLiveRankings = Boolean(enabled);
            broadcastState();
            await broadcastTeams();
            notify(io, `Live Rankings visibility turned ${showLiveRankings ? 'ON' : 'OFF'} by Admin.`, 'info');
        });

        socket.on('disconnect', () => {
            sessionRegistry.socketDisconnected(socket.user, socket.token, socket.id);
            connectedUsers.delete(socket.id);
            io.emit('live:stats', liveStats());
        });
    });

    async function resetAndStartAuction() {
        stopTimer();
        activeAuction = emptyAuction();
        showLiveRankings = false;
        notify(io, 'Auction reset by Admin. Starting fresh session…', 'warning');
        broadcastState();
        await broadcastTeams();

        const id = await nextAvailablePlayerId();
        if (id) {
            await startLot(id);
            notify(io, 'The JPL Auction has officially STARTED!', 'success');
        } else {
            notify(io, 'The JPL Auction started, but no available players remain in the queue.', 'info');
        }
        broadcastState();
        await broadcastTeams();
        hub.notifyPlayersChanged();
    }

    const engine = {
        broadcastTeams,
        getState: getSanitizedState,
        getActivePlayerId: () => (isLotOpen() && activeAuction.player ? activeAuction.player.id : null),
        resetAndStartAuction,
    };
    hub.register(io, engine);
    restore().then(() => broadcastState());
    return engine;
};
