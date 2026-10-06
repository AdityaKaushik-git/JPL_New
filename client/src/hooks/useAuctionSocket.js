import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const EMPTY_STATE = {
  auctionId: null, status: 'Pending', player: null, lot: null, currentBid: 0, highestBidder: null,
  timeLeft: 0, timerTotal: 60, bidHistory: [], bidCount: 0, nextBid: 0, increment: 0, result: null,
}

/**
 * One Socket.IO connection per page. The server is authoritative; this hook only
 * mirrors what it broadcasts and exposes `emit` for intents.
 */
export function useAuctionSocket({ onNotify, onPlayersChanged } = {}) {
  const [state, setState] = useState(EMPTY_STATE)
  const [teams, setTeams] = useState([])
  const [stats, setStats] = useState({ total: 0, bidders: 0, spectators: 0 })
  const [connection, setConnection] = useState('connecting')
  const [overlay, setOverlay] = useState(null)
  const [pulse, setPulse] = useState(null)
  const socketRef = useRef(null)
  const overlayTimer = useRef(null)
  const notifyRef = useRef(onNotify)
  const playersRef = useRef(onPlayersChanged)
  notifyRef.current = onNotify
  playersRef.current = onPlayersChanged

  useEffect(() => {
    const socket = io({
      auth: { token: localStorage.getItem('jpl_token') || undefined },
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
    })
    socketRef.current = socket

    const showOverlay = (payload) => {
      clearTimeout(overlayTimer.current)
      setOverlay(payload)
      overlayTimer.current = setTimeout(() => setOverlay(null), payload.holdMs || 6000)
    }

    socket.on('connect', () => { setConnection('online'); socket.emit('user:join') })
    socket.on('disconnect', () => setConnection('reconnecting'))
    socket.io.on('reconnect_attempt', () => setConnection('reconnecting'))
    socket.io.on('reconnect_failed', () => setConnection('offline'))
    socket.on('connect_error', () => setConnection(c => (c === 'online' ? 'reconnecting' : c === 'connecting' ? 'connecting' : c)))

    socket.on('auction:stateUpdate', (data) => {
      setState(prev => {
        if (data.status === 'Live' && data.auctionId !== prev.auctionId) {
          clearTimeout(overlayTimer.current)
          setOverlay(null)
        }
        return { ...EMPTY_STATE, ...data }
      })
    })
    socket.on('auction:timer', (seconds) => setState(prev => ({ ...prev, timeLeft: seconds })))
    socket.on('auction:bidPlaced', (data) => setPulse({ teamId: data.teamId, at: Date.now() }))
    socket.on('auction:sold', (data) => showOverlay({ type: 'SOLD', ...data }))
    socket.on('auction:unsold', (data) => showOverlay({ type: 'UNSOLD', ...data }))
    socket.on('teams:update', (list) => setTeams(Array.isArray(list) ? list : []))
    socket.on('live:stats', setStats)
    socket.on('auction:notification', (msg) => notifyRef.current && notifyRef.current(msg.text, msg.type || 'info'))
    socket.on('players:changed', () => playersRef.current && playersRef.current())
    socket.on('auction:playerReset', () => playersRef.current && playersRef.current())

    return () => {
      clearTimeout(overlayTimer.current)
      socket.disconnect()
    }
  }, [])

  const emit = useCallback((event, payload) => {
    const s = socketRef.current
    if (!s || !s.connected) {
      notifyRef.current && notifyRef.current('Not connected to the auction server yet.', 'warning')
      return false
    }
    s.emit(event, payload)
    return true
  }, [])

  const dismissOverlay = useCallback(() => {
    clearTimeout(overlayTimer.current)
    setOverlay(null)
  }, [])

  return { state, teams, stats, connection, overlay, pulse, emit, dismissOverlay }
}
