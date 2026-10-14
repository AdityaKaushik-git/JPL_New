const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const mysql = require('mysql2/promise');
require('dotenv').config();

const BASE = 'http://localhost:3000';

let serverProcess = null;
let adminToken = null;
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

function connectSocket(token = null) {
    return new Promise((resolve, reject) => {
        const socket = io(BASE, {
            auth: token ? { token } : {},
            transports: ['websocket'],
            forceNew: true,
        });
        socket.once('connect', () => resolve(socket));
        socket.once('connect_error', reject);
    });
}

function waitForEvent(socket, event, timeout = 4000) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), timeout);
        socket.once(event, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

describe('Declare Result on Live Screen verification', () => {
    before(async () => {
        const loginRes = await api('/api/auth/login', {
            method: 'POST',
            body: { loginId: 'ADMIN001', password: 'admin123' },
        });
        assert.equal(loginRes.status, 200, 'Admin login should succeed');
        adminToken = loginRes.data.token;
    });

    test('1. When Declare Result is OFF, spectator receives empty teams list', async () => {
        const adminSocket = await connectSocket(adminToken);
        // Ensure rankings are OFF initially
        adminSocket.emit('admin:toggleRankings', { enabled: false });
        await new Promise(r => setTimeout(r, 400));

        const spectatorSocket = await connectSocket(null);
        const teams = await waitForEvent(spectatorSocket, 'teams:update');
        assert.ok(Array.isArray(teams));
        assert.equal(teams.length, 0, 'Spectator must receive empty teams when Declare Result is OFF');

        spectatorSocket.close();
        adminSocket.close();
    });

    test('2. When admin clicks Declare Result (ON), spectator receives showLiveRankings: true AND all franchises', async () => {
        const adminSocket = await connectSocket(adminToken);
        const spectatorSocket = await connectSocket(null);

        let receivedState = null;
        let receivedTeams = null;

        spectatorSocket.on('auction:stateUpdate', (st) => {
            if (st.showLiveRankings) receivedState = st;
        });
        spectatorSocket.on('teams:update', (list) => {
            if (list && list.length > 0) receivedTeams = list;
        });

        // Admin toggles Declare Result ON
        adminSocket.emit('admin:toggleRankings', { enabled: true });

        // Wait for spectator to receive events
        const start = Date.now();
        while ((!receivedState || !receivedTeams) && Date.now() - start < 4000) {
            await new Promise(r => setTimeout(r, 100));
        }

        assert.ok(receivedState, 'Spectator must receive auction:stateUpdate with showLiveRankings: true');
        assert.equal(receivedState.showLiveRankings, true);
        assert.ok(receivedTeams, 'Spectator must receive teams:update with franchises');
        assert.ok(receivedTeams.length > 0, 'Teams list must not be empty');

        spectatorSocket.close();
        adminSocket.close();
    });

    test('3. New spectator connecting while Declare Result is ON receives teams in initial snapshot', async () => {
        // Connect new spectator without token
        const spectatorSocket = await connectSocket(null);

        let snapshotState = null;
        let snapshotTeams = null;

        spectatorSocket.on('auction:stateUpdate', (st) => {
            snapshotState = st;
        });
        spectatorSocket.on('teams:update', (list) => {
            snapshotTeams = list;
        });

        const start = Date.now();
        while ((!snapshotState || !snapshotTeams) && Date.now() - start < 4000) {
            await new Promise(r => setTimeout(r, 100));
        }

        assert.ok(snapshotState, 'New spectator receives initial state');
        assert.equal(snapshotState.showLiveRankings, true, 'showLiveRankings is true in snapshot');
        assert.ok(snapshotTeams && snapshotTeams.length > 0, 'New spectator receives full teams list in initial snapshot');

        spectatorSocket.close();
    });

    test('4. Admin clicks Declare Result (OFF), spectator receives showLiveRankings: false and teams cleared', async () => {
        const adminSocket = await connectSocket(adminToken);
        const spectatorSocket = await connectSocket(null);

        let stateOff = false;
        let teamsCleared = false;

        spectatorSocket.on('auction:stateUpdate', (st) => {
            if (st.showLiveRankings === false) stateOff = true;
        });
        spectatorSocket.on('teams:update', (list) => {
            if (Array.isArray(list) && list.length === 0) teamsCleared = true;
        });

        adminSocket.emit('admin:toggleRankings', { enabled: false });

        const start = Date.now();
        while ((!stateOff || !teamsCleared) && Date.now() - start < 4000) {
            await new Promise(r => setTimeout(r, 100));
        }

        assert.ok(stateOff, 'Spectator receives stateUpdate with showLiveRankings: false');
        assert.ok(teamsCleared, 'Spectator receives empty teams list when results turned OFF');

        spectatorSocket.close();
        adminSocket.close();
    });
});
