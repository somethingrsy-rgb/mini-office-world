import { useEffect, type ReactNode } from 'react'

export default function Sheet({ title, onClose, glass, tall, children }: { title: string; onClose: () => void; glass?: boolean; tall?: boolean; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={`backdrop ${glass ? 'glass' : ''}`} onClick={onClose}>
      <div className={`sheet ${glass ? 'glass' : ''} ${tall ? 'tall' : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {glass && <div className="grab" aria-hidden />}
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
