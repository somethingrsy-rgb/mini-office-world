import { AVATARS, type AvatarId } from '../avatars'
import { asset, COUNTER_IMG, ROOM_IMG, spriteFor, SPRITES, themed, type Skin } from '../assets'
import { roomOf, type RoomId } from '../rooms'
import type { Activity } from '../schedule'

// 접수실 확대 그림 안에서 카운터를 놓는 자리(가로·세로 %)와 단위 환산
const RC = { left: 20, width: 46, bottom: 12 }

/** 방을 확대해서 지금 그 안에 있는 아바타를 보여 줌 */
export default function RoomView({ room, activities, shown, dark = false, skin }: { room: RoomId; activities: Record<AvatarId, Activity>; shown: AvatarId[]; dark?: boolean; skin?: Skin }) {
  const dim = ROOM_IMG[room]
  const here = AVATARS.filter((a) => (a.id === 'user' || shown.includes(a.id)) && roomOf(activities[a.id].spot) === room)
  const isReception = room === 'reception'
  // 접수실: 나는 카운터 뒤, 일을 받으러 온 아바타는 카운터 앞
  const user = isReception ? here.find((a) => a.id === 'user') : undefined
  const others = here.filter((a) => a.id !== user?.id)
  const n = others.length

  // 카운터 그림의 높이(컨테이너 높이 대비 %)와, 하우스 좌표 1단위가 차지하는 %
  const aspect = dim.w / dim.h
  const counterHpct = RC.width * (COUNTER_IMG.h / COUNTER_IMG.w) * aspect
  const unitPct = counterHpct / (COUNTER_IMG.h * (230 / COUNTER_IMG.w))

  return (
    <div>
      <div className="roomstage" style={{ aspectRatio: `${dim.w} / ${dim.h}` }}>
        <img className={`roomimg ${skin === 'beige' ? 'tint-house' : ''}`} src={asset(`rooms/${room}.webp`)} alt="" />
        {user && (() => {
          const act = activities[user.id]
          const key = spriteFor(user.id, act.pose)
          const m = SPRITES[user.id][key]!
          const center = RC.left + RC.width * (207 - 70) / 230
          const bottom = RC.bottom + counterHpct * (1 - 0.47) // 카운터 윗면 가운데쯤
          return (
            <div className="occupant" style={{ left: `${center}%`, bottom: `${bottom}%`, height: `${m.h * 0.56 * unitPct}%` }}>
              <img src={asset(`avatars/user-${key}.webp`)} alt={user.name} />
            </div>
          )
        })()}
        {isReception && (
          <img className="roomcounter" src={themed(skin ?? dark).counter} alt="" style={{ left: `${RC.left}%`, width: `${RC.width}%`, bottom: `${RC.bottom}%` }} />
        )}
        {others.map((a, i) => {
          const act = activities[a.id]
          const key = spriteFor(a.id, act.pose)
          const m = SPRITES[a.id][key]!
          const left = isReception ? [78, 90, 12, 68][i % 4] : n === 1 ? 50 : 15 + (70 / (n - 1)) * i
          return (
            <div key={a.id} className="occupant front" style={{ left: `${left}%`, height: `${(m.h / 295) * 36}%`, bottom: isReception ? '5%' : undefined }}>
              <img src={asset(`avatars/${a.id}-${key}.webp`)} alt={a.name} />
              <span>{a.name}</span>
            </div>
          )
        })}
      </div>
      {here.length === 0 ? (
        <p className="muted pad">지금은 아무도 없어요. 조용한 방이에요 🌙</p>
      ) : (
        <ul className="elist who">
          {here.map((a) => (
            <li key={a.id} className="erow"><span className="chk">{a.emoji}</span><span className="et"><b>{a.name}</b><small> · {activities[a.id].label}</small></span></li>
          ))}
        </ul>
      )}
    </div>
  )
}
