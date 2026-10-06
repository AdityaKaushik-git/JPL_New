const BASE = '/api'

function getHeaders() {
  const token = localStorage.getItem('jpl_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(BASE + path, { headers: getHeaders(), ...options })
  } catch (e) {
    throw new Error('Cannot reach the server. Check your connection.')
  }
  let data = {}
  try { data = await res.json() } catch (e) { data = {} }
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`)
    err.status = res.status
    err.errors = data.errors
    throw err
  }
  return data
}

const json = (method, body) => ({ method, body: JSON.stringify(body || {}) })

export const api = {
  // auth — there is no public registration
  login: (body) => request('/auth/login', json('POST', body)),
  logout: () => request('/auth/logout', json('POST')),
  getMe: () => request('/auth/me'),

  // public
  getPlayers: () => request('/players'),
  getRankings: (category = 'overall') => request(`/players/rankings?category=${encodeURIComponent(category)}`),
  getPlayer: (id) => request(`/players/${id}`),
  getFranchises: () => request('/franchises'),
  getFranchise: (id) => request(`/franchises/${id}`),
  getAuctionStatus: () => request('/auction/status'),
  getHistory: () => request('/auction/history'),

  // signed in
  getDashboard: () => request('/users/dashboard'),
  getStandings: () => request('/users/standings'),
  getMyTeam: () => request('/users/my-team'),
  getMyBids: () => request('/users/my-bids'),
  getProfile: () => request('/users/profile'),
  updateProfile: (body) => request('/users/profile', json('PUT', body)),
  updatePlayerProfile: (body) => request('/users/player-profile', json('PUT', body)),
  importPlayers: (body) => request('/admin/players/import', json('POST', body)),

  // admin
  getAdminStats: () => request('/admin/stats'),
  getAdminUsers: () => request('/admin/users'),
  getAdminFranchises: () => request('/admin/franchises'),
  createFranchise: (body) => request('/admin/franchises', json('POST', body)),
  updateFranchise: (id, body) => request(`/admin/franchises/${id}`, json('PUT', body)),
  setFranchiseStatus: (id, status) => request(`/admin/franchises/${id}/status`, json('PATCH', { status })),
  resetFranchisePassword: (id, password) => request(`/admin/franchises/${id}/password`, json('PATCH', { password })),
  getAdminPlayers: () => request('/admin/players'),
  addPlayer: (body) => request('/admin/players', json('POST', body)),
  updatePlayer: (id, body) => request(`/admin/players/${id}`, json('PUT', body)),
  updatePlayerStatus: (id, status) => request(`/admin/players/${id}/status`, json('PATCH', { status })),
  deletePlayer: (id) => request(`/admin/players/${id}`, { method: 'DELETE' }),
  addPlayerMatch: (id, body) => request(`/admin/players/${id}/matches`, json('POST', body)),
  deletePlayerMatch: (id, matchId) => request(`/admin/players/${id}/matches/${matchId}`, { method: 'DELETE' }),
  recalculateRankings: () => request('/admin/rankings/recalculate', json('POST')),
  getAuctionHistory: () => request('/admin/auction-history'),
  deleteAuctionHistory: (id) => request(`/admin/auction-history/${id}`, { method: 'DELETE' }),
}
