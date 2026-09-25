/**
 * Tiny registry so REST controllers can trigger real-time broadcasts
 * without importing the socket module directly (avoids circular requires).
 */
const hub = {
    io: null,
    engine: null,
};

function register(io, engine) {
    hub.io = io;
    hub.engine = engine;
}

/** Re-broadcast franchise purses / squad counts to every client. */
async function notifyTeamsChanged() {
    if (hub.engine) await hub.engine.broadcastTeams();
}

/** Tell clients that player data (stats, ranks, statuses) changed. */
function notifyPlayersChanged() {
    if (hub.io) hub.io.emit('players:changed');
}

/** The player id currently on the auction block (or null). */
function activePlayerId() {
    return hub.engine ? hub.engine.getActivePlayerId() : null;
}

/** Snapshot of the live auction state, or null before the engine starts. */
function getState() {
    return hub.engine ? hub.engine.getState() : null;
}

module.exports = { register, notifyTeamsChanged, notifyPlayersChanged, activePlayerId, getState };
