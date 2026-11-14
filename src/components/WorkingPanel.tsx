import type { AvatarInfo } from '../avatars'
import Linkify from './Linkify'
import { dueInfo, fmtDate } from '../dates'
import type { Activity } from '../schedule'
import type { WorkItem } from '../work'
import { fmtWorked, workedMs } from '../worktime'

interface Props {
  info: AvatarInfo
  activity: Activity
  doing: WorkItem[]
  onWait: (item: WorkItem) => void
  onComplete: (item: WorkItem) => void
}

/** 일하는 중인 아바타를 눌렀을 때: 지금 하는 일과 대기·완료 버튼만 보여 줘요 */
export default function WorkingPanel({ info, activity, doing, onWait, onComplete }: Props) {
  return (
    <div className="working-panel">
      <p className="wlabel">{activity.label}</p>
      {doing.map((it) => {
        const di = dueInfo({ due: it.due, status: it.task.status })
        return (
          <div className="wjob" key={it.key}>
            <div className="wtitle">
              <span>🛠 {it.title}{it.sub && <small> · {it.task.title}</small>}<small className="wtime"> · ⏱ {fmtWorked(workedMs(it.task))} 일했어요</small></span>
              <span className={`badge lv-${di.level}`}>{it.due ? `${fmtDate(it.due)} ${di.label}` : di.label}</span>
            </div>
            {it.task.desc && <p className="wdesc"><Linkify text={it.task.desc} /></p>}
            <div className="btnrow2">
              <button className="ghost" onClick={() => onWait(it)}>⏸ 대기</button>
              <button className="primary done" onClick={() => onComplete(it)}>✅ 완료</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
