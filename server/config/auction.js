/**
 * JPL auction rules — the single source of truth for business constants.
 *
 * Money is handled in whole rupees on the server. MySQL stores it as DECIMAL,
 * and every value that crosses the wire is re-validated here before use.
 */

// ₹18,00,00,000 — assigned by the server to every franchise the admin creates.
const STARTING_PURSE = 180000000;

// A franchise may own at most 12 players. The owner is NOT a player.
const MAX_SQUAD_SIZE = 12;

// Timer (seconds). The server owns the clock; clients only display it.
const INITIAL_TIMER_SECONDS = clampInt(process.env.AUCTION_INITIAL_SECONDS, 30, 5, 600);
const BID_RESET_SECONDS = clampInt(process.env.AUCTION_BID_RESET_SECONDS, 15, 3, 120);

// When the timer reaches zero the server closes the lot automatically
// (SOLD to the highest bidder, otherwise UNSOLD). Set AUCTION_AUTO_FINALIZE=false
// to keep the old behaviour where the admin decides manually.
const AUTO_FINALIZE = String(process.env.AUCTION_AUTO_FINALIZE || 'true').toLowerCase() !== 'false';

// How long the SOLD / UNSOLD result stays on screen before the admin can move on
// (purely informational for clients; the admin still presses NEXT PLAYER).
const RESULT_HOLD_MS = 6000;

/**
 * Bid increment ladder.
 *   below ₹1 Cr        → +₹1,00,000
 *   ₹1 Cr – below ₹5 Cr → +₹5,00,000
 *   ₹5 Cr and above     → +₹10,00,000
 */
function getIncrement(currentBid) {
    const cb = Number(currentBid) || 0;
    if (cb < 10000000) return 100000;
    if (cb < 50000000) return 500000;
    return 1000000;
}

function getNextBid(currentBid, basePrice) {
    const cb = Number(currentBid) || 0;
    if (cb <= 0) return Math.round(Number(basePrice) || 0);
    return cb + getIncrement(cb);
}

function clampInt(value, fallback, min, max) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

module.exports = {
    STARTING_PURSE,
    MAX_SQUAD_SIZE,
    INITIAL_TIMER_SECONDS,
    BID_RESET_SECONDS,
    AUTO_FINALIZE,
    RESULT_HOLD_MS,
    getIncrement,
    getNextBid,
};
