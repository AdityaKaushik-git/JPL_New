import { useEffect, useRef } from 'react'
import LiveStage from '../components/live/LiveStage'
import { useAuctionSocket } from '../hooks/useAuctionSocket'
import { useFullscreen } from '../hooks/useFullscreen'

// Public spectator / projector screen.
export default function Live() {
  const socket = useAuctionSocket()
  const stageRef = useRef(null)
  const fullscreen = useFullscreen(stageRef)

  useEffect(() => {
    document.body.classList.add('is-broadcast')
    return () => document.body.classList.remove('is-broadcast')
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'f' || e.key === 'F') fullscreen.toggle() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  return <LiveStage ref={stageRef} socket={socket} fullscreen={fullscreen} />
}
