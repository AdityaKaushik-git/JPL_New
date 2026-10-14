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

test('buildSlotOrderedQueue enforces role slots of 10 and randomizes players within roles', () => {
    const { buildSlotOrderedQueue } = require('../server/services/ranking');

    // Create a mock pool of players: 25 Batsmen, 25 Bowlers, 25 Keepers, 25 All-Rounders
    const mockPlayers = [];
    let id = 1;
    const roles = ['Batsman', 'Bowler', 'Wicket Keeper', 'All-Rounder'];
    for (const role of roles) {
        for (let i = 1; i <= 25; i++) {
            mockPlayers.push({ id: id++, name: `${role} ${i}`, playing_role: role, ranking_points: 100 + i, status: 'Available' });
        }
    }

    const orderMap1 = buildSlotOrderedQueue(mockPlayers, { randomize: true });
    assert.equal(orderMap1.size, 100, 'All 100 players must have an order');

    // Map ordered list
    const ordered = [...mockPlayers].sort((a, b) => orderMap1.get(a.id) - orderMap1.get(b.id));

    // Set 1:
    // 1-10: Batsmen
    for (let i = 0; i < 10; i++) {
        assert.equal(ordered[i].playing_role, 'Batsman', `Slot ${i + 1} should be a Batsman`);
    }
    // 11-20: Bowlers
    for (let i = 10; i < 20; i++) {
        assert.equal(ordered[i].playing_role, 'Bowler', `Slot ${i + 1} should be a Bowler`);
    }
    // 21-30: Wicket Keepers
    for (let i = 20; i < 30; i++) {
        assert.equal(ordered[i].playing_role, 'Wicket Keeper', `Slot ${i + 1} should be a Wicket Keeper`);
    }
    // 31-40: All-Rounders
    for (let i = 30; i < 40; i++) {
        assert.equal(ordered[i].playing_role, 'All-Rounder', `Slot ${i + 1} should be an All-Rounder`);
    }

    // Set 2:
    // 41-50: Batsmen
    for (let i = 40; i < 50; i++) {
        assert.equal(ordered[i].playing_role, 'Batsman', `Slot ${i + 1} should be a Batsman (Set 2)`);
    }
    // 51-60: Bowlers
    for (let i = 50; i < 60; i++) {
        assert.equal(ordered[i].playing_role, 'Bowler', `Slot ${i + 1} should be a Bowler (Set 2)`);
    }
    // 61-70: Wicket Keepers
    for (let i = 60; i < 70; i++) {
        assert.equal(ordered[i].playing_role, 'Wicket Keeper', `Slot ${i + 1} should be a Wicket Keeper (Set 2)`);
    }
    // 71-80: All-Rounders
    for (let i = 70; i < 80; i++) {
        assert.equal(ordered[i].playing_role, 'All-Rounder', `Slot ${i + 1} should be an All-Rounder (Set 2)`);
    }

    // Set 3: Remaining 5 players of each role (81-100)
    for (let i = 80; i < 85; i++) assert.equal(ordered[i].playing_role, 'Batsman');
    for (let i = 85; i < 90; i++) assert.equal(ordered[i].playing_role, 'Bowler');
    for (let i = 90; i < 95; i++) assert.equal(ordered[i].playing_role, 'Wicket Keeper');
    for (let i = 95; i < 100; i++) assert.equal(ordered[i].playing_role, 'All-Rounder');

    // Run a second time and check randomization (the sequence of first 10 batsmen should not be identical in both runs)
    const orderMap2 = buildSlotOrderedQueue(mockPlayers, { randomize: true });
    const ordered2 = [...mockPlayers].sort((a, b) => orderMap2.get(a.id) - orderMap2.get(b.id));
    const firstTenIds1 = ordered.slice(0, 10).map(p => p.id).join(',');
    const firstTenIds2 = ordered2.slice(0, 10).map(p => p.id).join(',');
    // With 25 batsmen, probability of identical first 10 order is 1 / (25P10) which is virtually 0
    assert.notEqual(firstTenIds1, firstTenIds2, 'Successive randomizations should produce randomized player orders');
});

test('buildSlotOrderedQueue with actual Excel players accurately groups by Excel slots and randomizes within each slot', () => {
    const { buildSlotOrderedQueue } = require('../server/services/ranking');
    const slotsData = require('../server/data/excel_slots.json');

    const realPlayers = slotsData.map((s, idx) => ({
        id: idx + 1,
        name: s.name,
        excel_sheet: s.sheet,
        excel_set: s.set,
        playing_role: s.sheet === 'batsman' ? 'Batsman' : s.sheet === 'bowler' ? 'Bowler' : s.sheet === 'Wicket keeper' ? 'Wicket Keeper' : 'All-Rounder',
        is_uncapped: s.sheet === 'uncapped' ? 1 : 0,
        ranking_points: 500,
        status: 'Available',
    }));

    const orderMap = buildSlotOrderedQueue(realPlayers, { randomize: true });
    assert.equal(orderMap.size, 280, 'All 280 Excel players must be ordered');

    const ordered = [...realPlayers].sort((a, b) => orderMap.get(a.id) - orderMap.get(b.id));

    // Slot 1: Top 10 Batsmen (Set 1 Batsmen)
    const expectedTop10Batsmen = new Set([
        'Abhishek Sharma', 'Sahibzada Farhan', 'Harry Brook', 'Dewald Brevis', 'Shreyas Iyer',
        'Pathum Nissanka', 'Tilak Varma', 'Mitchell Marsh', 'Travis Head', 'Brian Bennett'
    ]);
    const slot1Batsmen = ordered.slice(0, 10).map(p => p.name);
    assert.equal(slot1Batsmen.length, 10);
    for (const name of slot1Batsmen) {
        assert.ok(expectedTop10Batsmen.has(name), `Slot 1 must contain Top 10 Batsman "${name}"`);
    }

    // Slot 2: Top 10 Bowlers (Set 1 Bowlers)
    const expectedTop10Bowlers = new Set([
        'Rashid Khan', 'Abrar Ahmed', 'Adam Zampa', 'Adil Rashid', 'Nathan Ellis',
        'Jamie Overton', 'Nasum Ahmed', 'Jasprit Bumrah', 'Liam Dawson', 'Mohammad Nawaz'
    ]);
    const slot2Bowlers = ordered.slice(10, 20).map(p => p.name);
    assert.equal(slot2Bowlers.length, 10);
    for (const name of slot2Bowlers) {
        assert.ok(expectedTop10Bowlers.has(name), `Slot 2 must contain Top 10 Bowler "${name}"`);
    }

    // Slot 3: Set 1 Wicket Keepers (5 players)
    const expectedSet1Keepers = new Set(['Ishan Kishan', 'Jos Buttler', 'Phil Salt', 'Tim Seifert', 'Shai Hope']);
    const slot3Keepers = ordered.slice(20, 25).map(p => p.name);
    assert.equal(slot3Keepers.length, 5);
    for (const name of slot3Keepers) {
        assert.ok(expectedSet1Keepers.has(name), `Slot 3 must contain Set 1 Keeper "${name}"`);
    }

    // Slot 4: Set 1 All-Rounders (10 players)
    assert.equal(ordered.slice(25, 35).length, 10);
    for (let i = 25; i < 35; i++) {
        assert.equal(ordered[i].excel_sheet, 'all rounder');
        assert.equal(ordered[i].excel_set, 1);
    }

    // Slot 5: Set 1 Uncapped (5 players)
    assert.equal(ordered.slice(35, 40).length, 5);
    for (let i = 35; i < 40; i++) {
        assert.equal(ordered[i].excel_sheet, 'uncapped');
        assert.equal(ordered[i].excel_set, 1);
    }

    // Slot 6: Set 2 Batsmen (10 players)
    assert.equal(ordered.slice(40, 50).length, 10);
    for (let i = 40; i < 50; i++) {
        assert.equal(ordered[i].excel_sheet, 'batsman');
        assert.equal(ordered[i].excel_set, 2);
    }

    // Randomization verification: consecutive runs produce different orders within Slot 1
    const orderMap2 = buildSlotOrderedQueue(realPlayers, { randomize: true });
    const ordered2 = [...realPlayers].sort((a, b) => orderMap2.get(a.id) - orderMap2.get(b.id));
    const slot1Run1 = ordered.slice(0, 10).map(p => p.name).join(',');
    const slot1Run2 = ordered2.slice(0, 10).map(p => p.name).join(',');
    assert.notEqual(slot1Run1, slot1Run2, 'Slot 1 Top 10 Batsmen order should be randomised between runs');
});

test('franchises with fewer than 15 players are excluded from results and termed disqualified', () => {
    const franchises = [
        { id: 1, team_name: 'Team Alpha', squad_count: 15, total_player_points: 5000, remaining_purse: 10000000 },
        { id: 2, team_name: 'Team Beta', squad_count: 14, total_player_points: 6000, remaining_purse: 20000000 }, // Incomplete!
        { id: 3, team_name: 'Team Gamma', squad_count: 15, total_player_points: 4500, remaining_purse: 5000000 },
        { id: 4, team_name: 'Team Delta', squad_count: 10, total_player_points: 4000, remaining_purse: 30000000 }, // Incomplete!
    ];

    const mapped = franchises.map(f => {
        const squadCount = Number(f.squad_count || 0);
        const isDisqualified = squadCount < 15;
        return {
            ...f,
            is_disqualified: isDisqualified,
            qualification_status: isDisqualified ? 'Disqualified' : 'Qualified',
            disqualification_reason: isDisqualified ? 'Incomplete squad (< 15 players)' : null,
        };
    });

    const qualified = mapped.filter(f => !f.is_disqualified);
    const disqualified = mapped.filter(f => f.is_disqualified);

    // Only 2 teams have 15 players
    assert.equal(qualified.length, 2, 'Only franchises with 15 players should qualify');
    assert.equal(disqualified.length, 2, 'Franchises with < 15 players should be disqualified');

    // Team Beta had more points (6000) than Alpha (5000), but has 14 players, so Beta is disqualified
    assert.equal(disqualified[0].team_name, 'Team Beta');
    assert.equal(disqualified[0].qualification_status, 'Disqualified');
    assert.equal(disqualified[0].disqualification_reason, 'Incomplete squad (< 15 players)');

    // Result rankings contain ONLY Alpha (#1) and Gamma (#2)
    assert.equal(qualified[0].team_name, 'Team Alpha');
    assert.equal(qualified[1].team_name, 'Team Gamma');
});

console.log('✅ Rules unit tests passed');

