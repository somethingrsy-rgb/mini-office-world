import type { AvatarInfo } from '../avatars'
import { dueInfo, fmtDate } from '../dates'
import type { Activity } from '../schedule'
import type { AvatarWork, WorkItem } from '../work'

function Item({ i, onStart }: { i: WorkItem; onStart?: (i: WorkItem) => void }) {
  const di = dueInfo({ due: i.due, status: i.task.status })
  return (
    <li className={`item lv-${i.level}`}>
      <span className="it-title">{i.title}{i.sub && <small> · {i.task.title}</small>}</span>
      <span className={`badge lv-${di.level}`}>{i.due ? `${fmtDate(i.due)} ${di.label}` : di.label}</span>
      {onStart && <button className="primary sm" onClick={() => onStart(i)}>▶ 진행</button>}
    </li>
  )
}

function Section({ title, items, onStart }: { title: string; items: WorkItem[]; onStart?: (i: WorkItem) => void }) {
  if (items.length === 0) return null
  return (
    <div className="sec">
      <h3>{title} <b>{items.length}</b></h3>
      <ul>{items.map((i) => <Item key={i.key} i={i} onStart={onStart} />)}</ul>
    </div>
  )
}

interface Props {
  info: AvatarInfo
  activity: Activity
  work?: AvatarWork
  totals: { doing: number; planned: number; soon: number }
  onAssign?: () => void
  onStart?: (item: WorkItem) => void
}

export default function AvatarCard({ info, activity, work, totals, onAssign, onStart }: Props) {
  return (
    <>
      <div className="card-title">{info.emoji} {info.name} <span>{info.role}</span></div>
      <p>{activity.label}</p>
      {work && work.doing.length === 0 && work.planned.length > 0 && (
        <p className="waiting">⏳ 대기 중 · 예정된 일 {work.planned.length}건</p>
      )}
      {onStart && work && work.planned.length > 0 && (
        <button className="primary assignbtn go" onClick={() => onStart(work.planned[0])}>▶ 진행하기 · 「{work.planned[0].title}」</button>
      )}
      {onAssign && <button className="ghost assignbtn" onClick={onAssign}>＋ {info.name}에게 일 시키기</button>}
      {work ? (
        work.items.length === 0 ? (
          <p className="muted">맡은 업무가 없어요. 느긋하게 쉬는 중이에요 ☕</p>
        ) : (
          <>
            <Section title="진행 중인 업무" items={work.doing} />
            <Section title="예정된 업무" items={work.planned} onStart={onStart} />
            <Section title="마감 임박 업무" items={work.soon} />
          </>
        )
      ) : (
        <p className="muted">진행 중 {totals.doing}건 · 예정 {totals.planned}건 · 마감 임박 {totals.soon}건</p>
      )}
    </>
  )
}
