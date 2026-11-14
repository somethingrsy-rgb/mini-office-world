import { AVATARS, type AvatarId } from '../avatars'
import { asset, ROOM_IMG, spriteFor, SPRITES } from '../assets'
import { roomOf, type RoomId } from '../rooms'
import type { Activity } from '../schedule'

/** 방을 확대해서 지금 그 안에 있는 아바타를 보여 줌 */
export default function RoomView({ room, activities }: { room: RoomId; activities: Record<AvatarId, Activity> }) {
  const dim = ROOM_IMG[room]
  const here = AVATARS.filter((a) => !activities[a.id].away && roomOf(activities[a.id].spot) === room)
  const n = here.length

  return (
    <div>
      <div className="roomstage" style={{ aspectRatio: `${dim.w} / ${dim.h}` }}>
        <img className="roomimg" src={asset(`rooms/${room}.webp`)} alt="" />
        {here.map((a, i) => {
          const act = activities[a.id]
          const key = spriteFor(a.id, act.pose)
          const m = SPRITES[a.id][key]
          const left = n === 1 ? 50 : 15 + (70 / (n - 1)) * i
          return (
            <div key={a.id} className="occupant" style={{ left: `${left}%`, height: `${(m.h / 295) * 36}%` }}>
              <img src={asset(`avatars/${a.id}-${key}.webp`)} alt={a.name} />
              <span>{a.name}</span>
            </div>
          )
        })}
      </div>
      {n === 0 ? (
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
