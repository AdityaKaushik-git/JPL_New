const jwt = require('jsonwebtoken');

function verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
}

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        req.user = verifyToken(token);
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

/** Attaches req.user when a valid token is present, but never rejects. */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try { req.user = verifyToken(authHeader.split(' ')[1]); } catch (e) { req.user = null; }
    }
    next();
};

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ message: 'Admin access required' });
};

const franchiseMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'user') return next();
    return res.status(403).json({ message: 'Franchise owner access required' });
};

module.exports = { authMiddleware, optionalAuth, adminMiddleware, franchiseMiddleware, verifyToken };
