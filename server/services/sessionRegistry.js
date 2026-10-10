// SessionRegistry — Strict enforcement of active session limits across devices.

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

function registerSession(user, token, req = {}, forceLogoutOthers = false, deviceId = null) {
  cleanStaleSessions();
  const userId = user.id;
  const role = user.role;
  const ip = req.ip || (req.headers && req.headers['x-forwarded-for']) || 'unknown';
  const reqDeviceId = deviceId || (req.body && req.body.deviceId) || (req.headers && req.headers['x-device-id']) || null;

  if (forceLogoutOthers) {
    if (role === 'user') {
      userSessions.delete(userId);
    } else if (role === 'admin') {
      for (const [t, s] of adminSessions.entries()) {
        if (s.userId === userId) adminSessions.delete(t);
      }
    }
  }

  if (role === 'user') {
    const existing = userSessions.get(userId);
    if (existing && !forceLogoutOthers) {
      // Treat as same device if deviceId matches OR if deviceId is omitted/untracked
      const isSameDevice = !reqDeviceId || !existing.deviceId || (reqDeviceId === existing.deviceId);

      if (!isSameDevice) {
        const hasSockets = existing.socketIds && existing.socketIds.size > 0;
        const isRecent = (Date.now() - existing.lastSeen) < STALE_TIMEOUT_MS;
        if (hasSockets || isRecent) {
          const err = new Error('This account is active on another device.');
          err.status = 409;
          err.canForceLogout = true;
          throw err;
        }
      }
      userSessions.delete(userId);
    }
    userSessions.set(userId, {
      token,
      userId,
      deviceId: reqDeviceId,
      socketIds: new Set(),
      lastSeen: Date.now(),
      ip,
    });
  } else if (role === 'admin') {
    // Delete previous session for the same admin user on this device or untracked device
    for (const [t, s] of adminSessions.entries()) {
      if (s.userId === userId && (!reqDeviceId || !s.deviceId || s.deviceId === reqDeviceId)) {
        adminSessions.delete(t);
      }
    }

    const activeAdminCount = Array.from(adminSessions.values()).filter(s => {
      const hasSockets = s.socketIds && s.socketIds.size > 0;
      const isRecent = (Date.now() - s.lastSeen) < STALE_TIMEOUT_MS;
      return hasSockets || isRecent;
    }).length;

    if (activeAdminCount >= 2 && !adminSessions.has(token) && !forceLogoutOthers) {
      const err = new Error('Maximum admin sessions reached across devices.');
      err.status = 409;
      err.canForceLogout = true;
      throw err;
    }

    adminSessions.set(token, {
      token,
      userId,
      deviceId: reqDeviceId,
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
  if (!user || !user.id) return false;
  if (user.role === 'user') {
    const session = userSessions.get(user.id);
    if (session) {
      return session.token === token;
    }
    // Auto-restore session for this valid JWT token if no conflicting session exists
    userSessions.set(user.id, {
      token,
      userId: user.id,
      socketIds: new Set(),
      lastSeen: Date.now(),
      ip: 'auto-restored',
    });
    return true;
  } else if (user.role === 'admin') {
    if (!token) return false;
    if (adminSessions.has(token)) return true;
    if (adminSessions.size < 2) {
      adminSessions.set(token, {
        token,
        userId: user.id,
        socketIds: new Set(),
        lastSeen: Date.now(),
        ip: 'auto-restored',
      });
      return true;
    }
    return false;
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
