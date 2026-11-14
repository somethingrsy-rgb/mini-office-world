import { subAssignee, taskAssignee } from './assign'
import { daysBetween, dueInfo, todayStr, type DueLevel } from './dates'
import type { Staff, SubTask, Task } from './types'

/** 아바타가 맡은 일 한 건 (세부 할 일이 없으면 업무 자체) */
export interface WorkItem {
  key: string
  task: Task
  sub?: SubTask
  title: string
  assignee: Staff
  due: string | null
  level: DueLevel
  started: boolean // 업무가 '진행 중'인지
}

const IMP = { high: 0, normal: 1, low: 2 } as const

/** 우선순위: 기한 초과 → 남은 기간 → 중요도 → 등록 순서 */
function compareItems(a: WorkItem, b: WorkItem, today: string) {
  const oa = a.level === 'overdue'
  const ob = b.level === 'overdue'
  if (oa !== ob) return oa ? -1 : 1
  const da = a.due ? daysBetween(today, a.due) : 9999
  const db = b.due ? daysBetween(today, b.due) : 9999
  if (da !== db) return da - db
  if (a.task.importance !== b.task.importance) return IMP[a.task.importance] - IMP[b.task.importance]
  return a.task.createdAt - b.task.createdAt
}

/** rank: 내가 정한 업무 순서(업무 id → 순번). 정해 둔 순서가 기본 우선순위보다 먼저예요 */
export function buildItems(tasks: Task[], today = todayStr(), rank?: Map<string, number>): WorkItem[] {
  const out: WorkItem[] = []
  const mk = (task: Task, sub?: SubTask): WorkItem => {
    const due = sub?.due ?? task.due
    return {
      key: sub ? `${task.id}/${sub.id}` : task.id,
      task,
      sub,
      title: sub ? sub.title : task.title,
      assignee: sub ? subAssignee(task, sub) : taskAssignee(task),
      due,
      level: dueInfo({ due, status: task.status }, today).level,
      started: task.status === 'doing',
    }
  }
  for (const t of tasks) {
    if (t.status === 'done') continue
    if (t.subtasks.length === 0) out.push(mk(t))
    else for (const s of t.subtasks) if (!s.done) out.push(mk(t, s))
  }
  return out.sort((a, b) => {
    const ra = rank?.get(a.task.id) ?? -1 // 순서를 정한 뒤 새로 생긴 업무(-1)는 맨 앞
    const rb = rank?.get(b.task.id) ?? -1
    return ra !== rb ? ra - rb : compareItems(a, b, today)
  })
}

export interface AvatarWork {
  items: WorkItem[]
  doing: WorkItem[] // 진행 중인 업무
  planned: WorkItem[] // 예정된 업무
  soon: WorkItem[] // 마감 임박(3일 이내·당일·초과)
  alert: 'soon' | 'urgent' | null
}

export function workByAvatar(items: WorkItem[]): Record<Staff, AvatarWork> {
  const res = {} as Record<Staff, AvatarWork>
  for (const id of ['momo', 'luna', 'coco', 'mimi', 'kiki'] as Staff[]) {
    const mine = items.filter((i) => i.assignee === id)
    const soon = mine.filter((i) => ['soon', 'urgent', 'overdue'].includes(i.level))
    res[id] = {
      items: mine,
      doing: mine.filter((i) => i.started),
      planned: mine.filter((i) => !i.started),
      soon,
      alert: soon.some((i) => i.level === 'urgent' || i.level === 'overdue') ? 'urgent' : soon.length ? 'soon' : null,
    }
  }
  return res
}
