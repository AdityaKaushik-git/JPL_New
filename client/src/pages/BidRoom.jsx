import { useState, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Gavel, Trophy, Lock, PauseCircle, Wallet, ArrowLeft, Ban } from 'lucide-react'
import TeamMark from '../components/TeamMark'
import LiveStage from '../components/live/LiveStage'
import ToastContainer from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { useAuctionSocket } from '../hooks/useAuctionSocket'
import { useFullscreen } from '../hooks/useFullscreen'
import { useAuth } from '../contexts/AuthContext'
import { formatINR, formatShort } from '../lib/format'
import RoleSlots, { canBidForRole, roleBlockMessage, canBidIndianRule, indianBlockMessage } from '../components/RoleSlots'

// Franchise owner's bid room: the broadcast plus a bid dock.
export default function BidRoom() {
  const { user, updateUser } = useAuth()
  const { toasts, addToast, removeToast } = useToast()
  const socket = useAuctionSocket({ onNotify: addToast })
  const stageRef = useRef(null)
  const fullscreen = useFullscreen(stageRef)
  const { state, teams, emit } = socket

  const me = useMemo(() => teams.find(t => t.id === user?.id) || null, [teams, user])

  useEffect(() => {
    if (me && user && (me.remaining_purse !== user.purse || me.squad_count !== user.squad_count)) {
      updateUser({ purse: me.remaining_purse, squad_count: me.squad_count, total_spent: me.total_spent })
    }
  }, [me, user, updateUser])

  const purse = me ? me.remaining_purse : Number(user?.purse || 0)
  const squad = me ? me.squad_count : Number(user?.squad_count || 0)
  const maxSquad = me ? me.max_squad_size : Number(user?.max_squad_size || 15)
  const isLeading = Boolean(state.highestBidder && (state.highestBidder.isYou || String(state.highestBidder.id) === String(user?.id)))
  const full = squad >= maxSquad
  const isForeign = Boolean(state.player?.country && state.player.country.trim().toLowerCase() !== 'india')
  const isUncapped = Boolean(state.player?.is_uncapped) && state.player?.country && state.player.country.trim().toLowerCase() === 'india'

  const isOptedOut = Boolean(state.isOptedOut)

  let block = null
  if (me && me.status === 'disabled') block = { icon: <Lock size={18} />, text: 'Your franchise is disabled' }
  else if (full) block = { icon: <Lock size={18} />, text: `Squad full — ${squad} / ${maxSquad}` }
  else if (state.player && me && !canBidForRole(me, state.player.playing_role)) block = { icon: <Lock size={18} />, text: roleBlockMessage(me, state.player.playing_role) }
  else if (state.player && me && !canBidIndianRule(me, isForeign, squad, maxSquad)) block = { icon: <Lock size={18} />, text: indianBlockMessage(me, isForeign, squad, maxSquad) }
  else if (!state.player || state.status === 'Completed' || state.status === 'Pending') block = { icon: <Gavel size={18} />, text: 'Waiting for the next player' }
  else if (state.status === 'Paused') block = { icon: <PauseCircle size={18} />, text: 'Auction paused' }
  else if (state.status === 'Processing') block = { icon: <Gavel size={18} />, text: 'Closing this player' }
  else if (state.timeLeft <= 0) block = { icon: <Gavel size={18} />, text: 'Time is up' }
  else if (isLeading) block = { icon: <Trophy size={18} />, text: 'You hold the highest bid', tone: 'lead' }
  else if (purse < state.nextBid) block = { icon: <Wallet size={18} />, text: `Not enough purse for ${formatINR(state.nextBid)}` }
  else if (isOptedOut) block = { icon: <Ban size={18} />, text: 'Not Interested' }

  function placeBid() {
    if (block || isOptedOut || !state.auctionId) return
    emit('user:placeBid', { auctionId: state.auctionId, amount: state.nextBid })
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); placeBid() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const dock = (
    <div className={`bid-dock${full ? ' is-full' : ''}`}>
      <div className="bid-dock-info">
        <div className="bid-dock-stat purse-stat">
          <div className="dock-stat-head">
            <Wallet size={13} className="dock-stat-icon" />
            <small>Purse Available</small>
          </div>
          <b>{formatShort(purse)}</b>
        </div>
        <div className="bid-dock-stat squad-stat">
          <div className="dock-stat-head">
            <Trophy size={13} className="dock-stat-icon" />
            <small>Squad Capacity</small>
          </div>
          <b className={full ? 'text-danger' : ''}>{full ? 'Squad Full' : `${squad} / ${maxSquad}`}</b>
        </div>
        <div className="dock-slots-container">
          <RoleSlots franchise={me} currentRole={state.player?.playing_role} compact={true} />
        </div>
      </div>

      <div className="bid-dock-controls">
        <button 
          className={`not-interested-btn${isOptedOut ? ' is-opted' : ''}`}
          onClick={() => emit('user:optOut')}
          disabled={isOptedOut || !state.player || state.status !== 'Live'}
          title={isOptedOut ? 'You opted out of this lot' : 'Pass on this lot'}
        >
          <Ban size={16} />
          <span>{isOptedOut ? 'Opted Out' : 'Pass / Opt Out'}</span>
        </button>

        <div className="bid-btn-wrapper">
          <button 
            className={`bid-button${block ? ' is-blocked' : ''}${block && block.tone === 'lead' ? ' is-lead' : ''}`}
            onClick={placeBid} 
            disabled={Boolean(block)} 
            aria-describedby="bid-hint"
          >
            {block ? (
              <>
                {block.icon}
                <span>{block.text}</span>
              </>
            ) : (
              <>
                <Gavel size={22} className="bid-gavel-glyph" />
                <span className="bid-text">Bid {formatINR(state.nextBid)}</span>
                <span className="bid-shortcut-badge">SPACE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <LiveStage ref={stageRef} socket={socket} fullscreen={fullscreen} dock={dock}
        leading={(
          <span className="stage-leading">
            <Link to="/dashboard" className="icon-btn" aria-label="Back to dashboard"><ArrowLeft size={18} /></Link>
            {me && <TeamMark team={me} size={34} />}
            <b>{me ? me.team_name : user?.team_name}</b>
          </span>
        )} />
    </>
  )
}
