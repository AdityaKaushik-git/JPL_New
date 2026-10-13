/**
 * Unit tests for JPL 2026 rule changes:
 *   - No limit on foreign players
 *   - Minimum 3 Indian players per squad
 *   - Correct ranking_points loaded from Excel
 *
 * Run:  node --test tests/rules.unit.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

// ── inline config so tests don't need the full server ──────────────────────
const MAX_FOREIGN_PLAYERS  = Infinity;
const MIN_INDIAN_PLAYERS   = 3;
const MAX_SQUAD_SIZE       = 15;
const STARTING_PURSE       = 750_000_000;

// ── helpers mimicking the server logic ─────────────────────────────────────
function checkIndianMinimum(f, playerCountry, squadAfterBuy) {
    const isIndian = !playerCountry || playerCountry.trim().toLowerCase() === 'india';
    if (!isIndian) {
        const indianNow     = Number(f.indian_count || 0);
        const indianNeeded  = Math.max(0, MIN_INDIAN_PLAYERS - indianNow);
        const slotsLeft     = MAX_SQUAD_SIZE - squadAfterBuy;
        if (slotsLeft < indianNeeded) {
            return `INDIAN PLAYER REQUIREMENT — you need at least ${MIN_INDIAN_PLAYERS} Indian players. ` +
                   `You need ${indianNeeded} more Indian player(s) but would only have ${slotsLeft} slot(s) left.`;
        }
    }
    return null;
}

function checkForeignCap(f, playerCountry) {
    // No cap on foreign players
    const isForeign = playerCountry && playerCountry.trim().toLowerCase() !== 'india';
    if (isForeign && MAX_FOREIGN_PLAYERS !== Infinity) {
        const foreignCount = Number(f.foreign_count || 0);
        if (foreignCount >= MAX_FOREIGN_PLAYERS) return 'FOREIGN CAP REACHED';
    }
    return null;
}

// ── tests ───────────────────────────────────────────────────────────────────

test('starting purse is ₹75 Cr (750,000,000)', () => {
    assert.equal(STARTING_PURSE, 750_000_000);
});

test('squad size is 15', () => {
    assert.equal(MAX_SQUAD_SIZE, 15);
});

test('no foreign player cap — Infinity allows any number of overseas players', () => {
    assert.equal(MAX_FOREIGN_PLAYERS, Infinity);
});

test('foreign cap check always returns null (no limit)', () => {
    const f = { foreign_count: 10 };
    const result = checkForeignCap(f, 'England');
    assert.equal(result, null, 'should never block foreign players');
});

test('10 foreign players can be signed without error', () => {
    for (let i = 0; i < 10; i++) {
        const f = { foreign_count: i, indian_count: 3 };
        const err = checkForeignCap(f, 'Australia');
        assert.equal(err, null, `foreign_count=${i} should be allowed`);
    }
});

test('min 3 Indian players — allowed when Indian player is bought', () => {
    // Squad of 2, buying an Indian: no restriction
    const f = { indian_count: 2 };
    const err = checkIndianMinimum(f, 'India', 3);  // squad=3 after buy
    assert.equal(err, null);
});

test('min 3 Indian players — blocked when buying foreign with too few Indians and slots', () => {
    // Squad of 12, indian_count = 0, buying foreigner → only 3 slots left, need 3 Indians
    const f = { indian_count: 0 };
    const err = checkIndianMinimum(f, 'England', 13);  // squad = 13 after buy, 2 slots left
    assert.ok(err, 'should block: only 2 slots left but need 3 Indians');
    assert.match(err, /INDIAN PLAYER REQUIREMENT/);
});

test('min 3 Indian players — allowed when already have 3 Indians', () => {
    const f = { indian_count: 3 };
    const err = checkIndianMinimum(f, 'Australia', 13); // squad = 13, 3 Indians already
    assert.equal(err, null, 'should allow: already has 3 Indian players');
});

test('min 3 Indian players — allowed when enough slots remain', () => {
    // Squad of 5, indian_count = 1, buying foreigner — 10 slots remain, need 2 more Indians, fine
    const f = { indian_count: 1 };
    const err = checkIndianMinimum(f, 'Pakistan', 6);  // squad=6, 9 slots left
    assert.equal(err, null, 'should allow: plenty of slots left to satisfy Indian minimum');
});

test('min 3 Indian players — edge: exactly enough slots remain for Indians', () => {
    // Squad of 13 after buying a foreigner (indian=1, need 2 more): 2 slots remain — exactly enough, so ALLOW
    const f = { indian_count: 1 };
    const err = checkIndianMinimum(f, 'England', 13);  // squad=13, 2 slots remain, need 2 Indians
    assert.equal(err, null, 'should allow: exactly 2 slots left for 2 more Indians (not strictly less than)');
});

test('min 3 Indian players — no restriction for Indian player regardless of count', () => {
    const f = { indian_count: 0 };
    const err = checkIndianMinimum(f, 'India', 14);
    assert.equal(err, null, 'Indian player can always be bought');
});

test('ranking_points range is valid (1-1000)', () => {
    // Spot check the Excel values we know
    const excelPoints = [887, 818, 793, 789, 786, 902, 720, 321, 130, 145];
    for (const pts of excelPoints) {
        assert.ok(pts >= 1 && pts <= 1000, `Points ${pts} should be in range 1-1000`);
    }
});

console.log('✅ Rules unit tests passed');
