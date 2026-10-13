-- ============================================================================
--  003_indian_count_no_foreign_cap.sql
--  JPL Rule Change:
--    - No limit on foreign players (MAX_FOREIGN_PLAYERS = Infinity)
--    - Minimum 3 Indian players per squad (MIN_INDIAN_PLAYERS = 3)
--    - Add indian_count column to track Indian players per franchise
--    - Update ranking_points for all players from the official Excel list
--
--  Run: npm run migrate   (migrate.js applies this automatically)
-- ============================================================================

START TRANSACTION;

-- ---- users: add indian_count tracking column ---------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS indian_count INT NOT NULL DEFAULT 0 AFTER foreign_count;

-- ---- data: reconcile indian_count from existing teams -----------------------
UPDATE users u
SET indian_count = COALESCE(
    (SELECT COUNT(*) FROM teams t
     JOIN players p ON p.id = t.player_id
     WHERE t.user_id = u.id
       AND (p.country IS NULL OR TRIM(LOWER(p.country)) = 'india')),
    0
)
WHERE u.role = 'user';

INSERT IGNORE INTO schema_migrations (name) VALUES ('003_indian_count_no_foreign_cap');

COMMIT;
