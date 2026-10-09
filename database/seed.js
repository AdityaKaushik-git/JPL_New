/**
 * Demo data for local testing and rehearsals.
 *
 *   npm run seed        (runs migrate.js first, then this file)
 *
 * Safe to run more than once: existing franchises / players are skipped.
 * Franchises are created through the same service the admin uses, so they
 * receive the server-assigned ₹18,00,00,000 purse and 12-player limit.
 */
require('dotenv').config();
const pool = require('../server/config/db');
const { createFranchise } = require('../server/services/franchises');
const { recalculateRankings } = require('../server/services/ranking');

const FRANCHISES = [
    { team_name: 'JCC Titans', short_name: 'TIT', owner_name: 'Arjun Mehra', login_id: 'titans@jpl.com', color: '#C8102E' },
    { team_name: 'Bahadurgarh Warriors', short_name: 'WAR', owner_name: 'Neha Sangwan', login_id: 'warriors@jpl.com', color: '#1F6FEB' },
    { team_name: 'Campus Royals', short_name: 'ROY', owner_name: 'Vikram Dahiya', login_id: 'royals@jpl.com', color: '#8B5CF6' },
    { team_name: 'Highway Strikers', short_name: 'STR', owner_name: 'Simran Kaur', login_id: 'strikers@jpl.com', color: '#2FA36B' },
];
const DEMO_PASSWORD = 'Owner@123';

const P = (name, role, bat, bowl, base, s) => ({ name, playing_role: role, batting_style: bat, bowling_style: bowl, base_price: base, country: 'India', is_uncapped: 0, ...s });
const PLAYERS = [
    P('Rahul Sharma', 'Batsman', 'Right-hand bat', null, 1000000, { matches: 12, innings: 12, not_outs: 2, runs: 486, balls_faced: 341, highest_score: '92*', fifties: 4, hundreds: 0, form_points: 82, catches: 5, player_of_match: 3 }),
    P('Karan Malik', 'Batsman', 'Left-hand bat', 'Right-arm off-break', 800000, { country: 'Australia', matches: 11, innings: 11, not_outs: 1, runs: 402, balls_faced: 302, highest_score: '104', fifties: 2, hundreds: 1, form_points: 74, catches: 4, player_of_match: 2 }),
    P('Aman Rathi', 'Batsman', 'Right-hand bat', null, 600000, { is_uncapped: 1, matches: 10, innings: 10, not_outs: 0, runs: 311, balls_faced: 250, highest_score: '67', fifties: 2, form_points: 61, catches: 3 }),
    P('Devansh Gupta', 'Batsman', 'Right-hand bat', null, 500000, { is_uncapped: 1, matches: 9, innings: 9, not_outs: 1, runs: 244, balls_faced: 190, highest_score: '58', fifties: 1, form_points: 55, catches: 2 }),
    P('Ishaan Verma', 'Batsman', 'Left-hand bat', null, 500000, { country: 'England', matches: 8, innings: 8, not_outs: 2, runs: 198, balls_faced: 131, highest_score: '49*', form_points: 70, catches: 4, player_of_match: 1 }),
    P('Rohan Chhikara', 'Batsman', 'Right-hand bat', null, 300000, { is_uncapped: 1, matches: 5, innings: 5, not_outs: 0, runs: 96, balls_faced: 88, highest_score: '31', form_points: 40, catches: 1 }),

    P('Harsh Yadav', 'Bowler', 'Right-hand bat', 'Right-arm fast', 1000000, { matches: 12, innings: 5, not_outs: 2, runs: 38, balls_faced: 40, balls_bowled: 264, runs_conceded: 298, wickets: 24, best_bowling: '5/18', three_wkt_hauls: 3, four_wkt_hauls: 1, five_wkt_hauls: 1, form_points: 88, catches: 3, player_of_match: 3 }),
    P('Sahil Dalal', 'Bowler', 'Right-hand bat', 'Left-arm orthodox', 700000, { country: 'South Africa', matches: 11, innings: 4, not_outs: 1, runs: 22, balls_faced: 30, balls_bowled: 246, runs_conceded: 262, wickets: 17, best_bowling: '4/21', three_wkt_hauls: 2, four_wkt_hauls: 1, form_points: 71, catches: 2, player_of_match: 1 }),
    P('Mohit Kadian', 'Bowler', 'Right-hand bat', 'Right-arm medium', 500000, { is_uncapped: 1, matches: 10, innings: 3, not_outs: 1, runs: 15, balls_faced: 20, balls_bowled: 210, runs_conceded: 266, wickets: 13, best_bowling: '3/24', three_wkt_hauls: 1, form_points: 58, catches: 1 }),
    P('Tushar Nain', 'Bowler', 'Left-hand bat', 'Leg-break', 600000, { is_uncapped: 1, matches: 9, innings: 3, not_outs: 0, runs: 12, balls_faced: 15, balls_bowled: 192, runs_conceded: 214, wickets: 15, best_bowling: '4/30', three_wkt_hauls: 1, four_wkt_hauls: 1, form_points: 77, catches: 2, player_of_match: 1 }),
    P('Yash Sehrawat', 'Bowler', 'Right-hand bat', 'Right-arm fast-medium', 400000, { matches: 7, innings: 2, not_outs: 1, runs: 6, balls_faced: 9, balls_bowled: 138, runs_conceded: 190, wickets: 8, best_bowling: '3/27', three_wkt_hauls: 1, form_points: 49 }),
    P('Nikhil Phogat', 'Bowler', 'Right-hand bat', 'Right-arm off-break', 300000, { is_uncapped: 1, matches: 4, innings: 1, not_outs: 0, runs: 4, balls_faced: 6, balls_bowled: 84, runs_conceded: 101, wickets: 5, best_bowling: '2/14', form_points: 45 }),

    P('Aarav Singh', 'All-Rounder', 'Right-hand bat', 'Right-arm medium', 1200000, { matches: 12, innings: 11, not_outs: 2, runs: 352, balls_faced: 248, highest_score: '77', fifties: 3, balls_bowled: 198, runs_conceded: 231, wickets: 14, best_bowling: '3/19', three_wkt_hauls: 2, form_points: 84, catches: 6, player_of_match: 3 }),
    P('Varun Hooda', 'All-Rounder', 'Left-hand bat', 'Left-arm orthodox', 900000, { country: 'West Indies', matches: 11, innings: 10, not_outs: 1, runs: 276, balls_faced: 214, highest_score: '63', fifties: 2, balls_bowled: 174, runs_conceded: 205, wickets: 11, best_bowling: '3/22', three_wkt_hauls: 1, form_points: 69, catches: 4, player_of_match: 1 }),
    P('Pranav Jakhar', 'All-Rounder', 'Right-hand bat', 'Right-arm fast-medium', 700000, { is_uncapped: 1, matches: 10, innings: 9, not_outs: 2, runs: 201, balls_faced: 160, highest_score: '44', balls_bowled: 150, runs_conceded: 196, wickets: 9, best_bowling: '2/15', form_points: 60, catches: 3 }),
    P('Kunal Ahlawat', 'All-Rounder', 'Right-hand bat', 'Leg-break', 500000, { matches: 8, innings: 7, not_outs: 1, runs: 158, balls_faced: 139, highest_score: '41', balls_bowled: 120, runs_conceded: 150, wickets: 7, best_bowling: '3/33', three_wkt_hauls: 1, form_points: 52, catches: 2 }),
    P('Gaurav Rana', 'All-Rounder', 'Left-hand bat', 'Left-arm medium', 400000, { is_uncapped: 1, matches: 6, innings: 5, not_outs: 0, runs: 97, balls_faced: 90, highest_score: '35', balls_bowled: 90, runs_conceded: 118, wickets: 5, best_bowling: '2/20', form_points: 47, catches: 1 }),
    P('Sumit Deswal', 'All-Rounder', 'Right-hand bat', 'Right-arm off-break', 300000, { is_uncapped: 1, matches: 3, innings: 3, not_outs: 1, runs: 41, balls_faced: 39, highest_score: '22*', balls_bowled: 42, runs_conceded: 55, wickets: 2, best_bowling: '1/12', form_points: 38 }),

    P('Manav Lohan', 'Wicket Keeper', 'Right-hand bat', null, 900000, { matches: 12, innings: 12, not_outs: 3, runs: 331, balls_faced: 240, highest_score: '71*', fifties: 2, catches: 14, stumpings: 6, form_points: 79, player_of_match: 2 }),
    P('Rishi Tanwar', 'Wicket Keeper', 'Left-hand bat', null, 600000, { is_uncapped: 1, matches: 10, innings: 9, not_outs: 1, runs: 214, balls_faced: 180, highest_score: '52', fifties: 1, catches: 9, stumpings: 3, form_points: 63 }),
    P('Akash Balyan', 'Wicket Keeper', 'Right-hand bat', null, 400000, { is_uncapped: 1, matches: 7, innings: 6, not_outs: 1, runs: 121, balls_faced: 118, highest_score: '38', catches: 6, stumpings: 2, form_points: 50 }),
    P('Dhruv Sangwan', 'Wicket Keeper', 'Right-hand bat', null, 300000, { is_uncapped: 1, matches: 3, innings: 3, not_outs: 0, runs: 48, balls_faced: 51, highest_score: '26', catches: 2, stumpings: 1, form_points: 36 }),
    P('Parth Malik', 'Batsman', 'Right-hand bat', null, 200000, { is_uncapped: 1, form_points: 0 }),
    P('Lakshya Dahiya', 'Bowler', 'Right-hand bat', 'Right-arm fast', 200000, { is_uncapped: 1, form_points: 0 }),
];

async function main() {
    console.log('→ seeding franchises');
    for (const f of FRANCHISES) {
        const [exists] = await pool.query('SELECT id FROM users WHERE enrollment_number = ?', [f.login_id]);
        if (exists.length) { console.log(`  = ${f.team_name}`); continue; }
        await createFranchise(pool, { ...f, password: DEMO_PASSWORD });
        console.log(`  + ${f.team_name} (${f.login_id} / ${DEMO_PASSWORD})`);
    }

    console.log('→ seeding players');
    let order = 1;
    for (const p of PLAYERS) {
        const code = `SEED${String(order).padStart(3, '0')}`;
        const [exists] = await pool.query('SELECT id FROM players WHERE enrollment_number = ?', [code]);
        if (!exists.length) {
            const row = {
                course: 'N/A', year: 'N/A', enrollment_number: code, auction_order: order,
                matches: 0, innings: 0, not_outs: 0, runs: 0, balls_faced: 0, fifties: 0, hundreds: 0,
                balls_bowled: 0, runs_conceded: 0, wickets: 0, three_wkt_hauls: 0, four_wkt_hauls: 0, five_wkt_hauls: 0,
                catches: 0, stumpings: 0, run_outs: 0, player_of_match: 0, form_points: 0,
                ...p,
            };
            const cols = Object.keys(row);
            const [r] = await pool.query(
                `INSERT INTO players (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
                cols.map(c => row[c])
            );
            await pool.query("UPDATE players SET player_code = CONCAT('JPL', LPAD(id, 3, '0')) WHERE id = ?", [r.insertId]);
            console.log(`  + ${p.name}`);
        }
        order++;
    }

    const result = await recalculateRankings(pool);
    console.log(`→ rankings: ${result.ranked}/${result.players} ranked`);
    console.log('✅ seed complete');
    await pool.end();
}

main().catch(async err => {
    console.error('❌ seed failed:', err.message);
    try { await pool.end(); } catch (e) { /* ignore */ }
    process.exit(1);
});
