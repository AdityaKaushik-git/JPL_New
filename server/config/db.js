const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'jpl_auction',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE) || 10,
    queueLimit: 0,
    // Return DECIMAL columns as strings so no precision is lost; convert explicitly.
    decimalNumbers: false,
    timezone: 'Z',
};

// Managed/cloud MySQL often requires TLS. Enable with DB_SSL=true
// (kept automatic for Aiven hosts for backwards compatibility).
const wantsSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true'
    || (process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com'));
if (wantsSsl) {
    dbConfig.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(dbConfig);

module.exports = pool;
