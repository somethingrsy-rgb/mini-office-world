import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import { AVATARS, type AvatarId } from '../avatars'
import { asset, COUNTER_IMG, HOUSE } from '../assets'
import { COUNTER, ROOMS, type RoomId } from '../rooms'
import type { Activity } from '../schedule'
import type { Staff } from '../types'

interface Props {
  activities: Record<AvatarId, Activity>
  alerts: Partial<Record<Staff, 'soon' | 'urgent' | null>>
  cheers: Record<string, number>
  labels: Partial<Record<Staff, { text: string; more: number } | null>>
  /** 지금 남아 있는(끝나지 않은) 일 개수 */
  remaining: number
  /** 마감이 2일 이내(오늘·기한 초과 포함)인 일 — 접수대의 내가 번갈아 알려줘요 */
  reminders: { text: string; level: 'soon' | 'urgent' }[]
  selected: AvatarId | null
  onSelect: (id: AvatarId) => void
  onRoom: (id: RoomId) => void
}

/** 글자 수에 맞춘 말풍선 폭 (한글은 넓게, 영문·숫자는 좁게) */
const tw = (t: string, size: number) => [...t].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? size : size * 0.58), 0)

export default function House({ activities, alerts, cheers, labels, remaining, reminders, selected, onSelect, onRoom }: Props) {
  // 마감이 가까운 일을 4.5초마다 번갈아 알려줘요
  const [ri, setRi] = useState(0)
  useEffect(() => {
    if (reminders.length < 2) return
    const t = window.setInterval(() => setRi((i) => i + 1), 4500)
    return () => window.clearInterval(t)
  }, [reminders.length])
  const rem = reminders.length ? reminders[ri % reminders.length] : null
  const remText = rem ? `⏰ ${rem.text}` : ''
  const remW = rem ? tw(remText, 24) + 40 : 0
  const remCx = Math.max(COUNTER.bodyCenterX, remW / 2 + 36) // 집 가장자리에 붙지 않게 안쪽으로

  return (
    <svg viewBox={`0 0 ${HOUSE.w} ${HOUSE.h}`} className="house" role="img" aria-label="미니어처 오피스 하우스">
      <image href={asset('house.webp')} width={HOUSE.w} height={HOUSE.h} />
      {/* 방을 누르면 확대해서 볼 수 있게 하는 투명 영역 */}
      {ROOMS.map((r) => (
        <rect key={r.id} className="hot" x={r.rect.x} y={r.rect.y} width={r.rect.w} height={r.rect.h} fill="#fff" fillOpacity="0"
          onClick={() => onRoom(r.id)} role="button" aria-label={`${r.name} 확대`} />
      ))}
      {/* 나(관리자)는 접수대 안쪽에 서 있고, 카운터 그림이 앞에 놓여요. 일을 받으러 온 아바타는 카운터 앞에 서야 하므로 그 뒤에 그려요 */}
      {AVATARS.filter((a) => a.id === 'user').map((info) => (
        <Avatar key={info.id} info={info} activity={activities[info.id]} cheer={cheers[info.id]} hideName
          delay={1.2} selected={selected === info.id} onSelect={onSelect} />
      ))}
      <image href={asset('counter.webp')} x={COUNTER.x} y={COUNTER.bottom - COUNTER_IMG.h * COUNTER.w / COUNTER_IMG.w}
        width={COUNTER.w} height={COUNTER_IMG.h * COUNTER.w / COUNTER_IMG.w} pointerEvents="none" />
      {/* 카운터 앞 이름판: 남은 일 개수를 보여 줘요 (일을 끝내면 줄어들고, 0이면 모두 대기) */}
      <g pointerEvents="none">
        <rect x={COUNTER.bodyCenterX - 64} y={COUNTER.bottom - 62} width="128" height="42" rx="21" fill="#fff" fillOpacity=".95" stroke={remaining > 0 ? '#ff86b6' : '#7fd6c2'} strokeWidth="3.5" />
        <text x={COUNTER.bodyCenterX} y={COUNTER.bottom - 33} textAnchor="middle" fontSize="25" fontWeight="800" fill="#5b4a78">
          {remaining > 0 ? `남은 일 ${remaining}` : '다 끝! 🎉'}
        </text>
      </g>
      {rem && (
        <g pointerEvents="none" className="remind" key={ri}>
          <rect x={remCx - remW / 2} y="716" width={remW} height="50" rx="25" fill="#fff" fillOpacity=".97" stroke={rem.level === 'urgent' ? '#ff4d6d' : '#f5b301'} strokeWidth="4" />
          <path d={`M${COUNTER.bodyCenterX - 9} 766 l9 14 9 -14z`} fill="#fff" stroke={rem.level === 'urgent' ? '#ff4d6d' : '#f5b301'} strokeWidth="3" strokeLinejoin="round" />
          <rect x={COUNTER.bodyCenterX - 12} y="760" width="24" height="8" fill="#fff" />
          <text x={remCx} y="750" textAnchor="middle" fontSize="24" fontWeight="800" fill="#5b4a78">{remText}</text>
        </g>
      )}
      {AVATARS.filter((a) => a.id !== 'user').map((info, i) => (
        <Avatar key={info.id} info={info} activity={activities[info.id]} alert={alerts[info.id as Staff]} cheer={cheers[info.id]} taskLabel={labels[info.id as Staff]}
          delay={i * 0.3} selected={selected === info.id} onSelect={onSelect} />
      ))}
    </svg>
  )
}
