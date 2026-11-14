import { useEffect, useState } from 'react'
import { themed, type Skin } from '../assets'

type Phase = 'loading' | 'closed' | 'open' | 'gone'

const HOLD_MS = 1100 // 상자가 닫힌 채 보이는 시간
const OPEN_MS = 1300 // 상자가 열리는 시간

/** 메인 화면에 하우스가 실제로 그려지는 자리(스테이지 안에서 비율을 지키며 가운데 정렬)에 맞춘 상자 자리.
 *  화면이 나타나기 전의 변형(transform)과 상관없이 레이아웃 값으로 계산해요 */
function measureHouse(dark: boolean | Skin) {
  const th = themed(dark)
  const stage = document.querySelector('.stage') as HTMLElement | null
  const app = stage?.offsetParent as HTMLElement | null
  if (!stage || !app || stage.offsetWidth < 50 || stage.offsetHeight < 50) return null
  const HOUSE_RATIO = th.houseDim.h / th.houseDim.w // 하우스 그림 높이/너비
  const houseW = Math.min(stage.offsetWidth, stage.offsetHeight / HOUSE_RATIO)
  const r = app.getBoundingClientRect()
  const cx = r.left + stage.offsetLeft + stage.offsetWidth / 2
  const cy = r.top + stage.offsetTop + stage.offsetHeight / 2
  const width = houseW
  const height = (width * th.boxDim.h) / th.boxDim.w // 상자 그림 비율
  return { left: cx - width / 2, top: cy - height / 2, width, height }
}

/**
 * 앱을 열면 로고가 붙은 상자가 나타났다가, 걸쇠가 풀리면서 뚜껑이 위에서 앞쪽으로
 * 쏟아지듯 열리고, 뒤에서 하우스 화면이 나타나요. 상자를 누르면 바로 열려요.
 * onReveal: 상자가 열리기 시작할 때(뒤 화면을 보여 줄 때), onDone: 완전히 끝났을 때
 */
export default function Intro({ onReveal, onDone, dark = false, skin }: { onReveal: () => void; onDone: () => void; dark?: boolean; skin?: Skin }) {
  const th = themed(skin ?? dark)
  const [phase, setPhase] = useState<Phase>('loading')
  // 상자를 메인 화면의 하우스와 같은 크기·같은 자리에 맞춰요 (뚜껑이 열리면 그 자리에 하우스가 보여요)
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // 상자 그림을 미리 받아 둔 뒤 보여줘요 (너무 오래 걸리면 그냥 넘어가요)
  useEffect(() => {
    if (reduce) { onReveal(); onDone(); return }
    let on = true
    const img = new Image()
    const go = () => { if (on) { setBox(measureHouse(skin ?? dark)); setPhase((p) => (p === 'loading' ? 'closed' : p)) } }
    img.onload = go
    img.onerror = () => { if (on) { onReveal(); onDone() } }
    img.src = th.box
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

  const url = `url(${th.box})`
  return (
    <div className={`intro ${phase}`} onClick={() => phase === 'closed' && setPhase('open')} aria-hidden>
      <div className={`introbox ${th.tint.box ? 'tint-house' : ''}`} style={box ? { position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, aspectRatio: 'auto' } : undefined}>
        <div className="base" style={{ backgroundImage: url }} />
        <div className="lid" style={{ backgroundImage: url }} />
        <div className="glint" />
      </div>
    </div>
  )
}
