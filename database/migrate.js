/**
 * JPL database migrator — safe to run on every deploy.
 *
 *   node database/migrate.js
 *
 * - Fresh database: creates every table from schema.sql and a bootstrap admin.
 * - Existing database (old schema): adds new columns/tables, widens money
 *   columns to DECIMAL(15,2), drops the unused player photo column, removes
 *   franchise owners that the old registration flow inserted as "players",
 *   and moves franchises to the ₹50 Cr / 14-player rules.
 * - Always: recomputes squad_count / total_spent / role_counts from the teams
 *   table and recalculates JPL rankings.
 *
 * One-time data changes are recorded in `schema_migrations` so they never run twice.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { STARTING_PURSE, MAX_SQUAD_SIZE } = require('../server/config/auction');
const { recalculateRankings } = require('../server/services/ranking');

const DB_NAME = process.env.DB_NAME || 'jpl_auction';

function baseConfig() {
    const cfg = {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        multipleStatements: true,
    };
    const wantsSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true'
        || (process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com'));
    if (wantsSsl) cfg.ssl = { rejectUnauthorized: false };
    return cfg;
}

async function tableExists(db, table) {
    const [rows] = await db.query(
        'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [DB_NAME, table]
    );
    return rows.length > 0;
}

async function columnInfo(db, table, column) {
    const [rows] = await db.query(
        `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [DB_NAME, table, column]
    );
    return rows[0] || null;
}

async function addColumn(db, table, column, definition) {
    if (await columnInfo(db, table, column)) return false;
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`  + ${table}.${column}`);
    return true;
}

async function modifyColumn(db, table, column, definition, needsChange) {
    const info = await columnInfo(db, table, column);
    if (!info || !needsChange(info)) return;
    await db.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${definition}`);
    console.log(`  ~ ${table}.${column} → ${definition}`);
}

async function dropColumn(db, table, column) {
    if (!(await columnInfo(db, table, column))) return;
    await db.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
    console.log(`  - ${table}.${column}`);
}

async function indexExists(db, table, index) {
    const [rows] = await db.query(
        'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?',
        [DB_NAME, table, index]
    );
    return rows.length > 0;
}

async function addIndex(db, table, index, ddl) {
    if (await indexExists(db, table, index)) return;
    await db.query(`ALTER TABLE \`${table}\` ADD ${ddl}`);
    console.log(`  + index ${table}.${index}`);
}

async function addCheck(db, table, name, expr) {
    try {
        const [rows] = await db.query(
            `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`, [DB_NAME, table, name]
        );
        if (rows.length) return;
        await db.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` CHECK (${expr})`);
        console.log(`  + check ${name}`);
    } catch (err) {
        console.warn(`  ! could not add check ${name}: ${err.message} (server-side validation still applies)`);
    }
}

async function once(db, name, fn) {
    const [rows] = await db.query('SELECT 1 FROM schema_migrations WHERE name = ?', [name]);
    if (rows.length) return;
    console.log(`→ data migration: ${name}`);
    await fn();
    await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
}

const isNarrowMoney = (info) => !/decimal\(15,2\)/i.test(info.COLUMN_TYPE);

async function upgradeExisting(db) {
    console.log('→ upgrading existing schema');

    // users (franchises)
    await modifyColumn(db, 'users', 'email', 'VARCHAR(100) NULL', i => i.IS_NULLABLE === 'NO');
    await modifyColumn(db, 'users', 'mobile', 'VARCHAR(20) NULL', i => i.IS_NULLABLE === 'NO');
    await modifyColumn(db, 'users', 'purse', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00', i => isNarrowMoney(i) || i.IS_NULLABLE === 'YES');
    await addColumn(db, 'users', 'team_name', 'VARCHAR(100) NULL');
    await addColumn(db, 'users', 'team_short_name', 'VARCHAR(6) NULL AFTER team_name');
    await addColumn(db, 'users', 'team_color', 'CHAR(7) NULL AFTER team_short_name');
    await addColumn(db, 'users', 'logo', 'MEDIUMTEXT NULL AFTER team_color');
    await addColumn(db, 'users', 'starting_purse', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER logo');
    await addColumn(db, 'users', 'total_spent', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER purse');
    await addColumn(db, 'users', 'squad_count', 'INT NOT NULL DEFAULT 0 AFTER total_spent');
    await addColumn(db, 'users', 'max_squad_size', `INT NOT NULL DEFAULT ${MAX_SQUAD_SIZE} AFTER squad_count`);
    await addColumn(db, 'users', 'status', "ENUM('active','disabled') NOT NULL DEFAULT 'active' AFTER max_squad_size");
    await addColumn(db, 'users', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    // Role slot columns
    await addColumn(db, 'users', 'batsmen_count',     'INT NOT NULL DEFAULT 0');
    await addColumn(db, 'users', 'bowlers_count',     'INT NOT NULL DEFAULT 0');
    await addColumn(db, 'users', 'allrounders_count', 'INT NOT NULL DEFAULT 0');
    await addColumn(db, 'users', 'keepers_count',     'INT NOT NULL DEFAULT 0');
    // The purse default must never be a hard-coded business number; the server assigns it.
    await db.query('ALTER TABLE users ALTER COLUMN purse SET DEFAULT 0.00');

    // players — new fields
    await dropColumn(db, 'players', 'photo_url');
    await modifyColumn(db, 'players', 'base_price', 'DECIMAL(15,2) NOT NULL', isNarrowMoney);
    const lacksDefault = (i) => !String(i.COLUMN_DEFAULT || '').includes('N/A');
    await modifyColumn(db, 'players', 'course', "VARCHAR(50) NOT NULL DEFAULT 'N/A'", lacksDefault);
    await modifyColumn(db, 'players', 'year', "VARCHAR(20) NOT NULL DEFAULT 'N/A'", lacksDefault);
    await addColumn(db, 'players', 'player_code', 'VARCHAR(20) NULL AFTER id');
    await addColumn(db, 'players', 'auction_order', 'INT NULL AFTER player_code');
    await addColumn(db, 'players', 'batting_style', 'VARCHAR(40) NULL AFTER playing_role');
    await addColumn(db, 'players', 'bowling_style', 'VARCHAR(60) NULL AFTER batting_style');
    // Country & image (new fields — added safely)
    await addColumn(db, 'players', 'country',       'VARCHAR(60) NULL AFTER bowling_style');
    await addColumn(db, 'players', 'country_code',  'VARCHAR(4)  NULL AFTER country');
    await addColumn(db, 'players', 'image_url',     'TEXT NULL');
    await addColumn(db, 'players', 'image_source',  'VARCHAR(255) NULL');
    await addColumn(db, 'players', 'base_price_auto', 'TINYINT(1) NOT NULL DEFAULT 1');
    const intCols = ['matches', 'innings', 'not_outs', 'runs', 'balls_faced', 'fifties', 'hundreds',
        'balls_bowled', 'runs_conceded', 'wickets', 'three_wkt_hauls', 'four_wkt_hauls', 'five_wkt_hauls',
        'catches', 'stumpings', 'run_outs', 'player_of_match', 'form_points',
        'ranking_points', 'previous_ranking_points'];
    for (const c of intCols) await addColumn(db, 'players', c, 'INT NOT NULL DEFAULT 0');
    await addColumn(db, 'players', 'highest_score', 'VARCHAR(10) NULL');
    await addColumn(db, 'players', 'best_bowling', 'VARCHAR(10) NULL');
    await addColumn(db, 'players', 'batting_average', 'DECIMAL(7,2) NOT NULL DEFAULT 0.00');
    await addColumn(db, 'players', 'strike_rate', 'DECIMAL(7,2) NOT NULL DEFAULT 0.00');
    await addColumn(db, 'players', 'bowling_average', 'DECIMAL(7,2) NOT NULL DEFAULT 0.00');
    await addColumn(db, 'players', 'economy', 'DECIMAL(6,2) NOT NULL DEFAULT 0.00');
    await addColumn(db, 'players', 'bowling_strike_rate', 'DECIMAL(7,2) NOT NULL DEFAULT 0.00');
    for (const c of ['current_rank', 'previous_rank', 'category_rank', 'previous_category_rank']) {
        await addColumn(db, 'players', c, 'INT NULL');
    }
    await addColumn(db, 'players', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await addIndex(db, 'players', 'player_code', 'UNIQUE INDEX `player_code` (`player_code`)');
    await addIndex(db, 'players', 'idx_players_status', 'INDEX `idx_players_status` (`status`)');
    await addIndex(db, 'players', 'idx_players_rank', 'INDEX `idx_players_rank` (`current_rank`)');
    await addIndex(db, 'players', 'idx_players_order', 'INDEX `idx_players_order` (`auction_order`)');
    await addIndex(db, 'players', 'idx_players_country', 'INDEX `idx_players_country` (`country`)');

    // money columns large enough for a ₹50 Cr purse
    await modifyColumn(db, 'auctions', 'current_bid', 'DECIMAL(15,2) DEFAULT 0.00', isNarrowMoney);
    await modifyColumn(db, 'bids', 'bid_amount', 'DECIMAL(15,2) NOT NULL', isNarrowMoney);
    await modifyColumn(db, 'teams', 'purchase_price', 'DECIMAL(15,2) NOT NULL', isNarrowMoney);
    await modifyColumn(db, 'auction_results', 'winning_bid', 'DECIMAL(15,2) DEFAULT NULL', isNarrowMoney);

    // new tables (CREATE TABLE IF NOT EXISTS from schema.sql is safe to re-run)
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const newTables = schema.split(/;\s*\n/).filter(s => /CREATE TABLE IF NOT EXISTS (ranking_history|player_matches)/.test(s));
    for (const stmt of newTables) await db.query(stmt);
}

async function dataMigrations(db) {
    await once(db, '001_remove_owner_player_rows', async () => {
        // The old public registration inserted every franchise owner into `players`
        // and into their own `teams` roster at ₹0. Owners are not players.
        const [rows] = await db.query(`
            SELECT p.id AS player_id FROM players p
            JOIN users u ON u.enrollment_number = p.enrollment_number AND u.role = 'user'
            JOIN teams t ON t.player_id = p.id AND t.user_id = u.id AND t.purchase_price = 0
            WHERE NOT EXISTS (SELECT 1 FROM auctions a WHERE a.player_id = p.id)`);
        const ids = rows.map(r => r.player_id);
        if (ids.length) {
            await db.query('DELETE FROM teams WHERE player_id IN (?)', [ids]);
            await db.query('DELETE FROM players WHERE id IN (?)', [ids]);
        }
        console.log(`  removed ${ids.length} owner-as-player row(s)`);
    });

    await once(db, '002_franchise_18cr_12_players', async () => {
        await db.query(`UPDATE users SET starting_purse = ?, max_squad_size = ?, team_name = COALESCE(team_name, full_name)
                        WHERE role = 'user'`, [STARTING_PURSE, MAX_SQUAD_SIZE]);
        await db.query(`UPDATE users u SET purse = ? - COALESCE((SELECT SUM(t.purchase_price) FROM teams t WHERE t.user_id = u.id), 0)
                        WHERE u.role = 'user'`, [STARTING_PURSE]);
        await db.query(`UPDATE users SET purse = 0, starting_purse = 0 WHERE role <> 'user'`);
    });

    await once(db, '003_player_codes_and_order', async () => {
        await db.query("UPDATE players SET player_code = CONCAT('JPL', LPAD(id, 3, '0')) WHERE player_code IS NULL");
        await db.query('UPDATE players SET auction_order = id WHERE auction_order IS NULL');
    });

    // Migrate purse to ₹50 Cr and squad to 14 (new rules)
    await once(db, '004_purse_50cr_squad_14', async () => {
        console.log('  upgrading starting_purse → ₹50 Cr, max_squad_size → 14');
        await db.query(`UPDATE users SET starting_purse = ?, max_squad_size = ? WHERE role = 'user'`, [STARTING_PURSE, MAX_SQUAD_SIZE]);
        // Recompute remaining purse: ₹50 Cr minus what has actually been spent
        await db.query(`
            UPDATE users u
            SET purse = ? - COALESCE((SELECT SUM(t.purchase_price) FROM teams t WHERE t.user_id = u.id), 0)
            WHERE u.role = 'user'`, [STARTING_PURSE]);
        // Clamp purse >= 0 (safety)
        await db.query(`UPDATE users SET purse = GREATEST(purse, 0) WHERE role = 'user'`);
    });

    // Reconcile role counts (idempotent one-time migration)
    await once(db, '005_role_counts_reconcile', async () => {
        console.log('  reconciling role counts from teams/players');
        await db.query(`
            UPDATE users u
            SET
              batsmen_count     = COALESCE((SELECT COUNT(*) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = u.id AND p.playing_role = 'Batsman'), 0),
              bowlers_count     = COALESCE((SELECT COUNT(*) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = u.id AND p.playing_role = 'Bowler'), 0),
              allrounders_count = COALESCE((SELECT COUNT(*) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = u.id AND p.playing_role = 'All-Rounder'), 0),
              keepers_count     = COALESCE((SELECT COUNT(*) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = u.id AND p.playing_role = 'Wicket Keeper'), 0)
            WHERE u.role = 'user'
        `);
    });

    // Migrate to JPL 2026 rules: ₹75 Cr purse, 15-player squad, foreign_count, uncapped_count, is_uncapped
    await once(db, '006_jpl2026_rules', async () => {
        console.log('  upgrading to JPL 2026 rules: ₹75 Cr, 15 players, foreign+uncapped tracking');
        await addColumn(db, 'users', 'foreign_count',  'INT NOT NULL DEFAULT 0 AFTER keepers_count');
        await addColumn(db, 'users', 'uncapped_count', 'INT NOT NULL DEFAULT 0 AFTER foreign_count');
        await addColumn(db, 'players', 'is_uncapped', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER country_code');
        await db.query(`UPDATE users SET starting_purse = ?, max_squad_size = ? WHERE role = 'user'`, [STARTING_PURSE, MAX_SQUAD_SIZE]);
        await db.query(
            `UPDATE users u
            SET purse = GREATEST(
                ? - COALESCE((SELECT SUM(t.purchase_price) FROM teams t WHERE t.user_id = u.id), 0),
                0
            ) WHERE u.role = 'user'`, [STARTING_PURSE]);
    });

    // Always keep counters consistent with the teams table (source of truth for rosters).
    await db.query(`UPDATE users u SET
        squad_count = (SELECT COUNT(*) FROM teams t WHERE t.user_id = u.id),
        total_spent = COALESCE((SELECT SUM(t.purchase_price) FROM teams t WHERE t.user_id = u.id), 0)
        WHERE u.role = 'user'`);

    // Always reconcile role counts (catches any manual DB edits or rollbacks)
    await db.query(`
        UPDATE users u
        SET
          batsmen_count     = COALESCE((SELECT COUNT(*) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = u.id AND p.playing_role = 'Batsman'), 0),
          bowlers_count     = COALESCE((SELECT COUNT(*) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = u.id AND p.playing_role = 'Bowler'), 0),
          allrounders_count = COALESCE((SELECT COUNT(*) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = u.id AND p.playing_role = 'All-Rounder'), 0),
          keepers_count     = COALESCE((SELECT COUNT(*) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = u.id AND p.playing_role = 'Wicket Keeper'), 0),
          foreign_count     = COALESCE((SELECT COUNT(*) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = u.id AND p.country IS NOT NULL AND TRIM(LOWER(p.country)) <> 'india' AND TRIM(p.country) <> ''), 0),
          uncapped_count    = COALESCE((SELECT COUNT(*) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = u.id AND p.is_uncapped = 1), 0)
        WHERE u.role = 'user'
    `);

    await db.query("UPDATE players SET player_code = CONCAT('JPL', LPAD(id, 3, '0')) WHERE player_code IS NULL");
    await db.query('UPDATE players SET auction_order = id WHERE auction_order IS NULL');

    const [[over]] = await db.query("SELECT COUNT(*) AS c FROM users WHERE role = 'user' AND squad_count > max_squad_size");
    if (over.c > 0) {
        console.warn(`  ! ${over.c} franchise(s) already exceed the ${MAX_SQUAD_SIZE}-player limit; review them in Admin → Franchises.`);
    } else {
        await addCheck(db, 'users', 'chk_users_squad_range', `squad_count >= 0 AND squad_count <= max_squad_size`);
    }
    await addCheck(db, 'users', 'chk_users_purse_nonneg', 'purse >= 0');
    await addCheck(db, 'users', 'chk_users_spent_nonneg', 'total_spent >= 0');
}

async function ensureAdmin(db) {
    const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (admins.length) return;
    const loginId = process.env.ADMIN_LOGIN_ID || 'ADMIN001';
    const email = process.env.ADMIN_EMAIL || 'admin@jpl.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    if (!process.env.ADMIN_PASSWORD) {
        console.warn('  ! ADMIN_PASSWORD not set — bootstrap admin uses the default "admin123". Change it immediately.');
    }
    const hash = await bcrypt.hash(password, 10);
    await db.query(
        `INSERT INTO users (full_name, enrollment_number, email, password_hash, role, purse, starting_purse)
         VALUES ('JPL Admin', ?, ?, ?, 'admin', 0, 0)`, [loginId, email, hash]
    );
    console.log(`  + bootstrap admin created (login: ${loginId})`);
}

async function main() {
    const root = await mysql.createConnection(baseConfig());
    await root.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await root.end();

    const db = await mysql.createConnection({ ...baseConfig(), database: DB_NAME });
    try {
        await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            name VARCHAR(100) PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

                const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        // ALWAYS run schema to ensure missing tables are created.
        const queries = schema.split(';').filter(q => q.trim().length > 0);
        for (const q of queries) {
            await db.query(q);
        }

        if (!(await tableExists(db, 'users'))) {
            console.log('  fresh database: creating schema');
        } else {
            await upgradeExisting(db);
        }

        for (const name of ['001_remove_owner_player_rows', '002_franchise_18cr_12_players', '003_player_codes_and_order', '004_purse_50cr_squad_14', '005_role_counts_reconcile', '006_jpl2026_rules']) {
            await db.query('INSERT IGNORE INTO schema_migrations (name) VALUES (?)', [name]);
        }

        await dataMigrations(db);
        await ensureAdmin(db);

        const pool = mysql.createPool({ ...baseConfig(), database: DB_NAME, multipleStatements: false });
        const result = await recalculateRankings(pool);
        await pool.end();
        console.log(`→ rankings recalculated (${result.ranked}/${result.players} ranked)`);
        console.log('✅ migration complete');
    } finally {
        await db.end();
    }
}

main().catch(err => {
    console.error('❌ migration failed:', err.message);
    process.exit(1);
});
