import type { AvatarId } from './avatars'

export type Importance = 'high' | 'normal' | 'low'
export type Status = 'todo' | 'doing' | 'done'
/** 직원 아바타만 담당할 수 있음. null이면 자동 배정(4단계) */
export type Staff = Exclude<AvatarId, 'user'>
export type Assignee = Staff | null

export interface SubTask {
  id: string
  title: string
  due: string | null // YYYY-MM-DD
  assignee: Assignee
  done: boolean
  doneAt?: number | null
}

export interface Task {
  id: string
  title: string
  desc: string
  due: string | null // 최종 마감일 YYYY-MM-DD
  importance: Importance
  status: Status
  assignee: Assignee
  subtasks: SubTask[]
  createdAt: number
  completedAt: number | null
  /** '진행 중'이 된 시각(지금 진행 중일 때만) */
  startedAt?: number | null
  /** 지금까지 일한 시간(ms) — 진행 중이던 시간의 합 */
  workedMs?: number
  /** 마지막으로 고친 시각 — 기기끼리 동기화할 때 업무를 하나씩 합치는 기준 */
  updatedAt?: number
  /** 'event'면 아바타에게 나누는 업무가 아니라 달력에만 보이는 내 일정이에요 (마감일 칸 due = 일정 날짜) */
  kind?: 'event'
  /** 일정 시각 HH:MM (선택) */
  time?: string
}

export const IMPORTANCE_LABEL: Record<Importance, string> = { high: '높음', normal: '보통', low: '낮음' }
export const STATUS_LABEL: Record<Status, string> = { todo: '예정', doing: '진행 중', done: '완료' }

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
