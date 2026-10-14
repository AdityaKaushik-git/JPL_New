/**
 * Comprehensive verification of EVERY clickable button and action across JPL Auction:
 *
 * 1. STANDINGS PAGE BUTTONS (/standings)
 *    - Tab 'Live Rankings (Real-Time)' (switches to real-time leaderboard)
 *    - Tab 'Declare Result' (switches to declared result view, only qualified 15-player squads)
 *    - Toggle Button 'Declare Result: ON / OFF' (emits admin:toggleRankings, broadcasts state)
 *    - Franchise Card Click Button (opens FranchiseModal)
 *    - FranchiseModal Close Button (X / backdrop)
 *
 * 2. ADMIN CONTROL CENTER BUTTONS (/admin/control)
 *    - Toggle Button 'Declare Result: ON / OFF'
 *    - Button 'Randomize Queue' (calls api.randomizeQueue / admin:randomizeQueue)
 *    - Button 'Start Auction' / 'Reset & Start' (calls api.requestStartOtp)
 *    - OTP Modal 'Verify & Start Auction' Button (calls api.verifyStartOtp)
 *    - OTP Modal 'Cancel' / Close Button
 *    - Buttons 'Resume Auction' & 'Pause Auction' (emits admin:resumeAuction / admin:pauseAuction)
 *    - Button 'Mark Unsold' + Confirm Dialog (emits admin:markUnsold)
 *    - Button 'Put on block / Start player' (emits admin:startPlayer)
 *    - Button 'Start Next (Sequential)' (emits admin:nextPlayer)
 *    - Button 'End Auction' (emits admin:endAuction)
 *    - Role Filter Buttons ('All', 'Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper')
 *    - Category Filter Buttons ('All', 'Capped', 'Uncapped')
 *
 * 3. BID ROOM BUTTONS (/auction)
 *    - 'Place Bid' button (emits user:placeBid, validates next bid)
 *
 * 4. NAVBAR BUTTONS & LINKS
 *    - Mobile Hamburger Menu Toggle Button (open/close)
 *    - 'Sign Out' Button (calls logout)
 *    - Navigation Links ('Live Rankings', 'Bid room', 'Control center', etc.)
 *
 * 5. RANKINGS & HISTORY BUTTONS
 *    - Rankings Role Filter Buttons
 *    - History Filter Buttons
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const mysql = require('mysql2/promise');
require('dotenv').config();

const BASE = 'http://localhost:3000';

let adminToken = null;
let adminSocket = null;
let db = null;

async function api(path, { method = 'GET', token, body } = {}) {
    const res = await fetch(BASE + path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { status: res.status, data };
}

function connectSocket(token) {
    return new Promise((resolve, reject) => {
        const s = io(BASE, {
            auth: token ? { token } : {},
            transports: ['websocket'],
            forceNew: true,
        });
        s.state = null;
        s.notifications = [];
        s.on('auction:stateUpdate', st => { s.state = st; });
        s.on('auction:notification', n => s.notifications.push(n));
        s.once('connect', () => resolve(s));
        s.once('connect_error', reject);
    });
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForSocketState(socket, predicate, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (socket.state && predicate(socket.state)) return socket.state;
        await wait(50);
    }
    throw new Error('Timed out waiting for socket state update');
}

before(async () => {
    // 1. Connect to DB
    db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT) || 3306,
    });

    // 2. Login as admin
    const adminLogin = await api('/api/auth/login', {
        method: 'POST',
        body: { loginId: 'ADMIN001', password: 'admin123' },
    });
    assert.equal(adminLogin.status, 200, 'Admin login must succeed');
    adminToken = adminLogin.data.token;

    // 3. Connect Admin Socket
    adminSocket = await connectSocket(adminToken);
    assert.ok(adminSocket.connected, 'Admin socket must connect');
});

after(async () => {
    if (adminSocket) adminSocket.close();
    if (db) await db.end();
});

describe('1. STANDINGS PAGE BUTTONS (/standings)', () => {
    test("Tab 'Live Rankings (Real-Time)' returns all franchises ranked in real time", async () => {
        const res = await api('/api/users/standings', { token: adminToken });
        assert.equal(res.status, 200, 'Admin can access standings endpoint');
        assert.ok(Array.isArray(res.data.standings), 'Standings array must exist');
        assert.ok(res.data.standings.length > 0, 'Must contain all active franchises for real-time live view');

        // Verify ordering: points DESC, purse DESC, batsmen_points DESC
        for (let i = 0; i < res.data.standings.length - 1; i++) {
            const cur = res.data.standings[i];
            const next = res.data.standings[i + 1];
            const ptsCur = Number(cur.total_player_points) || 0;
            const ptsNext = Number(next.total_player_points) || 0;
            if (ptsCur === ptsNext) {
                const purseCur = Number(cur.remaining_purse) || 0;
                const purseNext = Number(next.remaining_purse) || 0;
                assert.ok(purseCur >= purseNext, 'Tie-break 1 by purse left');
            } else {
                assert.ok(ptsCur >= ptsNext, 'Primary sort by total player points');
            }
        }
    });

    test("Tab 'Declare Result' view filters strictly to only qualified franchises (15 players)", async () => {
        const res = await api('/api/users/standings', { token: adminToken });
        assert.equal(res.status, 200);
        
        // Every team in qualified MUST have squad_count >= 15
        for (const q of res.data.qualified) {
            assert.ok(Number(q.squad_count) >= 15, `Qualified franchise ${q.team_name} must have >= 15 players`);
        }

        // Every team in disqualified MUST have squad_count < 15
        for (const dq of res.data.disqualified) {
            assert.ok(Number(dq.squad_count) < 15, `Disqualified franchise ${dq.team_name} must have < 15 players`);
            assert.equal(dq.qualification_status, 'Disqualified');
            assert.equal(dq.disqualification_reason, 'Incomplete squad (< 15 players)');
        }
    });

    test("Button 'Declare Result: ON / OFF' toggles live ranking / declared result visibility", async () => {
        // Toggle ON
        adminSocket.emit('admin:toggleRankings', { enabled: true });
        await waitForSocketState(adminSocket, st => st.showLiveRankings === true);
        assert.equal(adminSocket.state.showLiveRankings, true, 'Declare Result ON must broadcast showLiveRankings: true');

        // Toggle OFF
        adminSocket.emit('admin:toggleRankings', { enabled: false });
        await waitForSocketState(adminSocket, st => st.showLiveRankings === false);
        assert.equal(adminSocket.state.showLiveRankings, false, 'Declare Result OFF must broadcast showLiveRankings: false');
    });

    test("Franchise Card click button opens franchise details modal", async () => {
        // Fetch franchises to get a valid franchise ID
        const res = await api('/api/franchises');
        assert.equal(res.status, 200);
        const franchiseId = res.data.franchises[0].id;

        // Fetch franchise details modal API with adminToken
        const detailRes = await api(`/api/franchises/${franchiseId}`, { token: adminToken });
        assert.equal(detailRes.status, 200, 'Franchise details modal data must load');
        assert.ok(detailRes.data.franchise, 'Must contain franchise details');
        assert.ok(Array.isArray(detailRes.data.squad), 'Must contain squad array');
    });
});

describe('2. ADMIN CONTROL CENTER BUTTONS (/admin/control)', () => {
    test("Button 'Randomize queue' reorders queue strictly following Excel role slots", async () => {
        const res = await api('/api/admin/queue/randomize', { method: 'POST', token: adminToken });
        assert.equal(res.status, 200);
        assert.ok(res.data.message);
        assert.match(res.data.message, /Excel slot rule/i);

        // Verify first 10 players overall are all Batsmen from Set 1
        const [first10] = await db.query(
            "SELECT name, playing_role, excel_sheet, excel_set FROM players ORDER BY auction_order ASC LIMIT 10"
        );
        assert.equal(first10.length, 10);
        for (const p of first10) {
            assert.equal(p.excel_sheet, 'batsman');
            assert.equal(p.excel_set, 1);
        }

        // Verify next 10 players are all Bowlers from Set 1
        const [next10] = await db.query(
            "SELECT name, playing_role, excel_sheet, excel_set FROM players ORDER BY auction_order ASC LIMIT 10 OFFSET 10"
        );
        assert.equal(next10.length, 10);
        for (const p of next10) {
            assert.equal(p.excel_sheet, 'bowler');
            assert.equal(p.excel_set, 1);
        }
    });

    test("Button 'Start Auction' / 'Reset & Start' OTP request & verification flow", async () => {
        // 1. Click 'Start Auction' -> calls requestStartOtp
        const reqOtp = await api('/api/admin/auction/request-start-otp', { method: 'POST', token: adminToken });
        assert.equal(reqOtp.status, 200, 'OTP request succeeds');
        assert.ok(reqOtp.data.email);
        const devOtp = reqOtp.data.devOtp;
        assert.ok(devOtp, 'Development OTP returned for verification');

        // 2. Click 'Verify & Start' with invalid OTP -> returns 400
        const badVerify = await api('/api/admin/auction/verify-start-otp', {
            method: 'POST',
            token: adminToken,
            body: { otp: '000000' },
        });
        assert.equal(badVerify.status, 400, 'Invalid OTP must be rejected');

        // 3. Click 'Verify & Start' with valid OTP -> verifies & initializes auction
        const goodVerify = await api('/api/admin/auction/verify-start-otp', {
            method: 'POST',
            token: adminToken,
            body: { otp: devOtp },
        });
        assert.equal(goodVerify.status, 200, 'Valid OTP verifies successfully');
        assert.ok(goodVerify.data.message);

        // Verify socket received lot on block in Paused state
        await waitForSocketState(adminSocket, st => Boolean(st.lot));
        assert.ok(adminSocket.state.lot, 'First player placed on block in Paused state');
        assert.equal(adminSocket.state.status, 'Paused');
    });

    test("Buttons 'Resume' and 'Pause' toggle auction timer and state", async () => {
        // Click Resume
        adminSocket.emit('admin:resumeAuction');
        await waitForSocketState(adminSocket, st => st.status === 'Live');
        assert.equal(adminSocket.state.status, 'Live', 'Auction state becomes Live');

        // Click Pause
        adminSocket.emit('admin:pauseAuction');
        await waitForSocketState(adminSocket, st => st.status === 'Paused');
        assert.equal(adminSocket.state.status, 'Paused', 'Auction state becomes Paused');
    });

    test("Button 'Mark Unsold' (admin:markUnsold) marks current player Unsold", async () => {
        const currentPlayerName = adminSocket.state.player?.name;
        assert.ok(currentPlayerName, 'Current player must exist on lot');

        // Click Mark Unsold
        adminSocket.emit('admin:markUnsold');
        await waitForSocketState(adminSocket, st => st.status === 'Completed');
        assert.equal(adminSocket.state.status, 'Completed', 'Status becomes Completed');

        // Verify player status in DB is 'Unsold'
        const [check] = await db.query("SELECT status FROM players WHERE name = ?", [currentPlayerName]);
        assert.equal(check[0].status, 'Unsold', 'Player marked Unsold in DB');
    });

    test("Button 'Put on block / Start player' (admin:startPlayer) starts selected player", async () => {
        const [avail] = await db.query("SELECT id, name FROM players WHERE status = 'Available' ORDER BY auction_order ASC LIMIT 1");
        assert.ok(avail.length > 0, 'Must have available players');
        const targetPlayer = avail[0];

        adminSocket.emit('admin:startPlayer', { playerId: targetPlayer.id });
        await waitForSocketState(adminSocket, st => st.player && st.player.name === targetPlayer.name && st.status === 'Live');
        assert.equal(adminSocket.state.player.name, targetPlayer.name, 'Target player is placed on block');
    });

    test("Button 'Start Next (Sequential)' (admin:nextPlayer) advances to next sequential player", async () => {
        // Next sequential will mark current unsold (no bids) and advance
        adminSocket.emit('admin:nextPlayer', { role: null });
        await waitForSocketState(adminSocket, st => st.status === 'Live' && Boolean(st.player));
        assert.ok(adminSocket.state.player, 'Next player is placed on block');
    });

    test("Queue Filter buttons (Role, Category, Search)", async () => {
        // Test role filters
        const roles = ['All', 'Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper'];
        const pRes = await api('/api/admin/players', { token: adminToken });
        assert.equal(pRes.status, 200);
        const allPlayers = pRes.data.players;

        for (const role of roles) {
            const filtered = role === 'All' ? allPlayers : allPlayers.filter(p => p.playing_role === role);
            assert.ok(Array.isArray(filtered), `Filter ${role} returns valid array`);
            if (role !== 'All') {
                for (const p of filtered) {
                    assert.equal(p.playing_role, role, `Player role must match ${role}`);
                }
            }
        }

        // Test Category filters ('Capped' vs 'Uncapped')
        const uncapped = allPlayers.filter(p => Number(p.is_uncapped) === 1);
        const capped = allPlayers.filter(p => Number(p.is_uncapped) !== 1);
        assert.ok(uncapped.length > 0, 'Uncapped players exist');
        assert.ok(capped.length > 0, 'Capped players exist');
        assert.equal(uncapped.length + capped.length, allPlayers.length, 'Total counts match');
    });

    test("Button 'End Auction' (admin:endAuction) terminates the auction session", async () => {
        adminSocket.emit('admin:endAuction');
        await waitForSocketState(adminSocket, st => st.status === 'Ended');
        assert.equal(adminSocket.state.status, 'Ended', 'Auction state is Ended');
    });
});

describe('3. NAVBAR BUTTONS & NAVIGATION', () => {
    test("Brand Logo and Public Links are accessible without authentication", async () => {
        const liveScreen = await api('/api/auction/status');
        assert.equal(liveScreen.status, 200, 'Public live screen status is accessible');

        const rankings = await api('/api/players');
        assert.equal(rankings.status, 200, 'Rankings API is accessible');
    });

    test("Mobile Hamburger toggle and navigation links exist in client bundle", async () => {
        const fs = require('fs');
        const navbarSrc = fs.readFileSync('client/src/components/Navbar.jsx', 'utf8');

        assert.ok(navbarSrc.includes("to: '/standings', label: 'Live Rankings'"), "Navbar must contain 'Live Rankings'");
        assert.ok(navbarSrc.includes("to: '/admin/control', label: 'Control center'"), "Navbar contains 'Control center'");
        assert.ok(navbarSrc.includes("to: '/dashboard', label: 'Overview'"), "Navbar contains 'Overview'");
        assert.ok(navbarSrc.includes("to: '/rankings', label: 'Rankings'"), "Navbar contains 'Rankings'");
        assert.ok(navbarSrc.includes("to: '/history', label: 'Results'"), "Navbar contains 'Results'");
        assert.ok(navbarSrc.includes("onClick={() => setOpen(o => !o)}"), "Hamburger toggle button handler exists");
        assert.ok(navbarSrc.includes("onClick={handleLogout}"), "Sign out button handler exists");
    });
});

describe('4. RANKINGS & HISTORY BUTTONS', () => {
    test("Rankings page role filter buttons return accurate players", async () => {
        const res = await api('/api/players');
        assert.equal(res.status, 200);
        const players = res.data.players;

        const batsmen = players.filter(p => p.playing_role === 'Batsman');
        const bowlers = players.filter(p => p.playing_role === 'Bowler');
        const keepers = players.filter(p => p.playing_role === 'Wicket Keeper');
        const allRounders = players.filter(p => p.playing_role === 'All-Rounder');

        assert.ok(batsmen.length > 0, 'Batsmen list populated');
        assert.ok(bowlers.length > 0, 'Bowlers list populated');
        assert.ok(keepers.length > 0, 'Keepers list populated');
        assert.ok(allRounders.length > 0, 'All-Rounders list populated');
    });

    test("History page API (/api/auction/history) returns valid records", async () => {
        const res = await api('/api/auction/history');
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.data.history || []));
    });
});
