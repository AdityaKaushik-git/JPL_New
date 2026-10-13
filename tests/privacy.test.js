const { test } = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function login(loginId, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId, password }),
  });
  const data = await res.json();
  return data.token;
}

function connectSocket(token) {
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

function waitForEvent(socket, event, timeout = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeout);
    socket.on(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

test('Spectator (Live Screen) receives NO franchise info via socket', async () => {
  const socket = await connectSocket(null);
  const teams = await waitForEvent(socket, 'teams:update');
  assert.ok(Array.isArray(teams));
  assert.equal(teams.length, 0, 'Spectators on live screen must receive empty teams list');
  socket.close();
});

test('Franchise user (Bid Room) receives ONLY their own franchise data', async () => {
  const token = await login('testS8WE@jpl.com', 'Owner@123');
  assert.ok(token);

  const socket = await connectSocket(token);
  const teams = await waitForEvent(socket, 'teams:update');
  assert.ok(Array.isArray(teams));
  assert.equal(teams.length, 1, 'Franchise user should only receive their own franchise');
  assert.equal(teams[0].id, 57);
  assert.equal(teams[0].short_name, 'TS8WE');
  socket.close();
});

test('Admin receives all franchises', async () => {
  const token = await login('ADMIN001', 'admin123');
  assert.ok(token);

  const socket = await connectSocket(token);
  const teams = await waitForEvent(socket, 'teams:update');
  assert.ok(Array.isArray(teams));
  assert.ok(teams.length > 1, 'Admin must receive all franchises');
  socket.close();
});
