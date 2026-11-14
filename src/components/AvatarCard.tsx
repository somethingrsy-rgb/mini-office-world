import type { AvatarInfo } from '../avatars'
import { dueInfo, fmtDate } from '../dates'
import type { Activity } from '../schedule'
import type { AvatarWork, WorkItem } from '../work'

function Item({ i }: { i: WorkItem }) {
  const di = dueInfo({ due: i.due, status: i.task.status })
  return (
    <li className={`item lv-${i.level}`}>
      <span className="it-title">{i.title}{i.sub && <small> · {i.task.title}</small>}</span>
      <span className={`badge lv-${di.level}`}>{i.due ? `${fmtDate(i.due)} ${di.label}` : di.label}</span>
    </li>
  )
}

function Section({ title, items }: { title: string; items: WorkItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="sec">
      <h3>{title} <b>{items.length}</b></h3>
      <ul>{items.map((i) => <Item key={i.key} i={i} />)}</ul>
    </div>
  )
}

interface Props {
  info: AvatarInfo
  activity: Activity
  work?: AvatarWork
  totals: { doing: number; planned: number; soon: number }
}

export default function AvatarCard({ info, activity, work, totals }: Props) {
  return (
    <>
      <div className="card-title">{info.emoji} {info.name} <span>{info.role}</span></div>
      <p>{activity.label}</p>
      {work ? (
        work.items.length === 0 ? (
          <p className="muted">맡은 업무가 없어요. 느긋하게 쉬는 중이에요 ☕</p>
        ) : (
          <>
            <Section title="진행 중인 업무" items={work.doing} />
            <Section title="예정된 업무" items={work.planned} />
            <Section title="마감 임박 업무" items={work.soon} />
          </>
        )
      ) : (
        <p className="muted">진행 중 {totals.doing}건 · 예정 {totals.planned}건 · 마감 임박 {totals.soon}건</p>
      )}
    </>
  )
}
