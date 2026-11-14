import { subAssignee, taskAssignee } from './assign'
import { dueInfo, sameDay, todayStr, type DueLevel } from './dates'
import type { Staff, Task } from './types'

/** 달력에 찍히는 마감 한 건 (업무 최종 마감 또는 세부 할 일 마감) */
export interface Entry {
  key: string
  date: string
  title: string
  taskTitle: string
  kind: 'final' | 'sub'
  done: boolean
  assignee: Staff
  level: DueLevel
  task: Task
}

export function buildEntries(tasks: Task[], today = todayStr()): Entry[] {
  const out: Entry[] = []
  for (const t of tasks) {
    if (t.due) {
      const done = t.status === 'done'
      out.push({
        key: `${t.id}:final`, date: t.due, kind: 'final', task: t, taskTitle: t.title,
        title: t.subtasks.length ? `${t.title} 최종 마감` : t.title,
        done, assignee: taskAssignee(t), level: done ? 'done' : dueInfo({ due: t.due, status: t.status }, today).level,
      })
    }
    for (const s of t.subtasks) {
      if (!s.due) continue
      const done = s.done || t.status === 'done'
      out.push({
        key: `${t.id}:${s.id}`, date: s.due, kind: 'sub', task: t, taskTitle: t.title, title: s.title,
        done, assignee: subAssignee(t, s), level: done ? 'done' : dueInfo({ due: s.due, status: t.status }, today).level,
      })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || Number(a.done) - Number(b.done))
}

/** 업무 진행률 0~1: 할 일이 있으면 완료 비율, 없으면 완료 여부 */
export function taskProgress(t: Task) {
  if (t.status === 'done') return 1
  if (t.subtasks.length === 0) return 0
  return t.subtasks.filter((s) => s.done).length / t.subtasks.length
}

export function overallProgress(tasks: Task[]) {
  if (tasks.length === 0) return { pct: 0, done: 0, total: 0 }
  const sum = tasks.reduce((n, t) => n + taskProgress(t), 0)
  return { pct: Math.round((sum / tasks.length) * 100), done: tasks.filter((t) => t.status === 'done').length, total: tasks.length }
}

/** 그날 끝낸 일 (업무 완료 + 세부 할 일 완료) */
export function completedOn(tasks: Task[], day: string) {
  const out: { key: string; title: string; taskTitle: string }[] = []
  for (const t of tasks) {
    if (t.status === 'done' && sameDay(t.completedAt, day)) out.push({ key: t.id, title: t.title, taskTitle: '업무 완료' })
    for (const s of t.subtasks) if (s.done && sameDay(s.doneAt, day)) out.push({ key: `${t.id}:${s.id}`, title: s.title, taskTitle: t.title })
  }
  return out
}

export interface Briefing {
  todo: number // 오늘 해야 할 일
  dueToday: Entry[]
  dueTomorrow: Entry[]
  overdue: Entry[]
  top: Entry | null
}

/** 오늘 해야 할 일 = 마감이 오늘이거나 지난 미완료 + 진행 중인 업무의 미완료 항목 */
export function makeBriefing(tasks: Task[], today = todayStr(), tomorrow: string): Briefing {
  const entries = buildEntries(tasks, today).filter((e) => !e.done)
  const dueToday = entries.filter((e) => e.date === today)
  const dueTomorrow = entries.filter((e) => e.date === tomorrow)
  const overdue = entries.filter((e) => e.date < today)
  const doing = entries.filter((e) => e.task.status === 'doing' && e.date > today)
  const todo = new Set([...overdue, ...dueToday, ...doing].map((e) => e.key)).size
  const top = [...overdue, ...dueToday, ...entries.filter((e) => e.date > today)][0] ?? null
  return { todo, dueToday, dueTomorrow, overdue, top }
}
