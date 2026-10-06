import { useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Gavel, Trophy, Lock, PauseCircle, Wallet, ArrowLeft } from 'lucide-react'
import TeamMark from '../components/TeamMark'
import LiveStage from '../components/live/LiveStage'
import ToastContainer from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { useAuctionSocket } from '../hooks/useAuctionSocket'
import { useFullscreen } from '../hooks/useFullscreen'
import { useAuth } from '../contexts/AuthContext'
import { formatINR, formatShort } from '../lib/format'
import RoleSlots, { canBidForRole, roleBlockMessage, canBidForeign, foreignBlockMessage, canBidUncapped, uncappedBlockMessage } from '../components/RoleSlots'

/** Franchise owner's bid room: the broadcast plus a bid dock. The server re-validates everything. */
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
  const maxSquad = me ? me.max_squad_size : Number(user?.max_squad_size || 12)
  const isLeading = state.highestBidder && state.highestBidder.id === user?.id
  const full = squad >= maxSquad

  let block = null
  if (me && me.status === 'disabled') block = { icon: <Lock size={18} />, text: 'Your franchise is disabled' }
  else if (full) block = { icon: <Lock size={18} />, text: `Squad full — ${squad} / ${maxSquad}` }
  else if (state.player && me && !canBidForRole(me, state.player.playing_role)) block = { icon: <Lock size={18} />, text: roleBlockMessage(me, state.player.playing_role) }
  else if (!state.player || state.status === 'Completed' || state.status === 'Pending') block = { icon: <Gavel size={18} />, text: 'Waiting for the next player' }
  else if (state.status === 'Paused') block = { icon: <PauseCircle size={18} />, text: 'Auction paused' }
  else if (state.status === 'Processing') block = { icon: <Gavel size={18} />, text: 'Closing this player' }
  else if (state.timeLeft <= 0) block = { icon: <Gavel size={18} />, text: 'Time is up' }
  else if (isLeading) block = { icon: <Trophy size={18} />, text: 'You hold the highest bid', tone: 'lead' }
  else if (purse < state.nextBid) block = { icon: <Wallet size={18} />, text: `Not enough purse for ${formatINR(state.nextBid)}` }

  function placeBid() {
    if (block || !state.auctionId) return
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
      <div className="bid-dock-stat">
        <small>Purse left</small>
        <b>{formatShort(purse)}</b>
      </div>
      <div className="bid-dock-stat">
        <small>Squad</small>
        <b className={full ? 'text-danger' : ''}>{full ? 'Squad full' : `${squad} / ${maxSquad}`}</b>
      </div>
      <RoleSlots franchise={me} currentRole={state.player?.playing_role} compact={true} />
      <button className={`bid-button${block ? ' is-blocked' : ''}${block && block.tone === 'lead' ? ' is-lead' : ''}`}
        onClick={placeBid} disabled={Boolean(block)} aria-describedby="bid-hint">
        {block ? <>{block.icon}<span>{block.text}</span></> : <><Gavel size={22} /><span>Bid {formatINR(state.nextBid)}</span></>}
      </button>
      <p id="bid-hint" className="bid-dock-hint">{block ? '' : 'Press Space to bid'}</p>
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
