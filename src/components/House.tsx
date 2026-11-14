import Avatar from './Avatar'
import { AVATARS, type AvatarId } from '../avatars'
import { COUNTER_IMG, themed } from '../assets'
import { COUNTER, COUNTER_DARK_DROP, ROOMS, type RoomId } from '../rooms'
import type { Activity } from '../schedule'
import type { Staff } from '../types'

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
  /** 접수대에서 일을 받기 시작한 아바타 */
  onReceived?: (id: AvatarId) => void
  selected: AvatarId | null
  onSelect: (id: AvatarId) => void
  onRoom: (id: RoomId) => void
}

/** 글자 수에 맞춘 말풍선 폭 (한글은 넓게, 영문·숫자는 좁게) */
const tw = (t: string, size: number) => [...t].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? size : size * 0.58), 0)

export default function House({ activities, alerts, cheers, labels, shown, speech, remaining, selected, onSelect, onRoom, dark = false, onReceived }: Props) {
  const th = themed(dark)
  return (
    <svg viewBox={`0 0 ${th.houseDim.w} ${th.houseDim.h}`} className="house" role="img" aria-label="미니어처 오피스 하우스">
      <image className="houseimg" href={th.house} width={th.houseDim.w} height={th.houseDim.h} />
      {/* 방을 누르면 확대해서 볼 수 있게 하는 투명 영역 */}
      {ROOMS.map((r) => (
        <rect key={r.id} className="hot" x={r.rect.x} y={r.rect.y} width={r.rect.w} height={r.rect.h} fill="#fff" fillOpacity="0"
          onClick={() => onRoom(r.id)} role="button" aria-label={`${r.name} 확대`} />
      ))}
      {/* 나(관리자)는 접수대 안쪽에 서 있고, 카운터 그림이 앞에 놓여요. 일을 받으러 온 아바타는 카운터 앞에 서야 하므로 그 뒤에 그려요 */}
      {/* 다크 하우스는 접수실 나무 바닥이 조금 더 아래에서 시작해서, 카운터와 나를 그만큼 내려요 */}
      <g transform={`translate(0 ${dark ? COUNTER_DARK_DROP : 0})`}>
      {AVATARS.filter((a) => a.id === 'user').map((info) => (
        <Avatar key={info.id} info={info} activity={activities[info.id]} cheer={cheers[info.id]} speech={speech[info.id]} hideName
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
      {AVATARS.filter((a) => a.id !== 'user' && shown.includes(a.id)).map((info, i) => (
        <Avatar key={info.id} info={info} activity={activities[info.id]} alert={alerts[info.id as Staff]} cheer={cheers[info.id]} taskLabel={labels[info.id as Staff]} speech={speech[info.id]} onReceived={onReceived} dark={dark}
          delay={i * 0.3} selected={selected === info.id} onSelect={onSelect} />
      ))}
    </svg>
  )
}
