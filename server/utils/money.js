// Money helpers.

function toRupees(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n);
}

// Parses a user-supplied money value.
function parseMoney(value, { min = 1, max = 1000000000 } = {}) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(String(value).replace(/[,₹\s]/g, ''));
    if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
    if (n < min || n > max) return null;
    return n;
}

// ₹18,00,00,000 style (Indian digit grouping).
function formatINR(value) {
    return '₹' + toRupees(value).toLocaleString('en-IN');
}

module.exports = { toRupees, parseMoney, formatINR };
