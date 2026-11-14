import Avatar from './Avatar'
import { AVATARS, type AvatarId } from '../avatars'
import { asset, HOUSE } from '../assets'
import { ROOMS, type RoomId } from '../rooms'
import type { Activity } from '../schedule'
import type { Staff } from '../types'

interface Props {
  activities: Record<AvatarId, Activity>
  alerts: Partial<Record<Staff, 'soon' | 'urgent' | null>>
  cheers: Record<string, number>
  labels: Partial<Record<Staff, { text: string; more: number } | null>>
  selected: AvatarId | null
  onSelect: (id: AvatarId) => void
  onRoom: (id: RoomId) => void
}

export default function House({ activities, alerts, cheers, labels, selected, onSelect, onRoom }: Props) {
  return (
    <svg viewBox={`0 0 ${HOUSE.w} ${HOUSE.h}`} className="house" role="img" aria-label="미니어처 오피스 하우스">
      <image href={asset('house.webp')} width={HOUSE.w} height={HOUSE.h} />
      {/* 방을 누르면 확대해서 볼 수 있게 하는 투명 영역 */}
      {ROOMS.map((r) => (
        <rect key={r.id} className="hot" x={r.rect.x} y={r.rect.y} width={r.rect.w} height={r.rect.h} fill="#fff" fillOpacity="0"
          onClick={() => onRoom(r.id)} role="button" aria-label={`${r.name} 확대`} />
      ))}
      {AVATARS.map((info, i) => (
        <Avatar key={info.id} info={info} activity={activities[info.id]} alert={alerts[info.id as Staff]} cheer={cheers[info.id]} taskLabel={labels[info.id as Staff]}
          delay={i * 0.3} selected={selected === info.id} onSelect={onSelect} />
      ))}
    </svg>
  )
}
