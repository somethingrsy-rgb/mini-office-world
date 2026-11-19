import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import Cat, { CAT_SCALE } from './Cat'
import { buildScene, pickActions, playKey, type PlayScene } from '../playScene'
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
  // 두 고양이가 걸어 다니다가 우연히 마주치면 장난쳐요 (일부러 서로를 쫓아가지는 않아요)
  type Ov = { x: number; y: number; key: string; flip: boolean }
  const [ov, setOv] = useState<{ cat1: Ov | null; cat2: Ov | null }>({ cat1: null, cat2: null })
  const sceneRef = useRef<{ plan: PlayScene; t0: number; leftIs: 'cat1' | 'cat2'; y: number } | null>(null)
  const [placeRuby, setPlaceRuby] = useState<{ x: number; y: number; n: number } | null>(null)
  const [placeCrystal, setPlaceCrystal] = useState<{ x: number; y: number; n: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const sceneN = useRef(0)
  const lastScene = useRef(Date.now() - 20000)
  const cooldown = useRef(55000 + Math.random() * 15000)   // 장난은 1분에 한 번쯤
  const bothCats = cats.ruby && cats.crystal
  const UNIT = 160 * CAT_SCALE                                // 걷는 고양이 한 마리의 가로 크기
  useEffect(() => {
    if (!bothCats) { sceneRef.current = null; setPlaying(false); setOv({ cat1: null, cat2: null }); return }
    const t = window.setInterval(() => {
      const now = Date.now()
      const cur = sceneRef.current
      if (cur) {
        const el = now - cur.t0
        if (el >= cur.plan.dur) {   // 끝나면 두 마리를 그 자리에 앉혀 놓고 다시 돌아다녀요
          const { L, R } = cur.plan.end
          const left = cur.leftIs === 'cat1' ? setPlaceRuby : setPlaceCrystal, right = cur.leftIs === 'cat1' ? setPlaceCrystal : setPlaceRuby
          left({ x: L, y: cur.y, n: ++sceneN.current }); right({ x: R, y: cur.y, n: ++sceneN.current })
          sceneRef.current = null; setPlaying(false); setOv({ cat1: null, cat2: null })
          lastScene.current = now; cooldown.current = 55000 + Math.random() * 15000
          return
        }
        const st = cur.plan.at(el)
        const mk = (s: typeof st.L, pre: string): Ov => ({ x: s.x, y: cur.y, key: playKey(pre, s), flip: s.flip })
        const L = mk(st.L, cur.leftIs === 'cat1' ? '' : 'wh_'), R = mk(st.R, cur.leftIs === 'cat1' ? 'wh_' : '')
        setOv(cur.leftIs === 'cat1' ? { cat1: L, cat2: R } : { cat1: R, cat2: L })
        return
      }
      const a = catPos.current['cat1'] as { x: number; y: number; free?: boolean; dir?: number } | undefined   // 루비
      const b = catPos.current['cat2'] as { x: number; y: number; free?: boolean; dir?: number } | undefined   // 크리스탈
      if (!a || !b || !a.free || !b.free) return
      if (now - lastScene.current < cooldown.current) return
      if (Math.abs(a.y - b.y) > 40 || Math.abs(a.x - b.x) > 1.6 * UNIT) return   // 같은 층에서 마주쳤을 때만
      const away = (c: { x: number; dir?: number }, o: { x: number }) => !!c.dir && Math.sign(c.dir) === Math.sign(c.x - o.x)   // 서로 등지고 걷는 중이면 마주친 게 아니에요
      if (away(a, b) || away(b, a)) return
      const leftIs = a.x <= b.x ? 'cat1' : 'cat2'
      const plan = buildScene(pickActions(), Math.min(a.x, b.x), Math.max(a.x, b.x), UNIT, 170, 830, 48)
      sceneRef.current = { plan, t0: now, leftIs, y: (a.y + b.y) / 2 }
      setPlaying(true)
    }, 80)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothCats])
  // 시험용: 두 고양이를 같은 자리 근처에 놓고 바로 장난치게 해요
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__catPlay = () => {
      const a = catPos.current['cat1']; if (!a) return
      lastScene.current = 0; cooldown.current = 0
      setPlaceRuby({ x: 560, y: a.y, n: ++sceneN.current }); setPlaceCrystal({ x: 360, y: a.y, n: ++sceneN.current })
    }
  }, [])
  // 만날 때가 됐으면 고양이가 다른 층으로 갈 때 상대가 있는 층을 조금 더 골라요 (쫓아가는 건 아니고 층만 같아져요)
  const wantFloorY = (other: string) => () => (bothCats && !sceneRef.current && Date.now() - lastScene.current > cooldown.current ? (catPos.current[other]?.y ?? null) : null)
  // 두 고양이의 자리를 서로에게 알려요
  const catPos = useRef<Record<string, { x: number; y: number; free?: boolean; dir?: number }>>({})
  const reportCat = (id: string, p: { x: number; y: number; free: boolean; dir: number }) => { catPos.current[id] = p }
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
          {cats.ruby && <Cat id="cat1" name="루비" frozen={playing} ov={ov.cat1} place={placeRuby} want={wantFloorY('cat2')} start={{ x: 640, y: 408 }} offset={-10} avoid={avoidFor('cat1')} report={reportCat} call={callSpot} pointer={() => (pointerRef.current ? { x: pointerRef.current.x, y: pointerRef.current.y - catDrop } : null)} />}
          {cats.crystal && <Cat id="cat2" pre="wh_" name="크리스탈" frozen={playing} ov={ov.cat2} place={placeCrystal} want={wantFloorY('cat1')} side={150} start={{ x: 330, y: 690 }} offset={10} avoid={avoidFor('cat2')} report={reportCat} call={callSpot} pointer={() => (pointerRef.current ? { x: pointerRef.current.x, y: pointerRef.current.y - catDrop } : null)} />}
        </g>
      )}
    </svg>
  )
}
