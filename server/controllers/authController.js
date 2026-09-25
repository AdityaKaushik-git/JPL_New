/**
 * Authentication. There is NO public registration:
 * franchise accounts are created by the admin (see adminController.createFranchise).
 */
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { toRupees } = require('../utils/money');

function shapeUser(u) {
    const base = {
        id: u.id,
        full_name: u.full_name,
        enrollment_number: u.enrollment_number,
        email: u.email,
        mobile: u.mobile,
        role: u.role,
    };
    if (u.role !== 'user') return base;
    return {
        ...base,
        team_name: u.team_name,
        short_name: u.team_short_name,
        color: u.team_color,
        starting_purse: toRupees(u.starting_purse),
        purse: toRupees(u.purse),
        total_spent: toRupees(u.total_spent),
        squad_count: Number(u.squad_count) || 0,
        max_squad_size: Number(u.max_squad_size) || 12,
        status: u.status,
    };
}

const USER_COLUMNS = `id, full_name, enrollment_number, email, mobile, role, team_name, team_short_name,
    team_color, starting_purse, purse, total_spent, squad_count, max_squad_size, status`;

exports.login = async (req, res) => {
    try {
        const loginId = String((req.body && req.body.loginId) || '').trim();
        const password = String((req.body && req.body.password) || '');
        if (!loginId || !password) {
            return res.status(400).json({ message: 'Enter your login ID and password.' });
        }

        const [users] = await pool.query(
            `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = ? OR enrollment_number = ? LIMIT 1`,
            [loginId, loginId]
        );
        if (users.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

        const user = users[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ message: 'Invalid credentials' });
        if (user.status === 'disabled') {
            return res.status(403).json({ message: 'This account is disabled. Contact the JPL admin.' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, enrollment_number: user.enrollment_number },
            process.env.JWT_SECRET,
            { expiresIn: '24h', algorithm: 'HS256' }
        );

        res.json({ message: 'Login successful', token, user: shapeUser(user) });
    } catch (error) {
        console.error('LOGIN ERROR:', error.message);
        if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code)) {
            console.error('DATABASE CONNECTION FAILED — check DB_* environment variables');
        }
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const [users] = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [req.user.id]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        if (users[0].status === 'disabled') return res.status(403).json({ message: 'This account is disabled.' });
        res.json({ user: shapeUser(users[0]) });
    } catch (error) {
        console.error('GETME ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.shapeUser = shapeUser;
exports.USER_COLUMNS = USER_COLUMNS;
