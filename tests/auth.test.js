const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

test('Admin login and getMe work on first attempt', async () => {
    const res = await fetch(BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: 'ADMIN001', password: 'admin123' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
    assert.equal(data.user?.role, 'admin');

    const meRes = await fetch(BASE + '/api/auth/me', {
        headers: { 'Authorization': `Bearer ${data.token}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user?.role, 'admin');
});

test('Franchise user login and getMe work on first attempt', async () => {
    const res = await fetch(BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: 'testS8WE@jpl.com', password: 'Owner@123' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
    assert.equal(data.user?.role, 'user');

    const meRes = await fetch(BASE + '/api/auth/me', {
        headers: { 'Authorization': `Bearer ${data.token}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user?.role, 'user');
});

test('Login succeeds even if request contains a stale Bearer token', async () => {
    const res = await fetch(BASE + '/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer bad-stale-token-xyz',
        },
        body: JSON.stringify({ loginId: 'ADMIN001', password: 'admin123' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
});
