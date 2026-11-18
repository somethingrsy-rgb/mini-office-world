import { useEffect, useRef, useState } from 'react'
import { asset } from '../assets'
import { CAT_DIM } from '../cats.gen'
import { FLOOR_Y, route } from '../schedule'

const WALK_SPEED = 120 // 하우스 좌표/초 (아바타보다 조금 느리게 종종걸음)
const SCALE = 0.72     // 그림 1px이 하우스 좌표에서 차지하는 크기 (고양이 키 ≈ 94)
type Pose = keyof typeof CAT_DIM
type Spot = { x: number; y: number }

/** 고양이가 쉬러 가는 자리들: 아바타와 같은 층 바닥·같은 길(계단 벽)을 따라가요. 접수대 앞(왼쪽 아래)은 피해요 */
const SPOTS: Spot[] = [
  { x: 230, y: FLOOR_Y.attic }, { x: 470, y: FLOOR_Y.attic }, { x: 640, y: FLOOR_Y.attic }, { x: 820, y: FLOOR_Y.attic },
  { x: 180, y: FLOOR_Y.f2 }, { x: 330, y: FLOOR_Y.f2 }, { x: 700, y: FLOOR_Y.f2 }, { x: 860, y: FLOOR_Y.f2 },
  { x: 430, y: FLOOR_Y.f1 }, { x: 560, y: FLOOR_Y.f1 }, { x: 760, y: FLOOR_Y.f1 }, { x: 880, y: FLOOR_Y.f1 },
]
const REST: Pose[] = ['stand', 'sit', 'sit', 'sleep', 'groom']

const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

/** 하우스 안을 돌아다니는 아기 고양이. 눌러 주면 애교를 부려요 */
export default function Cat({ id, start, offset, tint, onNear }: { id: string; start: Spot; offset: number; tint?: string; onNear?: (x: number, y: number) => void }) {
  const cur = useRef<Spot>({ ...start })
  const [st, setSt] = useState({ x: start.x, y: start.y, dur: 0, face: 'r' as 'l' | 'r', moving: false })
  const [rest, setRest] = useState<Pose>('stand')
  const [aegyoUntil, setAegyoUntil] = useState(0)
  const [aegyoPose, setAegyoPose] = useState<Pose>('aegyo1')
  const [hearts, setHearts] = useState(0)
  const [frame, setFrame] = useState(0)
  const [target, setTarget] = useState<Spot>({ ...start })
  const holdUntil = useRef(0) // 애교 중에는 새 자리로 떠나지 않아요

  // 몇 초에 한 번 새 자리와 쉬는 자세를 골라요
  useEffect(() => {
    let t = 0
    const pick = () => {
      if (Date.now() < holdUntil.current) { t = window.setTimeout(pick, 1500); return }
      const s = rnd(SPOTS.filter((p) => Math.abs(p.x - cur.current.x) > 60 || p.y !== cur.current.y))
      setTarget({ ...s }); setRest(rnd(REST))
      t = window.setTimeout(pick, 14000 + Math.random() * 16000)
    }
    t = window.setTimeout(pick, 1500 + Math.random() * 3000)
    return () => window.clearTimeout(t)
  }, [])

  // 아바타와 같은 길(route)로 걸어가요
  useEffect(() => {
    const pts = route(cur.current, target, offset)
    let i = 0, timer = 0
    const step = () => {
      if (i >= pts.length) { setSt((s) => ({ ...s, dur: 0, moving: false })); return }
      const p = pts[i++]
      const dx = p.x - cur.current.x
      const dur = Math.max(0.2, Math.hypot(dx, p.y - cur.current.y) / WALK_SPEED)
      cur.current = { x: p.x, y: p.y }
      setSt((s) => ({ x: p.x, y: p.y, dur, moving: true, face: Math.abs(dx) < 5 ? s.face : dx > 0 ? 'r' : 'l' }))
      timer = window.setTimeout(step, dur * 1000)
    }
    step()
    return () => window.clearTimeout(timer)
  }, [target.x, target.y])

  // 걷는 동안 두 걸음 그림을 번갈아 보여요
  useEffect(() => {
    if (!st.moving) return
    const t = window.setInterval(() => setFrame((f) => (f % 2 === 0 ? f + 1 : f - 1)), 260)
    return () => window.clearInterval(t)
  }, [st.moving])

  const aegyo = Date.now() < aegyoUntil
  const pose: Pose = aegyo ? aegyoPose : st.moving ? (frame % 2 ? 'walkB' : 'walkA') : rest
  // 애교 중이 끝나면 다시 그리도록
  useEffect(() => {
    if (!aegyoUntil) return
    const t = window.setTimeout(() => setFrame((f) => f + 2), Math.max(0, aegyoUntil - Date.now()) + 50)
    return () => window.clearTimeout(t)
  }, [aegyoUntil])

  const pet = (e: React.MouseEvent) => {
    e.stopPropagation()
    holdUntil.current = Date.now() + 6500
    setTarget({ x: cur.current.x, y: cur.current.y }) // 걷던 걸음을 마치고 멈춰요
    setAegyoPose((p) => (p === 'aegyo1' ? 'aegyo2' : 'aegyo1'))
    setAegyoUntil(Date.now() + 4500)
    setHearts((h) => h + 1)
    onNear?.(cur.current.x, cur.current.y)
  }

  const d = CAT_DIM[pose]
  const W = d.w * SCALE, H = d.h * SCALE
  const flip = st.face === 'l' && !aegyo && pose !== 'sleep'
  return (
    <g className="cat" style={{ transform: `translate(${st.x}px, ${st.y}px)`, transition: `transform ${st.dur}s linear` }} onClick={pet} role="button" aria-label="고양이 쓰다듬기" cursor="pointer">
      <ellipse cx="0" cy="3" rx={W * 0.36} ry="6" fill="#5b3a7a" opacity=".16" />
      <g className={st.moving ? 'catwalk' : aegyo ? 'catbounce' : ''}>
        <g transform={flip ? 'scale(-1 1)' : undefined}>
          <image href={asset(`cats/${pose}.webp`)} x={-W / 2} y={-H} width={W} height={H} style={tint ? { filter: tint } : undefined} />
        </g>
      </g>
      {aegyo && (
        <g pointerEvents="none" key={hearts}>
          {([[-26, -92, 0], [0, -108, 0.15], [26, -90, 0.3]] as [number, number, number][]).map(([dx, dy, dl], i) => (
            <image key={i} href={asset('fx/heart-m.webp')} className="spark" x={-14} y={-14} width="28" height="28"
              style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`, animationDelay: `${dl}s` }} />
          ))}
        </g>
      )}
    </g>
  )
}
