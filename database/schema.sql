-- ============================================================================
--  JPL — JCC Cricket Sports Meet auction platform
--  Complete schema for a FRESH database (MySQL 8.0.16+ / MariaDB 10.4+).
--  For an existing database created from the old schema, run
--  `npm run migrate` (idempotent) or database/migrations/001_premium_auction.sql.
--
--  Money is DECIMAL(15,2) everywhere. No player photo columns exist by design.
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,                    -- franchise: owner name
    enrollment_number VARCHAR(50) NOT NULL UNIQUE,      -- login ID
    email VARCHAR(100) NULL UNIQUE,
    mobile VARCHAR(20) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin', 'player') NOT NULL DEFAULT 'user',  -- 'user' = franchise owner
    team_name VARCHAR(100) NULL,
    team_short_name VARCHAR(6) NULL,
    team_color CHAR(7) NULL,
    logo MEDIUMTEXT NULL,                               -- team logo as data URL (franchises only)
    starting_purse DECIMAL(15,2) NOT NULL DEFAULT 0.00, -- set by the server: ₹18,00,00,000
    purse DECIMAL(15,2) NOT NULL DEFAULT 0.00,          -- remaining purse
    total_spent DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    squad_count INT NOT NULL DEFAULT 0,
    max_squad_size INT NOT NULL DEFAULT 12,
    status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_purse_nonneg CHECK (purse >= 0),
    CONSTRAINT chk_users_spent_nonneg CHECK (total_spent >= 0),
    CONSTRAINT chk_users_squad_range CHECK (squad_count >= 0 AND squad_count <= max_squad_size)
);

CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_code VARCHAR(20) NULL UNIQUE,
    auction_order INT NULL,
    name VARCHAR(100) NOT NULL,
    playing_role ENUM('Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper') NOT NULL,
    batting_style VARCHAR(40) NULL,
    bowling_style VARCHAR(60) NULL,
    course VARCHAR(50) NOT NULL DEFAULT 'N/A',
    year VARCHAR(20) NOT NULL DEFAULT 'N/A',
    enrollment_number VARCHAR(50) NOT NULL UNIQUE,
    base_price DECIMAL(15,2) NOT NULL,
    base_price_updates_count INT NOT NULL DEFAULT 0,
    status ENUM('Available', 'In Auction', 'Sold', 'Unsold') NOT NULL DEFAULT 'Available',

    matches INT NOT NULL DEFAULT 0,
    innings INT NOT NULL DEFAULT 0,
    not_outs INT NOT NULL DEFAULT 0,
    runs INT NOT NULL DEFAULT 0,
    balls_faced INT NOT NULL DEFAULT 0,
    highest_score VARCHAR(10) NULL,
    fifties INT NOT NULL DEFAULT 0,
    hundreds INT NOT NULL DEFAULT 0,
    balls_bowled INT NOT NULL DEFAULT 0,
    runs_conceded INT NOT NULL DEFAULT 0,
    wickets INT NOT NULL DEFAULT 0,
    best_bowling VARCHAR(10) NULL,
    three_wkt_hauls INT NOT NULL DEFAULT 0,
    four_wkt_hauls INT NOT NULL DEFAULT 0,
    five_wkt_hauls INT NOT NULL DEFAULT 0,
    catches INT NOT NULL DEFAULT 0,
    stumpings INT NOT NULL DEFAULT 0,
    run_outs INT NOT NULL DEFAULT 0,
    player_of_match INT NOT NULL DEFAULT 0,
    form_points INT NOT NULL DEFAULT 0,

    batting_average DECIMAL(7,2) NOT NULL DEFAULT 0.00,
    strike_rate DECIMAL(7,2) NOT NULL DEFAULT 0.00,
    bowling_average DECIMAL(7,2) NOT NULL DEFAULT 0.00,
    economy DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    bowling_strike_rate DECIMAL(7,2) NOT NULL DEFAULT 0.00,

    ranking_points INT NOT NULL DEFAULT 0,
    previous_ranking_points INT NOT NULL DEFAULT 0,
    current_rank INT NULL,
    previous_rank INT NULL,
    category_rank INT NULL,
    previous_category_rank INT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_players_status (status),
    INDEX idx_players_rank (current_rank),
    INDEX idx_players_order (auction_order)
);

CREATE TABLE IF NOT EXISTS auctions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    status ENUM('Pending', 'Live', 'Paused', 'Completed') DEFAULT 'Pending',
    current_bid DECIMAL(15,2) DEFAULT 0.00,
    highest_bidder_id INT DEFAULT NULL,
    start_time TIMESTAMP NULL,
    end_time TIMESTAMP NULL,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (highest_bidder_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    auction_id INT NOT NULL,
    user_id INT NOT NULL,
    bid_amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (auction_id) REFERENCES auctions(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    player_id INT NOT NULL UNIQUE,
    purchase_price DECIMAL(15,2) NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS auction_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    auction_id INT NOT NULL UNIQUE,
    player_id INT NOT NULL,
    status ENUM('Sold', 'Unsold') NOT NULL,
    winning_bid DECIMAL(15,2) DEFAULT NULL,
    winning_user_id INT DEFAULT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (auction_id) REFERENCES auctions(id),
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (winning_user_id) REFERENCES users(id)
);

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
