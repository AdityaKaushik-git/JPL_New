// Franchise (team owner) accounts.
const bcrypt = require('bcrypt');
const { publicFranchise } = require('./serializers');
const { STARTING_PURSE, MAX_SQUAD_SIZE } = require('../config/auction');

const FRANCHISE_COLUMNS = `id, full_name, team_name, team_short_name, team_color,
    (logo IS NOT NULL AND logo <> '') AS logo, starting_purse, purse, total_spent,
    squad_count, max_squad_size,
    batsmen_count, bowlers_count, allrounders_count, keepers_count,
    foreign_count, uncapped_count,
    (SELECT COALESCE(SUM(p.ranking_points), 0) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = users.id) AS total_player_points,
    (SELECT COALESCE(SUM(p.ranking_points), 0) FROM teams t JOIN players p ON p.id = t.player_id WHERE t.user_id = users.id AND p.playing_role = 'Batsman') AS batsmen_points,
    status, updated_at`;

const PALETTE = ['#C8102E', '#1F6FEB', '#2FA36B', '#F2C14E', '#8B5CF6', '#E8590C', '#0EA5A4', '#DB2777'];
const LOGO_MAX_CHARS = 400000; // ≈ 290 KB image once base64-decoded
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

const PASSWORD_RULES = [
    { test: p => p.length >= 8, msg: 'at least 8 characters' },
    { test: p => /[A-Z]/.test(p), msg: 'an uppercase letter' },
    { test: p => /[a-z]/.test(p), msg: 'a lowercase letter' },
    { test: p => /[0-9]/.test(p), msg: 'a number' },
    { test: p => /[^A-Za-z0-9]/.test(p), msg: 'a special character' },
];

function validatePassword(password) {
    const p = String(password || '');
    const missing = PASSWORD_RULES.filter(r => !r.test(p)).map(r => r.msg);
    return missing.length ? `Password needs ${missing.join(', ')}.` : null;
}

function validateLogo(logo) {
    if (logo === undefined || logo === null || logo === '') return { value: null };
    const s = String(logo);
    const m = /^data:([a-z+/]+);base64,[A-Za-z0-9+/=]+$/.exec(s);
    if (!m || !LOGO_TYPES.includes(m[1])) return { error: 'Team logo must be a PNG, JPG, WEBP or SVG image.' };
    if (s.length > LOGO_MAX_CHARS) return { error: 'Team logo must be smaller than 280 KB.' };
    return { value: s };
}

// Validates admin input for a new franchise.
function validateFranchiseInput(body, { requirePassword = true } = {}) {
    body = body || {};
    const errors = {};
    const values = {};

    const teamName = String(body.team_name || '').trim();
    if (teamName.length < 2 || teamName.length > 100) errors.team_name = 'Team name must be 2–100 characters.';
    values.team_name = teamName;

    const shortName = String(body.short_name || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{2,6}$/.test(shortName)) errors.short_name = 'Short name must be 2–6 letters or digits.';
    values.team_short_name = shortName;

    const ownerName = String(body.owner_name || '').trim();
    if (ownerName.length < 2 || ownerName.length > 100) errors.owner_name = 'Owner name must be 2–100 characters.';
    values.full_name = ownerName;

    if ('login_id' in body || requirePassword) {
        const loginId = String(body.login_id || '').trim();
        if (!/^[A-Za-z0-9@._-]{3,50}$/.test(loginId)) {
            errors.login_id = 'Login ID / email must be 3–50 characters (letters, digits, @ . _ -).';
        }
        values.enrollment_number = loginId;
        values.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId) ? loginId.toLowerCase() : null;
    }

    if (requirePassword || body.password) {
        const pwError = validatePassword(body.password);
        if (pwError) errors.password = pwError;
        values.password = String(body.password || '');
    }

    const logo = validateLogo(body.logo);
    if (logo.error) errors.logo = logo.error;
    values.logo = logo.value;

    const color = String(body.color || '').trim();
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) errors.color = 'Colour must be a hex value like #C8102E.';
    values.team_color = color ? color.toUpperCase() : null;

    return { values, errors };
}

async function listFranchises(db) {
    const [rows] = await db.query(
        `SELECT ${FRANCHISE_COLUMNS} FROM users WHERE role = 'user'
         ORDER BY total_player_points DESC, purse DESC, batsmen_points DESC, squad_count DESC, team_name ASC, id ASC`
    );
    return rows.map(publicFranchise);
}

async function getFranchise(db, id) {
    const [rows] = await db.query(
        `SELECT ${FRANCHISE_COLUMNS} FROM users WHERE role = 'user' AND id = ?`, [id]
    );
    return rows.length ? publicFranchise(rows[0]) : null;
}

// Creates a franchise.
async function createFranchise(db, body) {
    const { values, errors } = validateFranchiseInput(body, { requirePassword: true });
    if (Object.keys(errors).length) {
        throw Object.assign(new Error('Please fix the highlighted fields.'), { status: 400, errors });
    }

    const [dupes] = await db.query(
        `SELECT enrollment_number, email, team_name, team_short_name FROM users
         WHERE enrollment_number = ? OR (email IS NOT NULL AND email = ?)
            OR (role = 'user' AND (team_name = ? OR team_short_name = ?))`,
        [values.enrollment_number, values.email, values.team_name, values.team_short_name]
    );
    if (dupes.length) {
        const e = {};
        for (const d of dupes) {
            if (d.enrollment_number === values.enrollment_number || (values.email && d.email === values.email)) e.login_id = 'This login ID is already in use.';
            if (d.team_name && d.team_name.toLowerCase() === values.team_name.toLowerCase()) e.team_name = 'A team with this name already exists.';
            if (d.team_short_name === values.team_short_name) e.short_name = 'This short name is already taken.';
        }
        throw Object.assign(new Error('Some details are already in use.'), { status: 409, errors: e });
    }

    if (!values.team_color) {
        const [[{ c }]] = await db.query("SELECT COUNT(*) AS c FROM users WHERE role = 'user'");
        values.team_color = PALETTE[Number(c) % PALETTE.length];
    }

    const hash = await bcrypt.hash(values.password, 10);
    const [result] = await db.query(
        `INSERT INTO users
            (full_name, enrollment_number, email, mobile, password_hash, role,
             team_name, team_short_name, team_color, logo,
             starting_purse, purse, total_spent, squad_count, max_squad_size,
             batsmen_count, bowlers_count, allrounders_count, keepers_count,
             foreign_count, uncapped_count, status)
         VALUES (?, ?, ?, NULL, ?, 'user', ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, 0, 0, 0, 0, 0, 'active')`,
        [values.full_name, values.enrollment_number, values.email, hash,
         values.team_name, values.team_short_name, values.team_color, values.logo,
         STARTING_PURSE, STARTING_PURSE, MAX_SQUAD_SIZE]
    );
    return getFranchise(db, result.insertId);
}

module.exports = {
    FRANCHISE_COLUMNS,
    PALETTE,
    listFranchises,
    getFranchise,
    createFranchise,
    validateFranchiseInput,
    validatePassword,
    validateLogo,
};
