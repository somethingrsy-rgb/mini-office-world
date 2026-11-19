import { useEffect, useRef, useState } from 'react'
import { asset } from '../assets'
import { CAT_COUNT, CAT_DIM } from '../cats.gen'
import { FLOOR_Y, route } from '../schedule'

const WALK_SPEED = 48 // 하우스 좌표/초: 우아하게 천천히 (걸음 그림 속도에 맞춰요)
export const CAT_SCALE = 0.84
const SCALE = CAT_SCALE     // 그림 1px이 하우스 좌표에서 차지하는 크기 (1.2배)
/** 그림 묶음 (tools/process_cats.py 가 만든 12프레임씩): 걷기(오른쪽·왼쪽), 위층으로 뛰기, 아래층으로 뛰기 */
const seq = (g: string) => Array.from({ length: CAT_COUNT[g] }, (_, i) => `${g}${i}`)
const makeFrames = (pre: string) => {
  const q = (g: string) => seq(pre + g)
  return {
    stand: [pre === 'wh_' ? 'wh_stand0' : `${pre}up0`],   // 서 있기 (크리스탈은 걷기 그림에서 뽑은 서 있는 모습)
    sit: [`${pre}sit0`],
    sleep: [`${pre}sleep0`],
    groom: [`${pre}groom0`],
    aegyo: [`${pre}aegyo0`],   // 쓰다듬으면 배를 보이며 구르는 애교
    walk: q('walkR'),
    walkL: q('walkL'),
    jumpUp: q('up'),
    jumpDown: q('down'),
    pounce: q('pounce'),       // 손가락·마우스 커서를 잡으려는 동작
  }
}
// 고양이 종류: '' = 루비(시암 고양이), 'wh_' = 흰 고양이 (그림 이름 앞에 wh_ 가 붙어요)
const FRAME_SETS: Record<string, ReturnType<typeof makeFrames>> = { '': makeFrames(''), wh_: makeFrames('wh_') }
const FRAMES = FRAME_SETS['']
type Pose = keyof typeof FRAMES
type Spot = { x: number; y: number }

/** 고양이가 쉬러 가는 자리들: 아바타와 같은 층 바닥·같은 길(계단 벽)을 따라가요. 접수대 앞(왼쪽 아래)은 피해요 */
const SPOTS: Spot[] = [
  { x: 230, y: FLOOR_Y.attic }, { x: 470, y: FLOOR_Y.attic }, { x: 640, y: FLOOR_Y.attic }, { x: 820, y: FLOOR_Y.attic },
  { x: 180, y: FLOOR_Y.f2 }, { x: 330, y: FLOOR_Y.f2 }, { x: 700, y: FLOOR_Y.f2 }, { x: 860, y: FLOOR_Y.f2 },
  { x: 120, y: 1046 }, { x: 255, y: 1052 }, // 접수대(주인인 소영이 있는 곳) 앞
  { x: 430, y: FLOOR_Y.f1 }, { x: 560, y: FLOOR_Y.f1 }, { x: 760, y: FLOOR_Y.f1 }, { x: 880, y: FLOOR_Y.f1 },
]
/** 바닥 양 끝(벽 쪽)에는 가지 않아요: 길이 끝났는데 계속 걷는 것처럼 보이지 않게 안쪽 자리만 써요 */
const INSET = (list: Spot[]): Spot[] => list.map((p) => ({ ...p, x: Math.min(Math.max(p.x, 150), 820) }))
const REST: Pose[] = ['stand', 'sit', 'sit', 'sleep', 'groom']

const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

/** 하우스 안을 돌아다니는 아기 고양이. 눌러 주면 애교를 부려요 */
export default function Cat({ id, start, offset, tint, onNear, avoid, pointer, call, pre = '', name = '루비', side = 75, report, frozen = false, ov = null, want, place }: { id: string; /** 다른 고양이와 장난치는 장면 중이면 숨기고 가만히 있어요 */ frozen?: boolean; /** 장난치는 중이면 이 자리·그림으로 그려요 */ ov?: { x: number; y: number; key: string; flip: boolean } | null; /** 다른 고양이를 만날 때가 됐으면 그 고양이가 있는 층의 y (아니면 null) */ want?: () => number | null; /** 이 자리에 바로 놓아요 (장난이 끝난 뒤) */ place?: { x: number; y: number; n: number } | null; /** 그림 묶음 앞 이름 ('' 루비 / 'wh_' 흰 고양이) */ pre?: string; name?: string; /** 두 번 톡 눌러 불렀을 때 누른 자리에서 떨어져 앉는 거리 */ side?: number; /** 지금 자리를 알려줘요 (다른 고양이가 피할 수 있게) */ report?: (id: string, s: { x: number; y: number; free: boolean; dir: number }) => void; start: Spot; offset: number; tint?: string; onNear?: (x: number, y: number) => void; /** 지금 아바타들이 서 있는(가는) 자리들: 고양이가 이 자리와 겹치지 않게 피해요 */ avoid?: () => Spot[]; /** 지금 마우스·손가락이 있는 하우스 좌표 (없으면 null) */ pointer?: () => Spot | null; /** 바닥을 두 번 톡 눌러 부른 자리 (n이 바뀔 때마다 새로 불러요) */ call?: { x: number; y: number; n: number } | null }) {
  const FR = FRAME_SETS[pre] ?? FRAMES
  const frozenRef = useRef(frozen)
  frozenRef.current = frozen
  const idleRef = useRef(true)
  const cur = useRef<Spot>({ ...start })
  const seg = useRef({ x0: start.x, y0: start.y, x1: start.x, y1: start.y, t0: 0, dur: 0 })   // 지금 걸음의 시작·끝·시각 (지금 화면에 보이는 자리를 알아내려고)
  const nowPos = () => { const g = seg.current, p = g.dur > 0 ? Math.min(1, (Date.now() - g.t0) / (g.dur * 1000)) : 1; return { x: g.x0 + (g.x1 - g.x0) * p, y: g.y1 } }
  const [st, setSt] = useState({ x: start.x, y: start.y, dur: 0, face: 'r' as 'l' | 'r', moving: false, jump: false, leg: 0, up: false })
  const [variant, setVariant] = useState(0) // 쉴 때 보여 줄 그림 번호 (쉬는 동안은 그림을 바꾸지 않아요)
  const [rest, setRest] = useState<Pose>('stand')
  const [aegyoUntil, setAegyoUntil] = useState(0)
  const [hearts, setHearts] = useState(0)
  const [frame, setFrame] = useState(0) // 걷기는 8장을 차례로, 쉴 때는 몇 초마다 한 번씩 그림을 바꿔요
  const [target, setTarget] = useState<Spot>({ ...start })
  const aegyoStart = useRef(0)
  const targetRef = useRef<Spot>({ ...start })
  const callActive = useRef(false) // 부름을 받고 걸어오는 중에는 다른 자리를 고르지 않아요
  const moveEnd = useRef(0) // 지금 걸음이 끝나야 하는 시각 (이 시각이 지났는데도 걷는 모습이면 멈춰 세워요)
  const [pounceUntil, setPounceUntil] = useState(0)
  const [pounceDir, setPounceDir] = useState<'l' | 'r'>('r')
  const pounceCool = useRef(0)
  const holdUntil = useRef(0) // 애교 중에는 새 자리로 떠나지 않아요

  const crowded = (p: Spot) => (avoid?.() ?? []).some((q) => Math.abs(q.y - p.y) < 45 && Math.abs(q.x - p.x) < 120)
  // 몇 초에 한 번 새 자리와 쉬는 자세를 골라요 (아바타가 서 있는 자리는 피해요)
  const pickNew = () => {
    const floorOf = (y: number) => (y < 550 ? 0 : y < 850 ? 1 : 2)
    const free = INSET(SPOTS).filter((p) => (Math.abs(p.x - cur.current.x) > 60 || p.y !== cur.current.y) && !crowded(p))
    // 층은 되도록 옮기지 않아요: 같은 층의 자리를 먼저 고르고, 층을 바꾸는 건 아주 가끔(10%)만 해요
    const wy = want?.()
    const wantFloor = wy == null ? null : floorOf(wy)
    const same = free.filter((p) => floorOf(p.y) === floorOf(cur.current.y))
    const other = free.filter((p) => floorOf(p.y) !== floorOf(cur.current.y))
    const toward = wantFloor != null && floorOf(cur.current.y) !== wantFloor && Math.random() < 0.35 ? other.filter((p) => floorOf(p.y) === wantFloor) : []
    const ok = toward.length > 0 ? toward : same.length > 0 && !(other.length > 0 && Math.random() < 0.1) ? same : other.length > 0 ? other : same
    if (ok.length === 0) return false
    const nt = { ...rnd(ok) }
    targetRef.current = nt; setTarget(nt); setRest(rnd(REST)); setVariant(Math.floor(Math.random() * 3))
    return true
  }
  const REST_MS = 10000 // 도착해서 쉬는 시간
  const pickRef = useRef(pickNew)
  pickRef.current = pickNew
  const nextTimer = useRef(0)
  // 도착하면 10초 쉬고 다음 자리를 골라요 (애교 중이면 끝난 뒤에)
  const scheduleNext = (ms: number) => {
    window.clearTimeout(nextTimer.current)
    nextTimer.current = window.setTimeout(() => {
      if (Date.now() < holdUntil.current || frozenRef.current) return scheduleNext(1500)
      if (!pickRef.current()) scheduleNext(3000)
    }, ms)
  }
  useEffect(() => {
    scheduleNext(1500 + Math.random() * 2000)
    // 아바타가 고양이 쪽으로 와서 겹치면 비켜 줘요 (애교 중에는 그대로)
    const watch = window.setInterval(() => {
      if (Date.now() < holdUntil.current || callActive.current || frozenRef.current) return
      if (crowded(cur.current) || crowded(targetRef.current)) pickRef.current()
    }, 2000)
    return () => { window.clearTimeout(nextTimer.current); window.clearInterval(watch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 바닥을 두 번 톡 누르면 그쪽으로 걸어와 옆에 앉아요
  useEffect(() => {
    if (!call) return
    const floorY = call.y < 550 ? FLOOR_Y.attic : call.y < 850 ? FLOOR_Y.f2 : FLOOR_Y.f1
    const sideX = call.x > 500 ? call.x - side : call.x + side           // 누른 자리 바로 옆
    const nt = { x: Math.min(Math.max(sideX, 140), 840), y: floorY }
    window.clearTimeout(nextTimer.current)
    callActive.current = true
    holdUntil.current = 0
    targetRef.current = nt; setTarget(nt); setRest('sit'); setVariant(0)
    setSt((q) => ({ ...q, face: nt.x < cur.current.x ? 'l' : 'r' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.n])

  // 지금 자리를 다른 고양이에게 알려 줘요 (서로 겹치지 않게)
  useEffect(() => {
    const t = window.setInterval(() => report?.(id, { ...nowPos(), free: idleRef.current, dir: stMoving.current ? Math.sign(cur.current.x - seg.current.x0) : 0 }), 500)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 장난이 끝난 뒤 그 자리에 놓여요
  useEffect(() => {
    if (!place) return
    window.clearTimeout(nextTimer.current)
    callActive.current = false
    cur.current = { x: place.x, y: place.y }
    seg.current = { x0: place.x, y0: place.y, x1: place.x, y1: place.y, t0: 0, dur: 0 }
    targetRef.current = { x: place.x, y: place.y }
    setSt((q) => ({ ...q, x: place.x, y: place.y, dur: 0, moving: false, jump: false }))
    setTarget({ x: place.x, y: place.y })
    setRest(rnd(['sit', 'stand']))
    scheduleNext(REST_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.n])

  // 장난이 시작되면 걷던 길을 멈춰요 (걷다가 층이 바뀌어 혼자 다른 층에서 장난치는 일이 없게)
  useEffect(() => {
    if (!frozen) return
    window.clearTimeout(nextTimer.current)
    callActive.current = false
    const np = nowPos()
    cur.current = np; seg.current = { x0: np.x, y0: np.y, x1: np.x, y1: np.y, t0: 0, dur: 0 }
    targetRef.current = { ...np }
    setTarget({ ...np })
    setSt((q) => ({ ...q, x: np.x, y: np.y, dur: 0, moving: false, jump: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen])

  // 안전장치: 걸음이 끝났는데도 걷는 모습이 남아 있으면 멈추고 쉬어요
  const stMoving = useRef(false)
  stMoving.current = st.moving
  useEffect(() => {
    const t = window.setInterval(() => {
      if (stMoving.current && Date.now() > moveEnd.current + 600) { setSt((s) => ({ ...s, dur: 0, moving: false, jump: false })); scheduleNext(REST_MS) }
    }, 400)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 아바타와 같은 길(route)로 걸어가요
  useEffect(() => {
    const pts = route(cur.current, target, offset)
    let i = 0, timer = 0
    const step = () => {
      if (i >= pts.length) { setSt((s) => ({ ...s, dur: 0, moving: false, jump: false })); scheduleNext(callActive.current ? 25000 : REST_MS); callActive.current = false; return }
      const p = pts[i++]
      const dx = p.x - cur.current.x, dy = p.y - cur.current.y
      // 층과 층 사이(계단 쪽 벽을 오르내리는 길)는 걷지 않고 폴짝 뛰어요
      const jump = Math.abs(dx) < 6 && Math.abs(dy) > 40
      const dur = jump ? 1.5 : Math.max(0.2, Math.hypot(dx, dy) / WALK_SPEED)
      seg.current = { x0: cur.current.x, y0: cur.current.y, x1: p.x, y1: p.y, t0: Date.now(), dur }
      cur.current = { x: p.x, y: p.y }
      moveEnd.current = Date.now() + dur * 1000
      setSt((s) => ({ x: p.x, y: p.y, dur, moving: true, jump, up: dy < 0, leg: s.leg + 1, face: Math.abs(dx) < 5 ? s.face : dx > 0 ? 'r' : 'l' }))
      timer = window.setTimeout(step, dur * 1000)
    }
    step()
    return () => window.clearTimeout(timer)
  }, [target.x, target.y])

  // 마우스·손가락이 가까이 오면 눈으로 쫓다가 앞발로 잡으려 해요 (뛰는 중·애교 중에는 안 해요)
  const jumpingRef = useRef(false)
  jumpingRef.current = st.jump
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now()
      const q = pointer?.()
      if (!q || frozenRef.current || jumpingRef.current || now < pounceCool.current || now < holdUntil.current) return
      const cy = cur.current.y + 30 // 그림이 놓이는 높이(발 기준)에 맞춘 하우스 좌표
      if (Math.abs(q.x - cur.current.x) < 190 && q.y > cy - 150 && q.y < cy + 40) {
        const dur = 1400
        pounceCool.current = now + dur + 6000
        holdUntil.current = now + dur
        targetRef.current = { x: cur.current.x, y: cur.current.y }
        setTarget({ x: cur.current.x, y: cur.current.y }) // 걷던 걸음을 멈춰요
        setPounceDir(q.x < cur.current.x ? 'l' : 'r')
        setPounceUntil(now + dur)
      }
    }, 150)
    return () => window.clearInterval(t)
  }, [])
  const pouncing = Date.now() < pounceUntil
  useEffect(() => {
    if (!pounceUntil) return
    const t = window.setTimeout(() => setFrame((f) => f + 1), Math.max(0, pounceUntil - Date.now()) + 60)
    return () => window.clearTimeout(t)
  }, [pounceUntil])
  const aegyo = Date.now() < aegyoUntil
  const pose: Pose = pouncing && !aegyo ? 'pounce' : aegyo ? 'aegyo' : st.moving ? (st.jump ? (st.up ? 'jumpUp' : 'jumpDown') : st.face === 'l' ? 'walkL' : 'walk') : rest
  // 그림 바꾸는 속도: 걸을 때는 빠르게(한 걸음씩), 애교는 1.4초, 쉴 때는 천천히(눈 깜빡임·숨쉬기처럼)
  useEffect(() => {
    // 움직이는 동안(걷기·뛰기·애교)만 그림을 바꿔요. 멈춰서 쉬는 모습은 그림 하나로 가만히 있어요
    const ms = pose === 'walk' || pose === 'walkL' ? 150 : pose === 'jumpUp' || pose === 'jumpDown' ? 120 : pose === 'pounce' ? 110 : 0  // 걷기 12장·뛰기 12장을 한 번씩 (뛰기는 1.5초에 맞춰요)
    if (!ms) return
    const t = window.setInterval(() => setFrame((f) => f + 1), ms)
    return () => window.clearInterval(t)
  }, [pose])
  // 애교가 끝나는 때 다시 그리도록
  useEffect(() => {
    if (!aegyoUntil) return
    const t = window.setTimeout(() => setFrame((f) => f + 1), Math.max(0, aegyoUntil - Date.now()) + 60)
    return () => window.clearTimeout(t)
  }, [aegyoUntil])
  useEffect(() => { setFrame(0) }, [pose, st.leg])
  idleRef.current = !st.jump && !aegyo && !pouncing && !callActive.current && !frozen
  const list = FR[pose]
  const key = pose === 'jumpUp' || pose === 'jumpDown' || pose === 'pounce' ? list[Math.min(frame, list.length - 1)] : list.length > 1 ? list[frame % list.length] : list[0]

  const pet = (e: React.MouseEvent) => {
    e.stopPropagation()
    holdUntil.current = Date.now() + 6500
    aegyoStart.current = Math.floor(Math.random() * 3)
    targetRef.current = { x: cur.current.x, y: cur.current.y }
    setTarget({ x: cur.current.x, y: cur.current.y }) // 걷던 걸음을 마치고 멈춰요
    setAegyoUntil(Date.now() + 4500)
    setHearts((h) => h + 1)
    onNear?.(cur.current.x, cur.current.y)
  }

  const shownKey = ov ? ov.key : key
  const d = CAT_DIM[shownKey]
  const W = d.w * SCALE, H = d.h * SCALE
  const flip = ov ? ov.flip : (pose === 'pounce' ? pounceDir === 'l' : st.face === 'l') && pose !== 'walk' && pose !== 'walkL' // 왼쪽 걷기는 전용 그림이 있어서 뒤집지 않아요
  return (
    <g className="cat" style={{ transform: `translate(${ov ? ov.x : st.x}px, ${ov ? ov.y : st.y}px)`, transition: ov ? 'none' : `transform ${st.dur}s linear`, pointerEvents: frozen ? 'none' : undefined }} onClick={pet} role="button" aria-label={`${name}(고양이) 쓰다듬기`} cursor="pointer">
      <ellipse cx="0" cy="3" rx={W * 0.36} ry="6" fill="#5b3a7a" opacity=".16" />
      <g key={st.jump ? st.leg : aegyo ? 'a' + hearts : 'x'} style={st.jump ? { animation: `catarc ${st.dur}s ease-in-out` } : undefined}>
        <g transform={flip ? 'scale(-1 1)' : undefined}>
          <image href={asset(`cats/${shownKey}.webp`)} x={-W / 2} y={-H} width={W} height={H} style={tint ? { filter: tint } : undefined} />
        </g>
      </g>
      {aegyo && (
        <g pointerEvents="none" className="tasktag">
          <rect x="-50" y={-H - 52} width="100" height="40" rx="20" fill="#fff" fillOpacity=".96" stroke="#ff86b6" strokeWidth="4" />
          <text x="0" y={-H - 24} textAnchor="middle" fontSize="26" fontWeight="800" fill="#5b4a78">{name}</text>
        </g>
      )}
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
