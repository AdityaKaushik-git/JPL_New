// Minimal in-memory rate limiter (no extra dependency).
function createLimiter({ windowMs, max, message }) {
    const hits = new Map();
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
    }, windowMs).unref();

    return (req, res, next) => {
        const key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || entry.reset <= now) {
            entry = { count: 0, reset: now + windowMs };
            hits.set(key, entry);
        }
        entry.count++;
        if (entry.count > max) {
            res.set('Retry-After', Math.ceil((entry.reset - now) / 1000));
            return res.status(429).json({ message });
        }
        next();
    };
}

const loginLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many login attempts. Try again in a few minutes.',
});

module.exports = { createLimiter, loginLimiter };
