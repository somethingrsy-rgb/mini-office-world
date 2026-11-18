import { useRef } from 'react'
import Avatar from './Avatar'
import Cat from './Cat'
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
  /** 돌아다니는 아기 고양이 보이기 */
  cats?: boolean
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

/** 안내선 '아래 N'만큼 발을 내려요: 고양이 루비는 30, 아바타·접수대는 20 */
const CAT_DROP = 30
const FOOT_DROP = 20

export default function House({ activities, alerts, cheers, labels, shown, speech, remaining, selected, onSelect, onRoom, onMove, onManualArrived, dark = false, skin = 'default', guide = false, cats = false, onReceived }: Props) {
  const th = themed(dark, skin)
  const svgRef = useRef<SVGSVGElement>(null)
  // 하우스 그림(나무·바다·웨딩·놀이동산)에서는 아바타·고양이·접수대를 바닥 쪽으로 30 내려요 (안내선 '아래 30')
  const drop = skin !== 'default' ? FOOT_DROP : 0
  const catDrop = skin !== 'default' ? CAT_DROP : 0
  // 고양이가 아바타와 겹치지 않도록 지금 아바타들이 있는(가는) 자리를 알려줘요
  const actRef = useRef(activities)
  actRef.current = activities
  const shownRef = useRef(shown)
  shownRef.current = shown
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
    <svg ref={svgRef} viewBox={`0 0 ${th.houseDim.w} ${th.houseDim.h}`} className="house" role="img" aria-label="미니어처 오피스 하우스">
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
      {cats && (
        <g transform={`translate(0 ${catDrop})`}>
          <Cat id="cat1" start={{ x: 640, y: 408 }} offset={-10} avoid={avatarSpots} />
        </g>
      )}
      <g transform={`translate(0 ${drop})`}>
      {AVATARS.filter((a) => a.id !== 'user' && shown.includes(a.id)).map((info, i) => (
        <Avatar key={info.id} info={info} activity={activities[info.id]} alert={alerts[info.id as Staff]} cheer={cheers[info.id]} taskLabel={labels[info.id as Staff]} speech={speech[info.id]} onReceived={onReceived} onManualArrived={onManualArrived} dark={dark}
          delay={i * 0.3} selected={selected === info.id} onSelect={onSelect} />
      ))}
      </g>
    </svg>
  )
}
