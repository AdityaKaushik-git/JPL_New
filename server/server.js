require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error('JWT_SECRET is missing or shorter than 16 characters. Set it in the environment.');
    process.exit(1);
}

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.CORS_ORIGIN || '*';
const io = new Server(server, {
    cors: { origin: allowedOrigin },
    pingInterval: 20000,
    pingTimeout: 20000,
});

app.set('trust proxy', 1); // Render sits behind a proxy
app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '1mb' })); // team logos are sent as data URLs
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    next();
});

// API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/players', require('./routes/playerRoutes'));
app.use('/api/franchises', require('./routes/franchiseRoutes'));
app.use('/api/auction', require('./routes/auctionRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Real-time auction engine
require('./sockets/auctionSocket')(io);

// React build
const distDir = path.join(__dirname, '../client/dist');
app.use(express.static(distDir, { index: false, maxAge: '1h' }));
app.get(/(.*)/, (req, res) => {
    const indexFile = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexFile)) {
        return res.status(503).send('Client build not found. Run "npm run build" first.');
    }
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`JPL auction server running on port ${PORT}`);

    // Self-ping helper for Render deployments if URL is configured
    const appUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
    if (appUrl) {
        const https = require('https');
        const http = require('http');
        const client = appUrl.startsWith('https') ? https : http;
        setInterval(() => {
            client.get(`${appUrl}/api/health`, (res) => {
                console.log(`[Keep-Alive] Pinged health endpoint — Status ${res.statusCode}`);
            }).on('error', (err) => {
                console.warn(`[Keep-Alive] Ping failed: ${err.message}`);
            });
        }, 10 * 60 * 1000); // 10 minutes
    }
});
