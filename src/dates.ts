import type { Task } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** 사용자 기기의 오늘 날짜 (YYYY-MM-DD) */
export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)) / 86400000)

export const fmtDate = (s: string) => `${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}.`

export type DueLevel = 'none' | 'ok' | 'soon' | 'urgent' | 'overdue' | 'done'

/** 마감 상태: 4일 이상=일반, 3일 이내=임박(노랑), 당일·초과=긴급(빨강) */
export function dueInfo(task: Pick<Task, 'due' | 'status'>, today = todayStr()): { level: DueLevel; label: string } {
  if (task.status === 'done') return { level: 'done', label: '완료' }
  if (!task.due) return { level: 'none', label: '마감일 없음' }
  const left = daysBetween(today, task.due)
  if (left < 0) return { level: 'overdue', label: `기한 초과 ${-left}일` }
  if (left === 0) return { level: 'urgent', label: '오늘 마감' }
  if (left <= 3) return { level: 'soon', label: `D-${left}` }
  return { level: 'ok', label: `D-${left}` }
}

export const isOverdue = (t: Task, today = todayStr()) => dueInfo(t, today).level === 'overdue'

const IMP = { high: 0, normal: 1, low: 2 } as const

/** 우선순위: 기한 초과 → 남은 기간 → 중요도 → 등록 순서. 완료 업무는 맨 뒤 */
export function compareTasks(a: Task, b: Task, today = todayStr()) {
  if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1
  const oa = isOverdue(a, today)
  const ob = isOverdue(b, today)
  if (oa !== ob) return oa ? -1 : 1
  const da = a.due ? daysBetween(today, a.due) : 9999
  const db = b.due ? daysBetween(today, b.due) : 9999
  if (da !== db) return da - db
  if (a.importance !== b.importance) return IMP[a.importance] - IMP[b.importance]
  return a.createdAt - b.createdAt
}

// ── 달력 계산 ──────────────────────────────
export const DOW = ['일', '월', '화', '수', '목', '금', '토']

const fromStr = (s: string) => new Date(`${s}T00:00:00`)
export const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function addDays(s: string, n: number) {
  const d = fromStr(s)
  d.setDate(d.getDate() + n)
  return toStr(d)
}

/** 그 주 일요일 (월간 달력도 일요일 시작이라 맞춰요) */
export function startOfWeek(s: string) {
  return addDays(s, -fromStr(s).getDay())
}

export const dowOf = (s: string) => DOW[fromStr(s).getDay()]
export const fmtLong = (s: string) => `${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일 (${dowOf(s)})`

export function addMonths(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 월 달력 칸(앞뒤 빈칸은 null). 일요일 시작 */
export function monthCells(ym: string): (string | null)[] {
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1).getDay()
  const days = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = Array(first).fill(null)
  for (let d = 1; d <= days; d++) cells.push(`${ym}-${pad(d)}`)
  while (cells.length % 7) cells.push(null)
  return cells
}

export const sameDay = (ts: number | null | undefined, day: string) => !!ts && toStr(new Date(ts)) === day
