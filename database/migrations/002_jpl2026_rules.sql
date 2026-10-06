-- ============================================================================
--  002_jpl2026_rules.sql
--  Upgrades the JPL schema to the 2026 rules:
--    - Purse: ?75 Cr (750,000,000)
--    - Squad: 15 players
--    - Keepers: max 2 (was 1)
--    - New columns: foreign_count, uncapped_count on users
--    - New column: is_uncapped on players
--
--  Run: mysql -u USER -p jpl_auction < database/migrations/002_jpl2026_rules.sql
--  Or:  npm run migrate  (migrate.js applies this automatically)
-- ============================================================================

START TRANSACTION;

-- ---- users: add new tracking columns ----------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS foreign_count  INT NOT NULL DEFAULT 0 AFTER keepers_count,
    ADD COLUMN IF NOT EXISTS uncapped_count INT NOT NULL DEFAULT 0 AFTER foreign_count;

-- ---- players: add is_uncapped flag ------------------------------------------
ALTER TABLE players
    ADD COLUMN IF NOT EXISTS is_uncapped TINYINT(1) NOT NULL DEFAULT 0 AFTER country_code;

-- ---- data: upgrade purse to ?75 Cr, squad to 15 ----------------------------
UPDATE users
SET starting_purse = 750000000.00,
    max_squad_size  = 15,
    purse = GREATEST(
        750000000.00 - COALESCE((SELECT SUM(t.purchase_price) FROM teams t WHERE t.user_id = users.id), 0),
        0
    )
WHERE role = 'user';

-- ---- data: reconcile foreign_count from teams + players ----------------------
UPDATE users u
SET foreign_count = COALESCE(
    (SELECT COUNT(*) FROM teams t
     JOIN players p ON p.id = t.player_id
     WHERE t.user_id = u.id
       AND p.country IS NOT NULL
       AND TRIM(LOWER(p.country)) <> 'india'
       AND TRIM(p.country) <> ''),
    0
)
WHERE u.role = 'user';

-- ---- data: reconcile uncapped_count from teams + players --------------------
UPDATE users u
SET uncapped_count = COALESCE(
    (SELECT COUNT(*) FROM teams t
     JOIN players p ON p.id = t.player_id
     WHERE t.user_id = u.id AND p.is_uncapped = 1),
    0
)
WHERE u.role = 'user';

INSERT IGNORE INTO schema_migrations (name) VALUES ('006_jpl2026_rules');

COMMIT;