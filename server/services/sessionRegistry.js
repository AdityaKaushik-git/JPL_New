/**
 * SessionRegistry — Strict enforcement of active session limits across devices.
 *   - Franchise Bidders (role 'user'): Exactly 1 active session allowed per account.
 *   - Admin (role 'admin'): Maximum 2 active sessions allowed across all devices.
 */

const userSessions = new Map();  // userId -> { token, socketIds: Set, lastSeen, ip }
const adminSessions = new Map(); // token -> { userId, socketIds: Set, lastSeen, ip }

const STALE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes without socket or API activity

function cleanStaleSessions() {
  const now = Date.now();
  for (const [userId, session] of userSessions.entries()) {
    const hasSockets = session.socketIds && session.socketIds.size > 0;
    if (!hasSockets && (now - session.lastSeen > STALE_TIMEOUT_MS)) {
      userSessions.delete(userId);
    }
  }
  for (const [token, session] of adminSessions.entries()) {
    const hasSockets = session.socketIds && session.socketIds.size > 0;
    if (!hasSockets && (now - session.lastSeen > STALE_TIMEOUT_MS)) {
      adminSessions.delete(token);
    }
  }
}

setInterval(cleanStaleSessions, 30000);

function registerSession(user, token, req = {}) {
  cleanStaleSessions();
  const userId = user.id;
  const role = user.role;
  const ip = req.ip || (req.headers && req.headers['x-forwarded-for']) || 'unknown';

  if (role === 'user') {
    const existing = userSessions.get(userId);
    if (existing) {
      const hasSockets = existing.socketIds && existing.socketIds.size > 0;
      const isRecent = (Date.now() - existing.lastSeen) < STALE_TIMEOUT_MS;
      if (hasSockets || isRecent) {
        const err = new Error('CONCURRENT LOGIN BLOCKED — This bidder account is currently active on another device. Only 1 active bidder session is allowed.');
        err.status = 403;
        throw err;
      }
      // Evict stale session
      userSessions.delete(userId);
    }
    userSessions.set(userId, {
      token,
      userId,
      socketIds: new Set(),
      lastSeen: Date.now(),
      ip,
    });
  } else if (role === 'admin') {
    // Count active admin sessions
    const activeAdminCount = Array.from(adminSessions.values()).filter(s => {
      const hasSockets = s.socketIds && s.socketIds.size > 0;
      const isRecent = (Date.now() - s.lastSeen) < STALE_TIMEOUT_MS;
      return hasSockets || isRecent;
    }).length;

    if (activeAdminCount >= 2 && !adminSessions.has(token)) {
      const err = new Error('ADMIN SESSION LIMIT REACHED — Maximum 2 active admin sessions are allowed across devices. Please log out from another device first.');
      err.status = 403;
      throw err;
    }

    adminSessions.set(token, {
      token,
      userId,
      socketIds: new Set(),
      lastSeen: Date.now(),
      ip,
    });
  }
}

function removeSession(user, token) {
  if (!user) return;
  if (user.role === 'user') {
    userSessions.delete(user.id);
  } else if (user.role === 'admin') {
    if (token) adminSessions.delete(token);
  }
}

function touchSession(user, token, socketId = null) {
  if (!user) return;
  const now = Date.now();
  if (user.role === 'user') {
    const session = userSessions.get(user.id);
    if (session) {
      session.lastSeen = now;
      if (socketId) session.socketIds.add(socketId);
    }
  } else if (user.role === 'admin' && token) {
    const session = adminSessions.get(token);
    if (session) {
      session.lastSeen = now;
      if (socketId) session.socketIds.add(socketId);
    }
  }
}

function socketDisconnected(user, token, socketId) {
  if (!user) return;
  if (user.role === 'user') {
    const session = userSessions.get(user.id);
    if (session && session.socketIds) {
      session.socketIds.delete(socketId);
      session.lastSeen = Date.now();
    }
  } else if (user.role === 'admin' && token) {
    const session = adminSessions.get(token);
    if (session && session.socketIds) {
      session.socketIds.delete(socketId);
      session.lastSeen = Date.now();
    }
  }
}

function isSessionValid(user, token) {
  if (!user) return false;
  if (user.role === 'user') {
    const session = userSessions.get(user.id);
    return Boolean(session && session.token === token);
  } else if (user.role === 'admin') {
    return adminSessions.has(token);
  }
  return true;
}

module.exports = {
  registerSession,
  removeSession,
  touchSession,
  socketDisconnected,
  isSessionValid,
};
