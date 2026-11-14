import type { AvatarInfo } from '../avatars'
import { dueInfo, fmtDate } from '../dates'
import { useReorder } from '../useReorder'
import type { WorkItem } from '../work'
import Linkify from './Linkify'

interface Props {
  info: AvatarInfo
  /** 이 아바타가 맡은 아직 시작하지 않은 일 (지금 정해진 순서대로) */
  items: WorkItem[]
  managerName: string
  onStart: (item: WorkItem) => void
  /** 꾹 눌러서 바꾼 순서: 업무 id 목록 */
  onOrder: (taskIds: string[]) => void
  onGoManager: () => void
}

/** 아바타를 눌렀을 때: 맡은 일 목록만 보여주고, 줄을 꾹 눌러 끌어서 순서를 바꿔요 */
export default function AvatarTasks({ info, items, managerName, onStart, onOrder, onGoManager }: Props) {
  // 한 업무에 세부 할 일이 여러 개여도 업무 하나가 한 줄이에요
  const rows: WorkItem[] = []
  items.forEach((i) => { if (!rows.some((r) => r.task.id === i.task.id)) rows.push(i) })
  const ids = rows.map((r) => r.task.id)
  const { setRow, down, drag, shift } = useReorder(ids, onOrder)

  if (rows.length === 0) {
    return (
      <div className="avtasks">
        <p className="muted">맡은 일이 없어요.</p>
        <button className="ghost wide" onClick={onGoManager}>⚡ {managerName}에게 가서 분배하기</button>
      </div>
    )
  }

  return (
    <div className="avtasks">
      <h3 className="sh">예정된 업무 <b>{rows.length}</b></h3>
      {rows.length > 1 && <p className="muted todohint">✋ 줄을 꾹 눌렀다가 위아래로 끌면 순서를 바꿀 수 있어요. 위에 있을수록 먼저 해요.</p>}
      <ol className="todolist" onContextMenu={(e) => e.preventDefault()}>
        {rows.map((it, i) => {
          const di = dueInfo({ due: it.task.due, status: it.task.status })
          const on = drag?.id === it.task.id
          return (
            <li
              key={it.task.id}
              ref={setRow(it.task.id)}
              className={`todorow lv-${di.level} ${on ? 'lift' : ''}`}
              style={{ transform: `translateY(${shift(i)}px)${on ? ' scale(1.02)' : ''}`, transition: on ? 'none' : 'transform .18s ease' }}
              onPointerDown={(e) => down(e, it.task.id)}
            >
              <span className="rank">{i + 1}</span>
              <span className="tmain">
                <b>{it.task.title}</b>
                {it.task.desc && <small className="atdesc"><Linkify text={it.task.desc} /></small>}
              </span>
              <span className={`badge lv-${di.level}`}>{it.task.due ? `${fmtDate(it.task.due)} ${di.label}` : di.label}</span>
              <button className="primary sm" onPointerDown={(e) => e.stopPropagation()} onClick={() => onStart(it)}>▶ 진행</button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
