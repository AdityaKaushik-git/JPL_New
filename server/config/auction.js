// JPL 2026 auction rules — the single source of truth for business constants.

// ₹75,00,00,000 — assigned by the server to every franchise the admin creates.
const STARTING_PURSE = 750000000;

// A franchise may own exactly 15 players.
const MAX_SQUAD_SIZE = 15;

// Role-slot limits (STRICT — enforced in the auction engine and validated in DB)
const MAX_BATSMEN     = 5;  // max Batsman per squad
const MAX_BOWLERS     = 5;  // max Bowler per squad
const MAX_ALLROUNDERS = 3;  // max All-Rounder per squad
const MAX_KEEPERS     = 2;  // max Wicket Keeper per squad (NEW: was 1, now 2)

// Foreign-player and uncapped-player limits (NEW)
const MAX_FOREIGN_PLAYERS  = 4;  // max overseas players per squad
const MIN_UNCAPPED_PLAYERS = 2;  // min uncapped players per squad

// Timer (seconds). The server owns the clock; clients only display it.
const INITIAL_TIMER_SECONDS = clampInt(process.env.AUCTION_INITIAL_SECONDS, 30, 5, 600);
const BID_RESET_SECONDS = clampInt(process.env.AUCTION_BID_RESET_SECONDS, 10, 3, 120);

// When the timer reaches zero the server closes the lot automatically
// (SOLD to the highest bidder, otherwise UNSOLD). Set AUCTION_AUTO_FINALIZE=false
// to keep the old behaviour where the admin decides manually.
const AUTO_FINALIZE = String(process.env.AUCTION_AUTO_FINALIZE || 'true').toLowerCase() !== 'false';

// How long the SOLD / UNSOLD result stays on screen before the admin can move on
// (purely informational for clients; the admin still presses NEXT PLAYER).
const RESULT_HOLD_MS = 6000;

// Bid increment ladder (JPL 2026 rules).
function getIncrement(currentBid) {
    const cb = Number(currentBid) || 0;
    if (cb >= 200000000) return 50000000;   // ≥ ₹20 Cr  → +₹5 Cr
    if (cb >= 100000000) return 20000000;   // ≥ ₹10 Cr  → +₹2 Cr
    if (cb >= 50000000)  return 10000000;   // ≥ ₹5 Cr   → +₹1 Cr
    if (cb >= 20000000)  return 5000000;    // ≥ ₹2 Cr   → +₹50 L
    if (cb >= 10000000)  return 2500000;    // ≥ ₹1 Cr   → +₹25 L
    if (cb >= 5000000)   return 1000000;    // ≥ ₹50 L   → +₹10 L
    return 500000;                          //  ₹10-50 L  → +₹5 L
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
    MAX_BATSMEN,
    MAX_BOWLERS,
    MAX_ALLROUNDERS,
    MAX_KEEPERS,
    MAX_FOREIGN_PLAYERS,
    MIN_UNCAPPED_PLAYERS,
    INITIAL_TIMER_SECONDS,
    BID_RESET_SECONDS,
    AUTO_FINALIZE,
    RESULT_HOLD_MS,
    getIncrement,
    getNextBid,
};
