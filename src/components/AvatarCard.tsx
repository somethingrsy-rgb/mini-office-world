import type { AvatarInfo } from '../avatars'
import RichText from './RichText'
import Linkify from './Linkify'
import { dueInfo, fmtDate } from '../dates'
import type { Activity } from '../schedule'
import type { AvatarWork, WorkItem } from '../work'

function Item({ i, onStart, onWait, onComplete }: { i: WorkItem; onStart?: (i: WorkItem) => void; onWait?: (i: WorkItem) => void; onComplete?: (i: WorkItem) => void }) {
  const di = dueInfo({ due: i.due, status: i.task.status })
  return (
    <li className={`item lv-${i.level}`}>
      <span className="it-title">{i.title}{i.sub && <small> · {i.task.title}</small>}{!i.sub && i.task.desc && <small className="idesc"><Linkify text={i.task.desc} /></small>}</span>
      <span className={`badge lv-${di.level}`}>{i.due ? `${fmtDate(i.due)} ${di.label}` : di.label}</span>
      {(onStart || onWait || onComplete) && (
        <span className="item-actions">
          {onStart && <button className="primary sm" onClick={() => onStart(i)}>▶ 진행</button>}
          {onWait && <button className="ghost sm" onClick={() => onWait(i)}>⏸ 대기</button>}
          {onComplete && <button className="primary sm done" onClick={() => onComplete(i)}>✅ 완료</button>}
        </span>
      )}
    </li>
  )
}

function Section({ title, items, onStart, onWait, onComplete, skipActionsFor = 0 }: { title: string; items: WorkItem[]; onStart?: (i: WorkItem) => void; onWait?: (i: WorkItem) => void; onComplete?: (i: WorkItem) => void; skipActionsFor?: number }) {
  if (items.length === 0) return null
  return (
    <div className="sec">
      <h3>{title} <b>{items.length}</b></h3>
      <ul>{items.map((i, n) => <Item key={i.key} i={i} onStart={onStart} onWait={n < skipActionsFor ? undefined : onWait} onComplete={n < skipActionsFor ? undefined : onComplete} />)}</ul>
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
  onWait?: (item: WorkItem) => void
  onComplete?: (item: WorkItem) => void
  hideTitle?: boolean
}

export default function AvatarCard({ info, activity, work, totals, onAssign, onStart, onWait, onComplete, hideTitle }: Props) {
  return (
    <>
      {!hideTitle && <div className="card-title"><RichText text={info.emoji} /> {info.name} <span>{info.role}</span></div>}
      <p>{activity.label}</p>
      {work && work.doing.length === 0 && work.planned.length > 0 && (
        <p className="waiting">⏳ 대기 중 · 예정된 일 {work.planned.length}건</p>
      )}
      {onStart && work && work.planned.length > 0 && (
        <button className="primary assignbtn go" onClick={() => onStart(work.planned[0])}>▶ 진행하기 · 「{work.planned[0].title}」</button>
      )}
      {onWait && onComplete && work && work.doing.length > 0 && (
        <div className="workbtns">
          <p className="working">🛠 일하는 중 · 「{work.doing[0].title}」</p>
          <div className="btnrow2">
            <button className="ghost" onClick={() => onWait(work.doing[0])}>⏸ 대기</button>
            <button className="primary done" onClick={() => onComplete(work.doing[0])}>✅ 완료</button>
          </div>
        </div>
      )}
      {onAssign && <button className="ghost assignbtn" onClick={onAssign}>📋 이미 등록한 일 맡기기</button>}
      {work ? (
        work.items.length === 0 ? (
          <p className="muted">맡은 업무가 없어요. 느긋하게 쉬는 중이에요 ☕</p>
        ) : (
          <>
            <Section title="진행 중인 업무" items={work.doing} onWait={onWait} onComplete={onComplete} skipActionsFor={1} />
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
