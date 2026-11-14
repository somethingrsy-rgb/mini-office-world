import { useEffect, useState } from 'react'
import { asset } from '../assets'

type Phase = 'loading' | 'closed' | 'open' | 'gone'

const HOLD_MS = 1100 // 상자가 닫힌 채 보이는 시간
const OPEN_MS = 1300 // 상자가 열리는 시간

/**
 * 앱을 열면 로고가 붙은 상자가 나타났다가, 가운데 걸쇠가 열리듯 양쪽으로 갈라지면서 사라지고
 * 뒤에서 하우스 화면이 나타나요. 상자를 누르면 바로 열려요.
 * onReveal: 상자가 열리기 시작할 때(뒤 화면을 보여 줄 때), onDone: 완전히 끝났을 때
 */
export default function Intro({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // 상자 그림을 미리 받아 둔 뒤 보여줘요 (너무 오래 걸리면 그냥 넘어가요)
  useEffect(() => {
    if (reduce) { onReveal(); onDone(); return }
    let on = true
    const img = new Image()
    const go = () => { if (on) setPhase((p) => (p === 'loading' ? 'closed' : p)) }
    img.onload = go
    img.onerror = () => { if (on) { onReveal(); onDone() } }
    img.src = asset('ui/box.webp')
    const t = window.setTimeout(() => { if (on && !img.complete) { onReveal(); onDone() } }, 3500)
    return () => { on = false; window.clearTimeout(t) }
  }, [])

  useEffect(() => {
    if (phase === 'closed') {
      const t = window.setTimeout(() => setPhase('open'), HOLD_MS)
      return () => window.clearTimeout(t)
    }
    if (phase === 'open') {
      onReveal()
      const t = window.setTimeout(() => { setPhase('gone'); onDone() }, OPEN_MS + 100)
      return () => window.clearTimeout(t)
    }
  }, [phase])

  if (phase === 'gone' || phase === 'loading') return null

  const url = `url(${asset('ui/box.webp')})`
  return (
    <div className={`intro ${phase}`} onClick={() => phase === 'closed' && setPhase('open')} aria-hidden>
      <div className="introbox">
        <div className="half l" style={{ backgroundImage: url }} />
        <div className="half r" style={{ backgroundImage: url }} />
        <div className="glint" />
      </div>
    </div>
  )
}
