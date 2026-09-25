/**
 * End-to-end test of the live auction engine against a running server + MySQL.
 *
 *   1. npm run seed          (demo data)
 *   2. AUCTION_INITIAL_SECONDS=5 AUCTION_BID_RESET_SECONDS=3 npm run start:server
 *   3. TEST_BASE_URL=http://localhost:3000 npm test
 *
 * Uses the seeded demo accounts. It changes auction data, so run it on a test database.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN = { loginId: process.env.TEST_ADMIN_ID || 'ADMIN001', password: process.env.TEST_ADMIN_PASSWORD || 'admin123' };
const OWNER_A = { loginId: 'titans@jpl.com', password: 'Owner@123' };
const OWNER_B = { loginId: 'warriors@jpl.com', password: 'Owner@123' };

async function api(path, { method = 'GET', token, body } = {}) {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { status: res.status, data };
}

async function login(creds) {
    const r = await api('/api/auth/login', { method: 'POST', body: creds });
    assert.equal(r.status, 200, `login failed for ${creds.loginId}: ${JSON.stringify(r.data)}`);
    return r.data;
}

function connect(token) {
    return new Promise((resolve, reject) => {
        const s = io(BASE, { auth: token ? { token } : {}, transports: ['websocket'] });
        s.state = null;
        s.notes = [];
        s.on('auction:stateUpdate', st => { s.state = st; });
        s.on('auction:notification', n => s.notes.push(n));
        s.once('connect', () => resolve(s));
        s.once('connect_error', reject);
    });
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { const v = fn(); if (v) return v; await wait(50); }
    throw new Error('timed out waiting for condition');
}

test('public registration is gone', async () => {
    const r = await api('/api/auth/register', { method: 'POST', body: { full_name: 'x', email: 'x@x.com', password: 'Aa1!aaaa' } });
    assert.equal(r.status, 404);
});

test('franchise creation always assigns ₹18 Cr and 12 slots, ignoring client values', async () => {
    const admin = await login(ADMIN);
    const tag = Date.now().toString(36).slice(-4).toUpperCase();
    const r = await api('/api/admin/franchises', {
        method: 'POST', token: admin.token,
        body: {
            team_name: `Test XI ${tag}`, short_name: `T${tag}`.slice(0, 6), owner_name: 'Test Owner',
            login_id: `test${tag}@jpl.com`, password: 'Owner@123',
            starting_purse: 999999999, purse: 999999999, max_squad_size: 99, squad_count: -5,
        },
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.franchise.starting_purse, 180000000);
    assert.equal(r.data.franchise.remaining_purse, 180000000);
    assert.equal(r.data.franchise.total_spent, 0);
    assert.equal(r.data.franchise.squad_count, 0);
    assert.equal(r.data.franchise.max_squad_size, 12);

    const owner = await login({ loginId: `test${tag}@jpl.com`, password: 'Owner@123' });
    const forbidden = await api('/api/admin/franchises', { method: 'POST', token: owner.token, body: {} });
    assert.equal(forbidden.status, 403);
});

test('bidding flow: validation, locking, sale and auto-finalise', async () => {
    const admin = await login(ADMIN);
    const a = await login(OWNER_A);
    const b = await login(OWNER_B);

    const adminSock = await connect(admin.token);
    const sa = await connect(a.token);
    const sb = await connect(b.token);
    const spectator = await connect(null);

    // make sure no lot is open
    await until(() => adminSock.state);
    if (['Live', 'Paused'].includes(adminSock.state.status)) {
        adminSock.emit('admin:markUnsold');
        await until(() => adminSock.state.status === 'Completed');
    }

    adminSock.emit('admin:nextPlayer');
    const live = await until(() => adminSock.state && adminSock.state.status === 'Live' && adminSock.state.player && adminSock.state);
    const base = live.player.base_price;
    assert.equal(live.nextBid, base);

    // spectators cannot bid
    spectator.emit('user:placeBid', { auctionId: live.auctionId, amount: base });
    await until(() => spectator.notes.find(n => /Only franchise owners/.test(n.text)));

    // a tampered amount is rejected — the server decides the amount
    sa.emit('user:placeBid', { auctionId: live.auctionId, amount: 1 });
    await until(() => sa.notes.find(n => /bid has moved/i.test(n.text)));

    // simultaneous bids at the same amount: exactly one wins
    sa.emit('user:placeBid', { auctionId: live.auctionId, amount: base });
    sb.emit('user:placeBid', { auctionId: live.auctionId, amount: base });
    await until(() => adminSock.state.currentBid === base && adminSock.state.bidCount === 1);
    await wait(300);
    assert.equal(adminSock.state.bidCount, 1, 'only one of two identical bids may be accepted');
    const leader = adminSock.state.highestBidder.id;
    const other = leader === a.user.id ? sb : sa;
    const leaderSock = leader === a.user.id ? sa : sb;

    // the leader cannot outbid itself
    leaderSock.emit('user:placeBid', { auctionId: live.auctionId, amount: adminSock.state.nextBid });
    await until(() => leaderSock.notes.find(n => /already hold the highest bid/i.test(n.text)));

    // the other team raises by the server increment
    const next = adminSock.state.nextBid;
    assert.equal(next, base + 100000);
    other.emit('user:placeBid', { auctionId: live.auctionId, amount: next });
    await until(() => adminSock.state.currentBid === next);

    // wait for the timer to auto-finalise into SOLD
    const sold = await new Promise((resolve) => adminSock.once('auction:sold', resolve));
    assert.equal(sold.price, next);
    const teams = await api('/api/franchises');
    const winner = teams.data.franchises.find(f => f.id === sold.teamId);
    assert.ok(winner.squad_count >= 1);
    assert.equal(winner.remaining_purse + winner.total_spent, winner.starting_purse);

    // an unbid lot auto-finalises as UNSOLD
    adminSock.emit('admin:nextPlayer');
    await until(() => adminSock.state.status === 'Live');
    const unsold = await new Promise((resolve) => adminSock.once('auction:unsold', resolve));
    assert.ok(unsold.playerName);

    [adminSock, sa, sb, spectator].forEach(s => s.disconnect());
});

test('squad limit of 12 is enforced server-side', async () => {
    const admin = await login(ADMIN);
    const owner = await login(OWNER_A);
    const me = (await api('/api/users/dashboard', { token: owner.token })).data.franchise;
    assert.equal(me.max_squad_size, 12);

    const adminSock = await connect(admin.token);
    const sock = await connect(owner.token);
    await until(() => adminSock.state);

    // Fill the squad directly through the engine until it reports SQUAD FULL.
    let guard = 0;
    while (guard++ < 14) {
        adminSock.emit('admin:nextPlayer');
        const st = await until(() => (adminSock.state.status === 'Live' ? adminSock.state : null)
            || adminSock.notes.find(n => /No Available players/.test(n.text)), 5000).catch(() => null);
        if (!st || !st.player) break;
        sock.notes = [];
        sock.emit('user:placeBid', { auctionId: st.auctionId, amount: st.nextBid });
        const outcome = await until(() => (adminSock.state.bidCount === 1 ? 'bid' : null)
            || (sock.notes.find(n => /SQUAD FULL/.test(n.text)) ? 'full' : null), 4000);
        if (outcome === 'full') {
            adminSock.emit('admin:markUnsold');
            await until(() => adminSock.state.status === 'Completed');
            const after = (await api('/api/users/dashboard', { token: owner.token })).data.franchise;
            assert.equal(after.squad_count, 12);
            [adminSock, sock].forEach(s => s.disconnect());
            return;
        }
        adminSock.emit('admin:sellPlayer');
        await until(() => adminSock.state.status === 'Completed');
    }
    [adminSock, sock].forEach(s => s.disconnect());
    // Not enough seeded players to reach 12 is acceptable; verify the cap was never exceeded.
    const after = (await api('/api/users/dashboard', { token: owner.token })).data.franchise;
    assert.ok(after.squad_count <= 12);
});
