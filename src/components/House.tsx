import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import Cat, { CAT_SCALE } from './Cat'
import { CAT_DIM } from '../cats.gen'
import { asset } from '../assets'
import { AVATARS, type AvatarId } from '../avatars'
import { COUNTER_IMG, themed } from '../assets'
import { COUNTER, COUNTER_DARK_DROP, ROOMS, type RoomId } from '../rooms'
import type { Activity } from '../schedule'
import type { Staff } from '../types'
import type { Skin } from '../settings'

interface Props {
  activities: Record<AvatarId, Activity>
  alerts: Partial<Record<Staff, 'soon' | 'urgent' | null>>
  cheers: Record<string, number>
  /** 화면에 나올 직원 아바타 (일을 받은 아바타만) */
  shown: AvatarId[]
  /** 라운지에서 나누는 대화 */
  speech: Partial<Record<AvatarId, string>>
  labels: Partial<Record<Staff, { text: string; more: number; worked?: string | null } | null>>
  /** 지금 남아 있는(끝나지 않은) 일 개수 */
  remaining: number
  dark?: boolean
  /** 라이트 모드 하우스 그림 (기본·나무·바다) */
  skin?: Skin
  /** 바닥 맞춤 안내선 보기 (설정에서 켜요) */
  guide?: boolean
  /** 확대할 때 하우스 그림 크기 (핀치 확대) */
  houseStyle?: React.CSSProperties
  /** 돌아다니는 아기 고양이 보이기 */
  cats?: { ruby: boolean; crystal: boolean }
  /** 접수대에서 일을 받기 시작한 아바타 */
  onReceived?: (id: AvatarId) => void
  selected: AvatarId | null
  onSelect: (id: AvatarId) => void
  onRoom: (id: RoomId) => void
  /** 아바타를 고른 상태에서 하우스 바닥을 누르면 그 자리(하우스 좌표)로 보내요 */
  onMove?: (x: number, y: number) => void
  onManualArrived?: (id: AvatarId) => void
}

/** 글자 수에 맞춘 말풍선 폭 (한글은 넓게, 영문·숫자는 좁게) */
const tw = (t: string, size: number) => [...t].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? size : size * 0.58), 0)

type SceneKind = 'pairA' | 'pairB' | 'pairC' | 'pairD'
interface Scene { n: number; kind: SceneKind; x: number; y: number; flip: boolean; t0: number; dur: number }
/** 장면마다 한 장을 보여 주는 시간(ms)과 반복 횟수: 앉아서 비비기는 천천히 한 번, 뛰며 장난은 빠르게 두 번 */
const SCENES: Record<SceneKind, { ms: number; loops: number; weight: number }> = {
  pairA: { ms: 480, loops: 1, weight: 15 }, pairB: { ms: 480, loops: 1, weight: 15 },
  pairC: { ms: 330, loops: 2, weight: 35 }, pairD: { ms: 330, loops: 2, weight: 35 },
}
/** 두 고양이가 만나서 장난치는 장면 (한 장에 두 마리가 그려져 있어요) */
function PairScene({ scene }: { scene: Scene }) {
  const [, setTick] = useState(0)
  useEffect(() => { const t = window.setInterval(() => setTick((v) => v + 1), 60); return () => window.clearInterval(t) }, [])
  const info = SCENES[scene.kind]
  const idx = Math.min(11, Math.floor(((Date.now() - scene.t0) / info.ms) % 12))
  const d = CAT_DIM[`${scene.kind}0`]
  const k = scene.kind === 'pairA' || scene.kind === 'pairB' ? 0.86 : 0.78   // 걸어 다닐 때 고양이와 같은 크기로 보이게
  const W = d.w * CAT_SCALE * k, H = d.h * CAT_SCALE * k
  return (
    <g pointerEvents="none" transform={`translate(${scene.x} ${scene.y})`}>
      <g transform={scene.flip ? 'scale(-1 1)' : undefined}>
        <image href={asset(`cats/${scene.kind}${idx}.webp`)} x={-W / 2} y={-H} width={W} height={H} />
      </g>
    </g>
  )
}

/** 안내선 '아래 N'만큼 발을 내려요: 고양이 루비는 30, 아바타·접수대는 10 */
const CAT_DROP = 30
const FOOT_DROP = 10

export default function House({ activities, alerts, cheers, labels, shown, speech, remaining, selected, onSelect, onRoom, onMove, onManualArrived, dark = false, skin = 'default', guide = false, houseStyle, cats = { ruby: false, crystal: false }, onReceived }: Props) {
  const th = themed(dark, skin)
  const svgRef = useRef<SVGSVGElement>(null)
  // 빈 바닥을 두 번 톡 누르면 고양이가 그쪽으로 와서 옆에 앉아요
  const [callSpot, setCallSpot] = useState<{ x: number; y: number; n: number } | null>(null)
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null)
  const tapForCat = (e: React.MouseEvent) => {
    if (onMove || (e.target as Element).closest('g.avatar, g.cat')) return   // 아바타를 고른 상태나 아바타·고양이를 누른 건 제외
    const q = toHouse(e)
    if (!q) return
    const now = Date.now(), p = lastTap.current
    if (p && now - p.t < 450 && Math.hypot(p.x - q.x, p.y - q.y) < 70) { lastTap.current = null; setCallSpot((c) => ({ x: q.x, y: q.y - catDrop, n: (c?.n ?? 0) + 1 })) }
    else lastTap.current = { x: q.x, y: q.y, t: now }
  }
  // 마우스·손가락이 하우스 위 어디에 있는지 (고양이가 잡으려고 해요)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  // 하우스 그림(나무·바다·웨딩·놀이동산)에서는 아바타·고양이·접수대를 바닥 쪽으로 30 내려요 (안내선 '아래 30')
  const drop = skin !== 'default' ? FOOT_DROP : 0
  const catDrop = skin !== 'default' ? CAT_DROP : 0
  // 고양이가 아바타와 겹치지 않도록 지금 아바타들이 있는(가는) 자리를 알려줘요
  const actRef = useRef(activities)
  actRef.current = activities
  const shownRef = useRef(shown)
  shownRef.current = shown
  // 두 고양이가 가까이 있으면 만나서 장난쳐요 (가끔 크리스탈이 루비를 만나러 가요)
  const [scene, setScene] = useState<Scene | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  sceneRef.current = scene
  const [placeRuby, setPlaceRuby] = useState<{ x: number; y: number; n: number } | null>(null)
  const [placeCrystal, setPlaceCrystal] = useState<{ x: number; y: number; n: number } | null>(null)
  const [visit, setVisit] = useState<{ x: number; y: number; n: number } | null>(null)
  const lastScene = useRef(Date.now() - 30000)
  const lastVisit = useRef(Date.now())
  const sceneN = useRef(0)
  const bothCats = cats.ruby && cats.crystal
  useEffect(() => {
    if (!bothCats) { setScene(null); return }
    const t = window.setInterval(() => {
      const now = Date.now()
      const a = catPos.current['cat1'] as { x: number; y: number; idle?: boolean } | undefined   // 루비
      const b = catPos.current['cat2'] as { x: number; y: number; idle?: boolean } | undefined   // 크리스탈(흰 고양이)
      if (!a || !b) return
      const cur = sceneRef.current
      if (cur) {
        if (now >= cur.t0 + cur.dur) {   // 끝나면 두 마리를 장면 속 자리에 놓고 다시 돌아다녀요
          const gap = 75
          const wx = cur.flip ? cur.x + gap : cur.x - gap, rx = cur.flip ? cur.x - gap : cur.x + gap
          setPlaceRuby({ x: rx, y: cur.y, n: ++sceneN.current }); setPlaceCrystal({ x: wx, y: cur.y, n: ++sceneN.current })
          lastScene.current = now; setScene(null)
        }
        return
      }
      if (!a.idle || !b.idle) return
      const sameFloor = Math.abs(a.y - b.y) < 40
      if (sameFloor && Math.abs(a.x - b.x) < 360 && now - lastScene.current > 15000) {
        const kinds = Object.keys(SCENES) as SceneKind[]
        let r = Math.random() * kinds.reduce((v, k) => v + SCENES[k].weight, 0), kind = kinds[0]
        for (const k of kinds) { r -= SCENES[k].weight; if (r <= 0) { kind = k; break } }
        const info = SCENES[kind]
        const x = Math.min(Math.max((a.x + b.x) / 2, 190), 800)
        setScene({ n: ++sceneN.current, kind, x, y: (a.y + b.y) / 2, flip: b.x > a.x, t0: now, dur: info.ms * 12 * info.loops })
      } else if (now - lastScene.current > 25000 && now - lastVisit.current > 12000 && !(sameFloor && Math.abs(a.x - b.x) < 360)) {
        lastVisit.current = now   // 오래 못 만났으면 크리스탈이 루비 옆으로 가요
        setVisit({ x: a.x + (a.x > 480 ? -110 : 110), y: a.y, n: ++sceneN.current })
      }
    }, 1000)
    return () => window.clearInterval(t)
  }, [bothCats])
  // 두 고양이의 자리를 서로에게 알려요
  const catPos = useRef<Record<string, { x: number; y: number; idle?: boolean }>>({})
  const reportCat = (id: string, p: { x: number; y: number; idle: boolean }) => { catPos.current[id] = p }
  const avoidFor = (id: string) => () => [...avatarSpots(), ...Object.entries(catPos.current).filter(([k]) => k !== id).map(([, v]) => v)]
  const avatarSpots = () => AVATARS.filter((a) => a.id === 'user' || shownRef.current.includes(a.id)).map((a) => actRef.current[a.id].spot)
  /** 화면 좌표 → 하우스 좌표 */
  const toHouse = (e: React.MouseEvent) => {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!svg || !m) return null
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
    const q = pt.matrixTransform(m.inverse())
    return { x: q.x, y: q.y }
  }
  return (
    <svg ref={svgRef} style={houseStyle} onClick={tapForCat} onPointerMove={(e) => { const q = toHouse(e as unknown as React.MouseEvent); pointerRef.current = q }} onPointerLeave={() => { pointerRef.current = null }} onPointerCancel={() => { pointerRef.current = null }} onPointerUp={(e) => { if (e.pointerType !== 'mouse') pointerRef.current = null }} viewBox={`0 0 ${th.houseDim.w} ${th.houseDim.h}`} className="house" role="img" aria-label="미니어처 오피스 하우스">
      <image className={`houseimg ${dark && skin !== 'default' ? `nightskin ${skin}` : ''}`} href={th.house} width={th.houseDim.w} height={th.houseDim.h} />
      {guide && (
        <g pointerEvents="none" fontSize="19" fontWeight="800">
          {[408, 690, 1002].map((y0) => (
            <g key={y0}>
              {Array.from({ length: 13 }, (_, i) => i - 6).map((k) => (
                <g key={k}>
                  <line x1="0" x2="1000" y1={y0 + k * 10} y2={y0 + k * 10} stroke={k === 0 ? '#ff2d55' : k < 0 ? '#2d7dff' : '#16a34a'} strokeWidth={k === 0 ? 3 : 1.2} strokeOpacity={k === 0 ? 0.95 : 0.7} />
                  {(k % 2 === 0) && <text x="6" y={y0 + k * 10 - 3} fill={k === 0 ? '#ff2d55' : k < 0 ? '#2d7dff' : '#16a34a'} stroke="#fff" strokeWidth="3" paintOrder="stroke">{k === 0 ? '아바타 발' : k < 0 ? `위 ${-k * 10}` : `아래 ${k * 10}`}</text>}
                </g>
              ))}
            </g>
          ))}
        </g>
      )}
      {/* 방을 누르면 확대해서 볼 수 있게 하는 투명 영역 */}
      {ROOMS.map((r) => (
        <rect key={r.id} className="hot" x={r.rect.x} y={r.rect.y} width={r.rect.w} height={r.rect.h} fill="#fff" fillOpacity="0"
          onClick={(e) => { if (onMove) { const q = toHouse(e); if (q) return onMove(q.x, q.y) } onRoom(r.id) }} role="button" aria-label={`${r.name} 확대`} />
      ))}
      {/* 나(관리자)는 접수대 안쪽에 서 있고, 카운터 그림이 앞에 놓여요. 일을 받으러 온 아바타는 카운터 앞에 서야 하므로 그 뒤에 그려요 */}
      {/* 다크 하우스는 접수실 나무 바닥이 조금 더 아래에서 시작해서, 카운터와 나를 그만큼 내려요 */}
      <g transform={`translate(0 ${(dark ? COUNTER_DARK_DROP : 0) + drop})`}>
      {AVATARS.filter((a) => a.id === 'user').map((info) => (
        <Avatar key={info.id} info={info} activity={activities[info.id]} cheer={cheers[info.id]} speech={speech[info.id]} hideName onManualArrived={onManualArrived}
          delay={1.2} selected={selected === info.id} onSelect={onSelect} />
      ))}
      <image href={th.counter} x={COUNTER.x} y={COUNTER.bottom - COUNTER_IMG.h * COUNTER.w / COUNTER_IMG.w}
        width={COUNTER.w} height={COUNTER_IMG.h * COUNTER.w / COUNTER_IMG.w} pointerEvents="none" />
      {/* 카운터 앞 이름판: 남은 일 개수를 보여 줘요 (일을 끝내면 줄어들고, 0이면 모두 대기) */}
      <g pointerEvents="none">
        <rect x={COUNTER.bodyCenterX - 64} y={COUNTER.bottom - 62} width="128" height="42" rx="21" fill="#fff" fillOpacity=".95" stroke={remaining > 0 ? '#ff86b6' : '#7fd6c2'} strokeWidth="3.5" />
        <text x={COUNTER.bodyCenterX} y={COUNTER.bottom - 33} textAnchor="middle" fontSize="25" fontWeight="800" fill="#5b4a78">
          {remaining > 0 ? `남은 일 ${remaining}` : '다 끝! 🎉'}
        </text>
      </g>
      </g>
      <g transform={`translate(0 ${drop})`}>
      {AVATARS.filter((a) => a.id !== 'user' && shown.includes(a.id)).map((info, i) => (
        <Avatar key={info.id} info={info} activity={activities[info.id]} alert={alerts[info.id as Staff]} cheer={cheers[info.id]} taskLabel={labels[info.id as Staff]} speech={speech[info.id]} onReceived={onReceived} onManualArrived={onManualArrived} dark={dark}
          delay={i * 0.3} selected={selected === info.id} onSelect={onSelect} />
      ))}
      </g>
      {(cats.ruby || cats.crystal) && (
        <g transform={`translate(0 ${catDrop})`}>
          {cats.ruby && <Cat id="cat1" name="루비" frozen={!!scene} place={placeRuby} start={{ x: 640, y: 408 }} offset={-10} avoid={avoidFor('cat1')} report={reportCat} call={callSpot} pointer={() => (pointerRef.current ? { x: pointerRef.current.x, y: pointerRef.current.y - catDrop } : null)} />}
          {cats.crystal && <Cat id="cat2" pre="wh_" name="크리스탈" frozen={!!scene} place={placeCrystal} visit={visit} side={150} start={{ x: 330, y: 690 }} offset={10} avoid={avoidFor('cat2')} report={reportCat} call={callSpot} pointer={() => (pointerRef.current ? { x: pointerRef.current.x, y: pointerRef.current.y - catDrop } : null)} />}
          {scene && bothCats && <PairScene key={scene.n} scene={scene} />}
        </g>
      )}
    </svg>
  )
}
