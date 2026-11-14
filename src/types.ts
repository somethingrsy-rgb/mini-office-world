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
}

export const IMPORTANCE_LABEL: Record<Importance, string> = { high: '높음', normal: '보통', low: '낮음' }
export const STATUS_LABEL: Record<Status, string> = { todo: '예정', doing: '진행 중', done: '완료' }

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
