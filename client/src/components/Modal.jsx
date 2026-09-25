import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, title, onClose, children, width = 560, footer }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.activeElement
    ref.current && ref.current.focus()
    return () => { document.removeEventListener('keydown', onKey); prev && prev.focus && prev.focus() }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          {onClose && <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

/** Confirmation for dangerous operations (sell, unsold, delete, refunds). */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onCancel, busy }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onCancel}
      width={460}
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={`btn btn-${tone}`} onClick={onConfirm} disabled={busy} autoFocus>{busy ? 'Working…' : confirmLabel}</button>
        </>
      )}
    >
      <p className="confirm-text">{message}</p>
    </Modal>
  )
}
