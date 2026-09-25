-- ============================================================================
--  001_premium_auction.sql
--  One-time upgrade from the ORIGINAL JPL schema to the premium auction schema.
--  Run once, on a backup first:  mysql -u USER -p jpl_auction < 001_premium_auction.sql
--
--  You do NOT need this if you use `npm start` / `npm run migrate` —
--  database/migrate.js performs the same steps idempotently (safe to re-run).
--  Requires MySQL 8.0.16+ (CHECK constraints) or MariaDB 10.4+.
-- ============================================================================

START TRANSACTION;

-- ---- users → franchise fields -------------------------------------------------
ALTER TABLE users
    MODIFY COLUMN email VARCHAR(100) NULL,
    MODIFY COLUMN mobile VARCHAR(20) NULL,
    MODIFY COLUMN purse DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN team_short_name VARCHAR(6) NULL AFTER team_name,
    ADD COLUMN team_color CHAR(7) NULL AFTER team_short_name,
    ADD COLUMN logo MEDIUMTEXT NULL AFTER team_color,
    ADD COLUMN starting_purse DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER logo,
    ADD COLUMN total_spent DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER purse,
    ADD COLUMN squad_count INT NOT NULL DEFAULT 0 AFTER total_spent,
    ADD COLUMN max_squad_size INT NOT NULL DEFAULT 12 AFTER squad_count,
    ADD COLUMN status ENUM('active','disabled') NOT NULL DEFAULT 'active' AFTER max_squad_size,
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- ---- players: remove photo, add stats + ranking ---------------------------------
ALTER TABLE players
    DROP COLUMN photo_url,
    MODIFY COLUMN base_price DECIMAL(15,2) NOT NULL,
    MODIFY COLUMN course VARCHAR(50) NOT NULL DEFAULT 'N/A',
    MODIFY COLUMN year VARCHAR(20) NOT NULL DEFAULT 'N/A',
    ADD COLUMN player_code VARCHAR(20) NULL AFTER id,
    ADD COLUMN auction_order INT NULL AFTER player_code,
    ADD COLUMN batting_style VARCHAR(40) NULL AFTER playing_role,
    ADD COLUMN bowling_style VARCHAR(60) NULL AFTER batting_style,
    ADD COLUMN matches INT NOT NULL DEFAULT 0,
    ADD COLUMN innings INT NOT NULL DEFAULT 0,
    ADD COLUMN not_outs INT NOT NULL DEFAULT 0,
    ADD COLUMN runs INT NOT NULL DEFAULT 0,
    ADD COLUMN balls_faced INT NOT NULL DEFAULT 0,
    ADD COLUMN highest_score VARCHAR(10) NULL,
    ADD COLUMN fifties INT NOT NULL DEFAULT 0,
    ADD COLUMN hundreds INT NOT NULL DEFAULT 0,
    ADD COLUMN balls_bowled INT NOT NULL DEFAULT 0,
    ADD COLUMN runs_conceded INT NOT NULL DEFAULT 0,
    ADD COLUMN wickets INT NOT NULL DEFAULT 0,
    ADD COLUMN best_bowling VARCHAR(10) NULL,
    ADD COLUMN three_wkt_hauls INT NOT NULL DEFAULT 0,
    ADD COLUMN four_wkt_hauls INT NOT NULL DEFAULT 0,
    ADD COLUMN five_wkt_hauls INT NOT NULL DEFAULT 0,
    ADD COLUMN catches INT NOT NULL DEFAULT 0,
    ADD COLUMN stumpings INT NOT NULL DEFAULT 0,
    ADD COLUMN run_outs INT NOT NULL DEFAULT 0,
    ADD COLUMN player_of_match INT NOT NULL DEFAULT 0,
    ADD COLUMN form_points INT NOT NULL DEFAULT 0,
    ADD COLUMN batting_average DECIMAL(7,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN strike_rate DECIMAL(7,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN bowling_average DECIMAL(7,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN economy DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN bowling_strike_rate DECIMAL(7,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN ranking_points INT NOT NULL DEFAULT 0,
    ADD COLUMN previous_ranking_points INT NOT NULL DEFAULT 0,
    ADD COLUMN current_rank INT NULL,
    ADD COLUMN previous_rank INT NULL,
    ADD COLUMN category_rank INT NULL,
    ADD COLUMN previous_category_rank INT NULL,
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD UNIQUE INDEX player_code (player_code),
    ADD INDEX idx_players_status (status),
    ADD INDEX idx_players_rank (current_rank),
    ADD INDEX idx_players_order (auction_order);

-- ---- money columns wide enough for an ₹18 Cr purse --------------------------------
ALTER TABLE auctions MODIFY COLUMN current_bid DECIMAL(15,2) DEFAULT 0.00;
ALTER TABLE bids MODIFY COLUMN bid_amount DECIMAL(15,2) NOT NULL;
ALTER TABLE teams MODIFY COLUMN purchase_price DECIMAL(15,2) NOT NULL;
ALTER TABLE auction_results MODIFY COLUMN winning_bid DECIMAL(15,2) DEFAULT NULL;

-- ---- new tables ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ranking_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    ranking_points INT NOT NULL,
    overall_rank INT NULL,
    category_rank INT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rh_player (player_id, recorded_at),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    match_label VARCHAR(100) NOT NULL,
    match_date DATE NULL,
    runs INT NOT NULL DEFAULT 0,
    balls_faced INT NOT NULL DEFAULT 0,
    wickets INT NOT NULL DEFAULT 0,
    balls_bowled INT NOT NULL DEFAULT 0,
    runs_conceded INT NOT NULL DEFAULT 0,
    catches INT NOT NULL DEFAULT 0,
    stumpings INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pm_player (player_id, match_date),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---- data: franchise owners are NOT players ---------------------------------------
-- The old public registration inserted each owner into `players` and into their own
-- roster at ₹0. Remove those rows (only when that player was never auctioned).
CREATE TEMPORARY TABLE owner_player_ids AS
    SELECT p.id FROM players p
    JOIN users u ON u.enrollment_number = p.enrollment_number AND u.role = 'user'
    JOIN teams t ON t.player_id = p.id AND t.user_id = u.id AND t.purchase_price = 0
    WHERE NOT EXISTS (SELECT 1 FROM auctions a WHERE a.player_id = p.id);
DELETE FROM teams WHERE player_id IN (SELECT id FROM owner_player_ids);
DELETE FROM players WHERE id IN (SELECT id FROM owner_player_ids);
DROP TEMPORARY TABLE owner_player_ids;

-- ---- data: ₹18,00,00,000 purse and 12-player squads ----------------------------------
UPDATE users SET team_name = COALESCE(team_name, full_name) WHERE role = 'user';
UPDATE users u SET
    starting_purse = 180000000.00,
    max_squad_size = 12,
    total_spent = COALESCE((SELECT SUM(t.purchase_price) FROM teams t WHERE t.user_id = u.id), 0),
    squad_count = (SELECT COUNT(*) FROM teams t WHERE t.user_id = u.id)
WHERE u.role = 'user';
UPDATE users SET purse = starting_purse - total_spent WHERE role = 'user';
UPDATE users SET purse = 0, starting_purse = 0 WHERE role <> 'user';

-- ---- data: player codes and auction order ------------------------------------------
UPDATE players SET player_code = CONCAT('JPL', LPAD(id, 3, '0')) WHERE player_code IS NULL;
UPDATE players SET auction_order = id WHERE auction_order IS NULL;

INSERT IGNORE INTO schema_migrations (name) VALUES
    ('001_remove_owner_player_rows'), ('002_franchise_18cr_12_players'), ('003_player_codes_and_order');

COMMIT;

-- ---- integrity constraints (run after the data fixes) --------------------------------
-- If a franchise already holds more than 12 players, fix it before adding the squad check.
ALTER TABLE users ADD CONSTRAINT chk_users_purse_nonneg CHECK (purse >= 0);
ALTER TABLE users ADD CONSTRAINT chk_users_spent_nonneg CHECK (total_spent >= 0);
ALTER TABLE users ADD CONSTRAINT chk_users_squad_range CHECK (squad_count >= 0 AND squad_count <= max_squad_size);

-- Rankings are computed in Node. After this script, run:  npm run migrate
-- (or press "Recalculate rankings" in Admin → Manage → Players).
