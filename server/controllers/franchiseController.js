// Public franchise data: team strip, standings and squads.
const pool = require('../config/db');
const { listFranchises, getFranchise } = require('../services/franchises');
const { publicPlayer } = require('../services/serializers');
const { toRupees } = require('../utils/money');

exports.list = async (req, res) => {
    try {
        res.json({ franchises: await listFranchises(pool) });
    } catch (error) {
        console.error('LIST FRANCHISES ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

async function squadOf(franchiseId) {
    const [rows] = await pool.query(
        `SELECT p.*, t.purchase_price, t.purchased_at FROM teams t
         JOIN players p ON p.id = t.player_id WHERE t.user_id = ? ORDER BY t.purchase_price DESC, t.purchased_at`,
        [franchiseId]
    );
    return rows.map(r => publicPlayer(r, { purchase_price: toRupees(r.purchase_price), purchased_at: r.purchased_at }));
}

exports.getOne = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid franchise id' });
        const franchise = await getFranchise(pool, id);
        if (!franchise) return res.status(404).json({ message: 'Franchise not found' });
        res.json({ franchise, squad: await squadOf(id) });
    } catch (error) {
        console.error('GET FRANCHISE ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getLogo = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).end();
        const [rows] = await pool.query("SELECT logo FROM users WHERE id = ? AND role = 'user'", [id]);
        const logo = rows.length ? rows[0].logo : null;
        const m = logo && /^data:([a-z+/]+);base64,(.+)$/.exec(logo);
        if (!m) return res.status(404).end();
        res.set('Content-Type', m[1]);
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.set('X-Content-Type-Options', 'nosniff');
        if (m[1] === 'image/svg+xml') res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
        res.send(Buffer.from(m[2], 'base64'));
    } catch (error) {
        console.error('GET LOGO ERROR:', error.message);
        res.status(500).end();
    }
};

exports.squadOf = squadOf;
