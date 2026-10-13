const BASE = '/api'

export function getDeviceId() {
  let id = localStorage.getItem('jpl_device_id')
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    localStorage.setItem('jpl_device_id', id)
  }
  return id
}

function getHeaders(path = '') {
  const token = sessionStorage.getItem('jpl_token') || localStorage.getItem('jpl_token')
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': getDeviceId(),
  }
  // Never send an old/stale token to the login endpoint
  if (token && path !== '/auth/login') {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function request(path, options = {}) {
  const reqHeaders = { ...getHeaders(path), ...(options.headers || {}) }
  let res
  try {
    res = await fetch(BASE + path, { ...options, headers: reqHeaders })
  } catch (e) {
    throw new Error('Cannot reach the server. Check your connection.')
  }
  let data = {}
  try { data = await res.json() } catch (e) { data = {} }
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') {
      const sentToken = reqHeaders['Authorization'] ? reqHeaders['Authorization'].replace('Bearer ', '') : null
      window.dispatchEvent(new CustomEvent('jpl:unauthorized', { detail: { token: sentToken } }))
    }
    const err = new Error(data.message || `Request failed (${res.status})`)
    err.status = res.status
    err.errors = data.errors
    err.canForceLogout = Boolean(data.canForceLogout)
    throw err
  }
  return data
}

const json = (method, body) => ({ method, body: JSON.stringify(body || {}) })

export const api = {
  // auth — there is no public registration
  login: (body) => request('/auth/login', json('POST', { deviceId: getDeviceId(), ...body })),
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
  deleteAllBidders: () => request('/admin/franchises/all', { method: 'DELETE' }),
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
  requestStartOtp: () => request('/admin/auction/request-start-otp', json('POST')),
  verifyStartOtp: (otp) => request('/admin/auction/verify-start-otp', json('POST', { otp })),
}
